// /client-resources/scripts/micarrito.js
// Lee tmpCartIds de localStorage, consulta productos y renderiza el carrito.
// Mensajes por item: “producto no encontrado” y “producto sin stock”.

const PLACEHOLDER = 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=60';

// ======== Helpers ========
const money = (n) => (Number(n) || 0).toLocaleString('es-MX', { style:'currency', currency:'MXN' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
function getSessionFlag(key) {
  const v = sessionStorage.getItem(key);
  if (v === 'true') return true;
  if (v === 'false') return false;
  try { return Boolean(JSON.parse(v)); } catch { return Boolean(v); }
}

// Navbar username
document.getElementById('navUserLabel').innerHTML = `<i class="fa-solid fa-circle-user"></i> ${esc(sessionStorage.getItem('username') || 'Cliente')}`;

// Subnav categorías simple (opcional)
(async () => {
  const box = document.getElementById('subnavCategorias');
  if (!box) return;
  try {
    const r = await fetch('/categorias/get_list', { headers:{Accept:'application/json'} });
    const j = await r.json();
    const rows = Array.isArray(j?.data) ? j.data : [];
    box.innerHTML = rows.slice(0,8).map(c => `<li><a href="/index.html#categories">${esc(c.nombre_categoria || c.nombre)}</a></li>`).join('') || '<li><a href="#">(sin datos)</a></li>';
  } catch { box.innerHTML = '<li><a href="#">(sin datos)</a></li>'; }
})();

// ======== API loaders ========
let productosAPI;
try {
  // usa módulos bajo client-resources si existen; si no, recurre al path genérico
  ({ productosAPI } = await import('/client-resources/apis/productosManager.js'));
} catch {
  ({ productosAPI } = await import('/scripts/apis/productosManager.js')); // fallback
}

// imagen del producto (toma la primera disponible)
async function getProductoImage(producto_id) {
  try {
    const res = await fetch(`/imagenes/productos/${encodeURIComponent(producto_id)}`, { headers:{Accept:'application/json'} });
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    const first = list.find(r => r.image_path);
    return first?.image_path || PLACEHOLDER;
  } catch { return PLACEHOLDER; }
}

// ======== Cart state ========
function readCartIds() {
  try {
    const raw = localStorage.getItem('tmpCartIds');
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch { return []; }
}
function saveCartIds(ids) {
  localStorage.setItem('tmpCartIds', JSON.stringify(ids));
}

// Carga productos para los ids
async function loadProducts(ids) {
  const results = [];
  for (const id of ids) {
    try {
      const resp = await productosAPI.getOne(id);  // GET /productos/by_id/:id
      // La API devuelve { success, data } o un objeto línea; normalizamos:
      const p = (resp?.data && (Array.isArray(resp.data) ? resp.data[0] : resp.data)) || resp;
      if (!p || !p.producto_id) {
        results.push({ id, notFound: true });
        continue;
      }
      const img = await getProductoImage(p.producto_id);
      results.push({
        id: p.producto_id,
        name: p.nombre_producto || '(Sin nombre)',
        desc: p.descripcion || '',
        price: Number(p.precio_unitario || 0) || 0,
        stock: Number(p.stock ?? 0),
        image: img,
        qty: 1
      });
    } catch {
      results.push({ id, notFound: true });
    }
  }
  return results;
}

// ======== Render ========
const cartList = document.getElementById('cartList');
const sumSubtotal = document.getElementById('sumSubtotal');
const sumEnvio = document.getElementById('sumEnvio');
const sumTotal = document.getElementById('sumTotal');
const btnCheckout = document.getElementById('btnCheckout');

let state = { items: [] };

function render() {
  if (!cartList) return;
  if (!state.items.length) {
    cartList.innerHTML = `<div class="empty">
      <i class="fa-solid fa-basket-shopping" style="font-size:3rem;color:#a5230c"></i>
      <p>Tu carrito está vacío</p>
      <a class="btn-min" href="/index.html#ofertas">Ver ofertas</a>
    </div>`;
    sumSubtotal.textContent = money(0);
    sumEnvio.textContent = money(0);
    sumTotal.textContent = money(0);
    btnCheckout.disabled = true;
    return;
  }

  btnCheckout.disabled = false;

  cartList.innerHTML = state.items.map((it, idx) => {
    if (it.notFound) {
      return `
      <article class="cart-item" data-idx="${idx}">
        <img class="cart-thumb" src="${PLACEHOLDER}" alt="">
        <div>
          <h3 class="cart-name">ID: ${esc(it.id)}</h3>
          <p class="cart-desc">producto no encontrado</p>
          <div class="cart-badges"><span class="cart-badge b-miss">No disponible</span></div>
        </div>
        <div class="actions">
          <button class="btn-min js-remove"><i class="fa-solid fa-trash"></i> Quitar</button>
        </div>
      </article>`;
    }

    const out = it.stock <= 0;
    const max = Math.max(0, Number(it.stock || 0));
    const qty = Math.min(it.qty, max) || 0;
    const line = qty * it.price;

    return `
    <article class="cart-item" data-idx="${idx}">
      <img class="cart-thumb" src="${esc(it.image)}" alt="">
      <div>
        <h3 class="cart-name">${esc(it.name)}</h3>
        <p class="cart-desc">${esc(it.desc)}</p>
        <div class="cart-badges">
          ${out ? '<span class="cart-badge b-out">producto sin stock</span>' : ''}
          <span class="cart-badge" style="background:#eef2ff;border:1px solid #e0e7ff;color:#3730a3;">${esc(it.id)}</span>
        </div>
      </div>
      <div class="actions">
        <div class="price">${money(it.price)}</div>
        <div class="qty">
          <button class="btn-min js-dec" ${qty<=0?'disabled':''}>−</button>
          <input class="js-qty" type="number" min="0" max="${max}" value="${qty}" ${out?'disabled':''}>
          <button class="btn-min js-inc" ${qty>=max?'disabled':''}>+</button>
        </div>
        <div class="price" title="Total línea">${money(line)}</div>
        <button class="btn-min js-remove"><i class="fa-solid fa-trash"></i> Quitar</button>
      </div>
    </article>`;
  }).join('');

  // bind events
  cartList.querySelectorAll('.js-remove').forEach(btn => btn.addEventListener('click', onRemove));
  cartList.querySelectorAll('.js-inc').forEach(btn => btn.addEventListener('click', onInc));
  cartList.querySelectorAll('.js-dec').forEach(btn => btn.addEventListener('click', onDec));
  cartList.querySelectorAll('.js-qty').forEach(inp => inp.addEventListener('change', onQtyInput));

  // totals
  const subtotal = state.items.reduce((acc, it) => {
    if (it.notFound || it.stock <= 0) return acc;
    const qty = Math.min(Number(it.qty||0), Number(it.stock||0));
    return acc + qty * (Number(it.price)||0);
  }, 0);
  const envio = 0; // regla actual: $0; ajústalo si agregas cálculo
  sumSubtotal.textContent = money(subtotal);
  sumEnvio.textContent = money(envio);
  sumTotal.textContent = money(subtotal + envio);
}

function syncStorage() {
  const ids = state.items.filter(it => !it.notFound).map(it => it.id);
  saveCartIds(ids);
}

function getIdx(el) {
  const art = el.closest('.cart-item');
  return Number(art?.dataset.idx);
}
function onRemove(e) {
  const i = getIdx(e.currentTarget);
  if (Number.isFinite(i)) {
    state.items.splice(i, 1);
    syncStorage();
    render();
  }
}
function onInc(e) {
  const i = getIdx(e.currentTarget);
  const it = state.items[i];
  const max = Math.max(0, Number(it.stock||0));
  it.qty = Math.min((Number(it.qty)||0) + 1, max);
  render();
}
function onDec(e) {
  const i = getIdx(e.currentTarget);
  const it = state.items[i];
  it.qty = Math.max((Number(it.qty)||0) - 1, 0);
  render();
}
function onQtyInput(e) {
  const i = getIdx(e.target);
  const it = state.items[i];
  const max = Math.max(0, Number(it.stock||0));
  let v = Number(e.target.value||0);
  if (!Number.isFinite(v) || v < 0) v = 0;
  if (v > max) v = max;
  it.qty = v;
  render();
}

// ======== Init ========
(async () => {
  // proteger flujo básico de cliente (opcional)
  const isClient = getSessionFlag('isClient');
  if (!isClient) {
    // si lo deseas, redirige:
    // location.replace('/index.html');
  }

  const ids = readCartIds();
  const items = await loadProducts(ids);
  state.items = items;
  render();
})();

// Checkout demo
document.getElementById('btnCheckout').addEventListener('click', () => {
  const total = sumTotal.textContent || '$0.00';
  if (!state.items.some(it => !it.notFound && it.stock > 0 && it.qty > 0)) {
    alert('No hay artículos disponibles para comprar.');
    return;
  }
  alert(`Gracias por tu compra. Total: ${total}`);
});
