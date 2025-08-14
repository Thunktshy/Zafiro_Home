// /client-resources/scripts/micarrito.js
// Genera el carrito desde URL/localStorage y permite: crear pedido, agregar líneas y confirmar.
// En éxito: limpia el carrito local (tmpCartIds/temProdIds).

const PLACEHOLDER = 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=60';
const KEY_STD = 'tmpCartIds';
const KEY_LEG = 'temProdIds';

const money = (n) => (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const $ = (sel) => document.querySelector(sel);

// Mostrar username en la barra si existe
document.getElementById('navUserLabel')?.insertAdjacentHTML('beforeend',
  ` <i class="fa-solid fa-circle-user"></i> ${esc(sessionStorage.getItem('username') || 'Cliente')}`);

// ===== Imports con fallback (ruta client-resources o raíz) =====
let productosAPI, pedidosAPI, confirmarConVerificacion, controlPedidosAPI, addItemConVerificacion, openPedidoModal;
try {
  ({ productosAPI } = await import('/client-resources/scripts/apis/productosManager.js'));
} catch { ({ productosAPI } = await import('/scripts/apis/productosManager.js')); }

try {
  ({ pedidosAPI, confirmarConVerificacion } = await import('/client-resources/scripts/apis/pedidosManager.js'));
} catch { ({ pedidosAPI, confirmarConVerificacion } = await import('/scripts/apis/pedidosManager.js')); }

try {
  ({ controlPedidosAPI, addItemConVerificacion } = await import('/client-resources/scripts/apis/controlPedidosManager.js'));
} catch { ({ controlPedidosAPI, addItemConVerificacion } = await import('/scripts/apis/controlPedidosManager.js')); }

try {
  ({ openPedidoModal } = await import('/client-resources/scripts/pedido.js'));
} catch {
  try { ({ openPedidoModal } = await import('/scripts/pedido.js')); }
  catch { /* opcional */ }
}

// ===== URL & Storage =====
function parseIdsFromUrl() {
  const ids = [];
  const url = new URL(location.href);
  const params = url.searchParams;
  const uid = params.get('uid');
  if (uid && !sessionStorage.getItem('uid')) sessionStorage.setItem('uid', uid);

  const rawList = params.getAll('ids');
  rawList.forEach(v => String(v).split(/[,\s]+/).forEach(t => {
    const id = String(t || '').trim();
    if (id) ids.push(id);
  }));
  return ids;
}

function readIdsFromStorage() {
  let a = []; let b = [];
  try { a = JSON.parse(localStorage.getItem(KEY_STD) || '[]'); } catch {}
  try { b = JSON.parse(localStorage.getItem(KEY_LEG) || '[]'); } catch {}
  const merged = [...(Array.isArray(a)?a:[]), ...(Array.isArray(b)?b:[])].filter(Boolean);
  const seen = new Set();
  return merged.filter(id => (seen.has(id) ? false : (seen.add(id), true)));
}

function saveIdsToStorage(ids) {
  const clean = Array.from(new Set((ids || []).filter(Boolean)));
  localStorage.setItem(KEY_STD, JSON.stringify(clean));
  localStorage.removeItem(KEY_LEG);
  return clean;
}

// ===== Productos =====
async function getProductoImage(producto_id) {
  try {
    const res = await fetch(`/imagenes/productos/${encodeURIComponent(producto_id)}`, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    const first = list.find(r => r.image_path);
    return first?.image_path || PLACEHOLDER;
  } catch { return PLACEHOLDER; }
}

async function loadProducts(ids) {
  const results = [];
  for (const id of ids) {
    try {
      const resp = await productosAPI.getOne(id);
      const p = (resp?.data && (Array.isArray(resp.data) ? resp.data[0] : resp.data)) || resp;
      if (!p || !p.producto_id) { results.push({ id, notFound: true }); continue; }
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
    } catch { results.push({ id, notFound: true }); }
  }
  return results;
}

// ===== Render =====
const cartList     = document.getElementById('cartList');
const sumSubtotal  = document.getElementById('sumSubtotal');
const sumEnvio     = document.getElementById('sumEnvio');
const sumTotal     = document.getElementById('sumTotal');
const btnCheckout  = document.getElementById('btnCheckout');

let state = { items: [] };

function render() {
  if (!cartList) return;
  if (!state.items.length) {
    cartList.innerHTML = `
      <div class="empty">
        <i class="fa-solid fa-basket-shopping" style="font-size:3rem;color:#a5230c"></i>
        <p>Tu carrito está vacío</p>
        <a class="btn-min" href="/index.html#ofertas">Ver ofertas</a>
      </div>`;
    sumSubtotal.textContent = money(0);
    sumEnvio.textContent    = money(0);
    sumTotal.textContent    = money(0);
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
        <div class="actions"><button class="btn-min js-remove"><i class="fa-solid fa-trash"></i> Quitar</button></div>
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
          <button class="btn-min js-inc" ${qty>=max?'disabled':''}>+</button>
          <input class="js-qty" type="number" min="0" max="${max}" value="${qty}" ${out?'disabled':''}>
          <button class="btn-min js-dec" ${qty<=0?'disabled':''}>−</button>
        </div>
        <div class="price">${money(line)}</div>
        <button class="btn-min js-remove"><i class="fa-solid fa-trash"></i> Quitar</button>
      </div>
    </article>`;
  }).join('');

  cartList.querySelectorAll('.js-remove').forEach(b => b.addEventListener('click', onRemove));
  cartList.querySelectorAll('.js-inc').forEach(b => b.addEventListener('click', onInc));
  cartList.querySelectorAll('.js-dec').forEach(b => b.addEventListener('click', onDec));
  cartList.querySelectorAll('.js-qty').forEach(i => i.addEventListener('change', onQtyInput));

  const subtotal = state.items.reduce((acc, it) => {
    if (it.notFound || it.stock <= 0) return acc;
    const qty = Math.min(Number(it.qty||0), Number(it.stock||0));
    return acc + qty * (Number(it.price)||0);
  }, 0);
  const envio = 0;
  sumSubtotal.textContent = money(subtotal);
  sumEnvio.textContent    = money(envio);
  sumTotal.textContent    = money(subtotal + envio);
}
function getIdx(el){ return Number(el.closest('.cart-item')?.dataset.idx); }
function onRemove(e){ const i=getIdx(e.currentTarget); if(Number.isFinite(i)){ state.items.splice(i,1); persistIds(); render(); } }
function onInc(e){ const i=getIdx(e.currentTarget); const it=state.items[i]; const max=Math.max(0,Number(it.stock||0)); it.qty=Math.min((Number(it.qty)||0)+1,max); render(); }
function onDec(e){ const i=getIdx(e.currentTarget); const it=state.items[i]; it.qty=Math.max((Number(it.qty)||0)-1,0); render(); }
function onQtyInput(e){ const i=getIdx(e.target); const it=state.items[i]; const max=Math.max(0,Number(it.stock||0)); let v=Number(e.target.value||0); if(!Number.isFinite(v)||v<0)v=0; if(v>max)v=max; it.qty=v; render(); }

function persistIds(){
  const ids = state.items.filter(it=>!it.notFound).map(it=>it.id);
  saveIdsToStorage(ids);
}

// ===== Init =====
(async () => {
  const urlIds   = parseIdsFromUrl();
  const storeIds = readIdsFromStorage();
  const merged   = saveIdsToStorage([...urlIds, ...storeIds]);

  const items = await loadProducts(merged);
  state.items = items;
  render();
})();

// ===== Checkout (crear pedido + agregar líneas + confirmar) =====
document.getElementById('btnCheckout')?.addEventListener('click', async () => {
  try {
    // 0) Modal (si existe); si no, confirm simple
    if (typeof openPedidoModal === 'function') {
        await openPedidoModal({ items: state.items });
        return; // el modal maneja todo el proceso
    }

    // 1) Validaciones básicas
    const uid = sessionStorage.getItem('uid') || new URL(location.href).searchParams.get('uid');
    if (!uid) { alert('Inicia sesión para completar tu compra.'); return; }

    const lines = state.items
      .filter(it => !it.notFound && it.stock > 0 && Number(it.qty) > 0)
      .map(it => ({ producto_id: it.id, cantidad: Number(it.qty), precio_unitario: Number(it.price) }));

    if (!lines.length) { alert('Tu carrito no tiene productos disponibles.'); return; }

    // 2) Crear pedido (estado "Por confirmar")
    console.log('checkout: creando pedido para cliente', uid);
    const ins = await pedidosAPI.insert({ cliente_id: uid }); // prefijo 'cl-' lo aplica la API
    const pedido_id = ins?.data?.pedido_id || ins?.data?.pedido?.pedido_id || ins?.pedido_id;
    if (!pedido_id) throw new Error('No se obtuvo pedido_id');

    // 3) Agregar líneas (con verificación de stock por línea)
    for (const ln of lines) {
      console.log(`checkout: agregando producto ${ln.producto_id} x ${ln.cantidad}`);
      await addItemConVerificacion({ pedido_id, ...ln }, controlPedidosAPI);
    }

    // 4) Confirmar pedido (con verificación de stock global)
    console.log('checkout: confirmando pedido', pedido_id);
    await confirmarConVerificacion(pedido_id, pedidosAPI, controlPedidosAPI);

    // 5) ÉXITO → limpiar carrito local + feedback
    localStorage.removeItem(KEY_STD);
    localStorage.removeItem(KEY_LEG);
    console.log('local storage tem prodIds = []'); // mantiene tu estilo de log
    alert('¡Pedido confirmado! Gracias por tu compra.');

    // Opcional: redirigir a detalle del pedido
    // location.assign(`/client-resources/pages/miPedido.html?pedido=${encodeURIComponent(pedido_id)}`);
  } catch (e) {
    console.error('checkout: error', e);
    if (e && e.faltantes && Array.isArray(e.faltantes) && e.faltantes.length) {
      const lines = e.faltantes.map(f =>
        `• ${f.producto_id}: requiere ${f.requerido}, disponible ${f.stock_disponible} (déficit ${f.deficit})`).join('\n');
      alert(`Stock insuficiente:\n${lines}\n\nAjusta cantidades e inténtalo de nuevo.`);
    } else {
      alert(`No se pudo completar tu pedido: ${e?.message || e}`);
    }
  }
});
