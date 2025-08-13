// /Public/scripts/miCarrito.js
import { productosAPI } from './apis/productosManager.js'; // mismo nivel /scripts
// productosAPI.getOne(id) devuelve { success:true, data:{ producto_id, nombre_producto, precio_unitario, stock, ... } }  :contentReference[oaicite:3]{index=3}

/* ======================
   Helpers URL / Cookies
====================== */
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function qs(name) {
  const url = new URL(location.href);
  const v = url.searchParams.get(name);
  return v && v.trim() !== '' ? v : null;
}
const money = (n) => (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/* ======================
   Estado simple del carrito (UI)
====================== */
const $pedidoActual = document.getElementById('pedido-actual');
const $totalLabel   = document.getElementById('total-label');
const $btnComprar   = document.getElementById('btn-comprar');

let items = []; // [{ id, nombre, precio, stock, qty }]

function render() {
  if (!items.length) {
    $pedidoActual.innerHTML = '<div class="empty">Tu carrito está vacío.</div>';
    $totalLabel.textContent = 'Total: $0.00';
    return;
  }

  const rows = items.map((it, idx) => `
    <div class="cart-card" data-idx="${idx}">
      <img class="cart-img" src="https://picsum.photos/seed/${encodeURIComponent(it.id)}/96/96" alt="">
      <div>
        <div class="cart-title">${it.nombre}</div>
        <div class="cart-meta">ID: ${it.id} · Stock: ${it.stock}</div>
        <div class="qty" style="margin-top:.4rem">
          <button class="btn-minus" type="button">-</button>
          <input class="qty-input" type="number" min="1" max="${it.stock}" value="${it.qty}">
          <button class="btn-plus" type="button">+</button>
        </div>
      </div>
      <div class="price">${money(it.precio * it.qty)}</div>
    </div>
  `).join('');

  $pedidoActual.innerHTML = rows;

  // Handlers de cantidad
  $pedidoActual.querySelectorAll('.cart-card').forEach(card => {
    const idx = Number(card.dataset.idx);
    const input = card.querySelector('.qty-input');
    const minus = card.querySelector('.btn-minus');
    const plus  = card.querySelector('.btn-plus');

    const clampQty = (v) => {
      const n = Math.max(1, Math.min(Number(v)||1, items[idx].stock || 1));
      return n;
    };

    input.addEventListener('change', () => {
      items[idx].qty = clampQty(input.value);
      input.value = items[idx].qty;
      updateTotals();
    });
    minus.addEventListener('click', () => {
      items[idx].qty = clampQty((items[idx].qty || 1) - 1);
      input.value = items[idx].qty;
      updateTotals();
    });
    plus.addEventListener('click', () => {
      items[idx].qty = clampQty((items[idx].qty || 1) + 1);
      input.value = items[idx].qty;
      updateTotals();
    });
  });

  updateTotals();
}

function updateTotals() {
  const total = items.reduce((acc, it) => acc + (Number(it.precio)||0) * (Number(it.qty)||1), 0);
  $totalLabel.textContent = `Total: ${money(total)}`;
}

/* ======================
   Carga inicial
====================== */
(async function init() {
  // 1) Lee ids de la URL o de la cookie
  const idsParam = qs('ids');
  let ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!ids.length) {
    const raw = getCookie('cart_ids');
    ids = raw ? raw.split(',').filter(Boolean) : [];
  }

  // Log requerido: Se obtuvo el producto id=
  console.log('Se obtuvo el producto id=', ids.join(', '));

  if (!ids.length) {
    render();
    return;
  }

  // 2) Por cada id, trae la info del producto
  const fetched = [];
  for (const id of ids) {
    try {
      const res = await productosAPI.getOne(id); // { success, data }
      const prd = res?.data ?? null;

      // Logs requeridos
      console.log('Se obtuvo la información del producto =', prd);
      console.log('Su stock es =', prd?.stock);

      if (prd) {
        fetched.push({
          id: prd.producto_id || id,
          nombre: prd.nombre_producto || 'Producto',
          precio: Number(prd.precio_unitario) || 0,
          stock: Number(prd.stock) || 1,
          qty: 1
        });
      }
    } catch (err) {
      console.warn('No se pudo cargar el producto', id, err?.message);
    }
  }

  items = fetched;
  render();
})();

/* ======================
   Botón "Comprar ahora" en Mi Carrito
   (solo logs de prueba, sin llamada al backend)
====================== */
$btnComprar?.addEventListener('click', () => {
  // Logs requeridos
  console.log('Se presiono el boton comprar');

  // producto en carrito = (IDs o nombres)
  const ids = items.map(it => it.id);
  console.log('producto en carrito =', ids.join(', '));

  // cantidad seleccionada = (arreglo de cantidades o total)
  const cantidades = items.map(it => it.qty);
  console.log('cantidad seleccionada =', cantidades.join(', '));

  // precio calculado = (total actual mostrado)
  const total = items.reduce((acc, it) => acc + (Number(it.precio)||0) * (Number(it.qty)||1), 0);
  console.log('precio calculado =', total);
});
