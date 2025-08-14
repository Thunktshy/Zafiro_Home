  // LlenarPagina.js
// /scripts/llenarPagina.js
// Inserta image_path devuelto por el backend en categorías y ofertas.
// Endpoints usados:
//   - /categorias/get_list
//   - /productos/ofertas_public  (fallback: /productos/get_all)
//   - /imagenes/categorias/:categoria_id
//   - /imagenes/productos/:producto_id

/* ================= Helpers ================= */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"'`=\/]/g, s =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s])
  );
}
function escAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' }});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch { throw new Error('Respuesta no JSON'); }
  return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
}

const PLACEHOLDER_CAT = 'https://images.unsplash.com/photo-1519681393769-4cbe2bdec5aa?auto=format&fit=crop&w=400&q=70';
const PLACEHOLDER_PROD = 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=70';

/* ================= Imagenes helpers ================= */
async function getCategoriaImage(categoria_id) {
  try {
    const rows = await fetchJson(`/imagenes/categorias/${encodeURIComponent(Number(categoria_id))}`);
    const first = Array.isArray(rows) ? rows.find(r => r.image_path) : null;
    return first?.image_path || '';
  } catch {
    return '';
  }
}
async function getProductoImage(producto_id) {
  try {
    const rows = await fetchJson(`/imagenes/productos/${encodeURIComponent(String(producto_id))}`);
    const first = Array.isArray(rows) ? rows.find(r => r.image_path) : null;
    return first?.image_path || '';
  } catch {
    return '';
  }
}

/* ================= CATEGORÍAS ================= */
async function loadCategories() {
  const endpoints = ['/categorias/get_list', '/categories/get_list'];
  let rows = [];
  for (const url of endpoints) {
    try { rows = await fetchJson(url); break; } catch {}
  }
  if (!Array.isArray(rows)) rows = [];

  // Submenú "Categorías" (texto)
  const catDropdown = document.querySelector('.subnav-menu > li:first-child .dropdown-menu');
  if (catDropdown) {
    catDropdown.innerHTML = rows.map(r =>
      `<li><a href="#">${escapeHtml(r.nombre_categoria ?? r.nombre ?? '')}</a></li>`
    ).join('') || '<li><a href="#">(Sin categorías)</a></li>';
  }

  // Grilla "Explora por Categoría" (con imagen real si existe)
  const catGrid = document.getElementById('categories-list');
  if (catGrid) {
    const top = rows.slice(0, 8);
    // Traer imágenes en paralelo
    const imgs = await Promise.all(top.map(r => getCategoriaImage(r.categoria_id ?? r.id)));
    const cards = top.map((r, i) => {
      const name = r.nombre_categoria ?? r.nombre ?? '';
      const src = imgs[i] || PLACEHOLDER_CAT;
      const alt = escAttr(name || 'Categoría');
      return `
        <div class="category-card" data-categoria="${escAttr(String(r.categoria_id ?? r.id ?? ''))}">
          <img src="${src}" alt="${alt}">
          <h3>${escapeHtml(name)}</h3>
        </div>`;
    }).join('');
    catGrid.innerHTML = cards || `
      <div class="category-card">
        <img src="${PLACEHOLDER_CAT}" alt="(Sin categorías)">
        <h3>(Sin categorías)</h3>
      </div>`;
  }

  // Filtro por categoría (si existe en otras páginas)
  const catFilter = document.getElementById('categoryFilter');
  if (catFilter) {
    catFilter.innerHTML = `
      <option value="">Selecciona una categoría</option>
      ${rows.map(r => `<option value="${escAttr(String(r.categoria_id ?? ''))}">
          ${escapeHtml(r.nombre_categoria ?? r.nombre ?? '')}
        </option>`).join('')}
    `;
  }
}

/* ================= OFERTAS ================= */
async function loadOffers() {
  const endpoints = ['/productos/ofertas_public', '/productos/get_all'];
  let rows = null, used = '';
  for (const url of endpoints) {
    try { rows = await fetchJson(url); used = url; break; } catch {}
  }
  if (!Array.isArray(rows)) rows = [];

  // Normaliza y limita a 8
  const offers = rows.slice(0, 8).map(p => ({
    id: p.producto_id ?? p.id ?? '',
    nombre: p.nombre_producto ?? p.nombre ?? '',
    descripcion: p.descripcion ?? '',
    precio: Number(p.precio_unitario ?? p.precio ?? 0) || 0
  }));

  // Trae imagen para cada producto (usa /imagenes/productos/:id)
  const images = await Promise.all(offers.map(o => getProductoImage(o.id)));

  const grid = document.querySelector('.ofertas-grid');
  if (grid) {
    grid.innerHTML = offers.map((o, i) => {
      const src = images[i] || PLACEHOLDER_PROD;
      const alt = escAttr(o.nombre || 'Producto');
      return `
        <div class="offer-card" data-id="${escAttr(String(o.id))}">
          <img class="offer-image" src="${src}" alt="${alt}">
          <div class="offer-details">
            <h3 class="offer-title">${escapeHtml(o.nombre)}</h3>
            <p>${escapeHtml(o.descripcion)}</p>
            <p class="offer-price">$${o.precio.toFixed(2)}</p>
            <button class="btn-buy" data-id="${escAttr(String(o.id))}">Comprar ahora</button>
            <button class="btn-ad-to-cart" data-id="${escAttr(String(o.id))}">Agregar al carrito</button>
          </div>
        </div>`;
    }).join('') || `
      <div class="offer-card">
        <img class="offer-image" src="${PLACEHOLDER_PROD}" alt="Producto">
        <div class="offer-details">
          <h3 class="offer-title">(Sin productos)</h3>
          <p>Pronto añadiremos ofertas aquí.</p>
          <p class="offer-price">$0.00</p>
          <button class="btn-buy" disabled>Comprar ahora</button>
          <button class="btn-ad-to-cart" disabled>Agregar al carrito</button>
        </div>
      </div>`;
  }


  if (used === '/productos/get_all') {
  }
}

/* ================= Init ================= */
(async () => {
  await Promise.all([loadCategories(), loadOffers()]);
})();
