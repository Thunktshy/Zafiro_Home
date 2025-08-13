// /Public/scripts/carritoSinRegistro.js
// Detecta clic en "Comprar ahora", guarda el id en cookie y redirige a /pages/micarrito.html?ids=...

/* ======================
   Helpers de cookies
====================== */
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function setCookie(name, value, days = 7, path = '/') {
  const expires = new Date(Date.now() + days*24*60*60*1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=${path}`;
}

/* ======================
   Helpers de ID
====================== */
const normPrd = (id) => {
  const s = String(id ?? '').trim();
  if (!s) return '';
  return s.startsWith('prd-') ? s : `prd-${s}`;
};
const slug = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g,'');

/* ======================
   Click en "Comprar ahora"
====================== */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-buy');
  if (!btn) return;

  e.preventDefault();

  // Buscamos el contenedor de la tarjeta y el ID
  const card = btn.closest('.offer-card');
  let pid = card?.dataset?.productId;            // ← Usa data-product-id si existe
  if (!pid) {
    // Fallback: intenta derivar del título visible
    const title = card?.querySelector('.offer-title')?.textContent || 'temp';
    pid = slug(title) || 'temp';
  }
  const producto_id = normPrd(pid);

  // Lee cookie existente, agrega el id (sin duplicar)
  const raw = getCookie('cart_ids');
  const list = raw ? raw.split(',').filter(Boolean) : [];
  if (!list.includes(producto_id)) list.push(producto_id);
  setCookie('cart_ids', list.join(','), 7, '/');

  // Redirige a Mi Carrito con el/los ids en la URL
  const url = `./pages/micarrito.html?ids=${encodeURIComponent(producto_id)}`;
  location.assign(url);
});
