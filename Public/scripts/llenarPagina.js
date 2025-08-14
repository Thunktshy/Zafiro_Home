// /scripts/llenarPagina.js
// Filtro de productos por categoría (sin imágenes/enlaces de categoría)
// Endpoints:
//   - Categorías: /categorias/get_list  (fallback: /categories/get_list)
//   - Productos:  /productos/get_all    (fallback: /productos/ofertas_public)
//   - Imágenes de producto (opcional): /imagenes/productos/:producto_id

/* ============== Helpers ============== */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"'`=\/]/g, s =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s])
  );
}
function escAttr(str){ return escapeHtml(str).replace(/"/g,'&quot;'); }

async function fetchJson(url){
  const res = await fetch(url, {credentials:'include', headers:{Accept:'application/json'}});
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.text();
  let data; try{ data = JSON.parse(raw); } catch{ throw new Error('Respuesta no JSON'); }
  return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
}

/* ============== Estado global ============== */
const PLACEHOLDER_PROD = 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=70';
let ALL_PRODUCTS = [];            // { id, nombre, descripcion, precio, categoriaId, categoriaNombre, img }
let CATEGORIES = [];              // { id, nombre }
let ACTIVE_CATEGORY_ID = '';      // '' => Sin categoría (todos)

/* ============== Imágenes producto (opcional) ============== */
async function getProductoImage(producto_id){
  try{
    const rows = await fetchJson(`/imagenes/productos/${encodeURIComponent(String(producto_id))}`);
    const first = Array.isArray(rows) ? rows.find(r => r.image_path) : null;
    return first?.image_path || '';
  }catch{ return ''; }
}

/* ============== Categorías (como filtro) ============== */
async function loadCategories(){
  const endpoints = ['/categorias/get_list','/categories/get_list'];
  let rows = [];
  for(const url of endpoints){ try{ rows = await fetchJson(url); break; }catch{} }
  if(!Array.isArray(rows)) rows = [];

  CATEGORIES = rows.map(r => ({
    id: String(r.categoria_id ?? r.id ?? ''),
    nombre: r.nombre_categoria ?? r.nombre ?? ''
  })).filter(c => c.id || c.nombre);

  // Construye el grid de categorías SIN imágenes (primer ítem = "Sin categoría")
  const catGrid = document.getElementById('categories-list');
  if(catGrid){
    const cards = [
      `<div class="category-card active" data-categoria="">
         <div class="category-chip">Sin categoría</div>
       </div>`,
      ...CATEGORIES.slice(0, 20).map(c => `
         <div class="category-card" data-categoria="${escAttr(c.id)}">
           <div class="category-chip">${escapeHtml(c.nombre)}</div>
         </div>
      `)
    ].join('');
    catGrid.innerHTML = cards;

    // Delegación de eventos para filtrar
    catGrid.addEventListener('click', (ev) => {
      const card = ev.target.closest('.category-card');
      if(!card) return;
      const catId = card.getAttribute('data-categoria') ?? '';
      setActiveCategory(card);
      applyCategoryFilter(catId);
    });
  }

  // Si existe <select id="categoryFilter">, también lo llenamos (opcional)
  const catFilter = document.getElementById('categoryFilter');
  if(catFilter){
    catFilter.innerHTML = [
      `<option value="">Sin categoría (todos)</option>`,
      ...CATEGORIES.map(c => `<option value="${escAttr(c.id)}">${escapeHtml(c.nombre)}</option>`)
    ].join('');
    catFilter.addEventListener('change', (e) => applyCategoryFilter(e.target.value || ''));
  }
}

function setActiveCategory(activeEl){
  document.querySelectorAll('#categories-list .category-card').forEach(el => el.classList.remove('active'));
  if(activeEl) activeEl.classList.add('active');
}

/* ============== Productos (trae TODOS al inicio) ============== */
async function loadAllProducts(){
  const endpoints = ['/productos/get_all','/productos/ofertas_public'];
  let rows = null, used = '';
  for(const url of endpoints){ try{ rows = await fetchJson(url); used = url; break; }catch{} }
  if(!Array.isArray(rows)) rows = [];

  // Normaliza
  ALL_PRODUCTS = rows.map(p => {
    const id   = p.producto_id ?? p.id ?? '';
    const nom  = p.nombre_producto ?? p.nombre ?? '';
    const desc = p.descripcion ?? '';
    const prec = Number(p.precio_unitario ?? p.precio ?? 0) || 0;
    // intenta distintas keys de categoría
    const catId = String(
      p.categoria_id ?? p.category_id ?? p.categoriaId ?? p.categoryId ?? ''
    );
    const catNom = p.nombre_categoria ?? p.categoria ?? p.category_name ?? '';
    return { id, nombre: nom, descripcion: desc, precio: prec, categoriaId: catId, categoriaNombre: catNom, img: '' };
  });

  // Carga imágenes de producto (si tienes servicio de imágenes)
  try{
    const imgs = await Promise.all(ALL_PRODUCTS.map(p => getProductoImage(p.id)));
    ALL_PRODUCTS = ALL_PRODUCTS.map((p,i) => ({...p, img: imgs[i] || PLACEHOLDER_PROD}));
  }catch{
    ALL_PRODUCTS = ALL_PRODUCTS.map(p => ({...p, img: PLACEHOLDER_PROD}));
  }

  // Render inicial (todos)
  ACTIVE_CATEGORY_ID = '';
  renderProducts(ALL_PRODUCTS);

  // Si la fuente fue /productos/ofertas_public y deseas mostrar TODO, ya están en ALL_PRODUCTS igualmente.
  // (Si en tu backend ofertas_public no devuelve todos, asegúrate que /productos/get_all funcione).
}

/* ============== Render de productos ============== */
function renderProducts(list){
  const grid = document.querySelector('.ofertas-grid');  // Reutiliza tu grid existente
  if(!grid){
    console.warn('No se encontró .ofertas-grid para renderizar productos.');
    return;
  }

  if(!Array.isArray(list) || list.length === 0){
    grid.innerHTML = `
      <div class="offer-card">
        <img class="offer-image" src="${PLACEHOLDER_PROD}" alt="Producto" />
        <div class="offer-details">
          <h3 class="offer-title">(Sin productos)</h3>
          <p>Pronto añadiremos productos aquí.</p>
          <p class="offer-price">$0.00</p>
          <button class="btn-buy" disabled>Comprar ahora</button>
          <button class="btn-ad-to-cart" disabled>Agregar al carrito</button>
        </div>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(o => `
    <div class="offer-card" data-id="${escAttr(String(o.id))}" data-cat="${escAttr(String(o.categoriaId))}">
      <img class="offer-image" src="${escAttr(o.img || PLACEHOLDER_PROD)}" alt="${escAttr(o.nombre || 'Producto')}">
      <div class="offer-details">
        <h3 class="offer-title">${escapeHtml(o.nombre)}</h3>
        <p>${escapeHtml(o.descripcion)}</p>
        <p class="offer-price">$${o.precio.toFixed(2)}</p>
        <button class="btn-buy" data-id="${escAttr(String(o.id))}">Comprar ahora</button>
        <button class="btn-ad-to-cart" data-id="${escAttr(String(o.id))}">Agregar al carrito</button>
      </div>
    </div>
  `).join('');
}

/* ============== Filtro por categoría ============== */
function applyCategoryFilter(catId){
  ACTIVE_CATEGORY_ID = String(catId ?? '');
  if(!ACTIVE_CATEGORY_ID){
    renderProducts(ALL_PRODUCTS);
    return;
  }
  // Preferimos filtrar por ID. Si no hubiera ID en los productos, se podría comparar por nombre.
  const filtered = ALL_PRODUCTS.filter(p => String(p.categoriaId) === ACTIVE_CATEGORY_ID);
  renderProducts(filtered);
}

/* ============== Init ============== */
(async () => {
  try{
    await loadCategories();
    await loadAllProducts();  // Trae todos y renderiza
  }catch(err){
    console.error('Error de carga inicial:', err);
    // Intenta al menos render vacío
    renderProducts([]);
  }
})();
