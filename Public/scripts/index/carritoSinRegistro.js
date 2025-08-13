// /Public/scripts/carritoSinRegistro.js
// Detecta clic en "Comprar ahora", guarda el id en cookie y redirige a /pages/micarrito.html?ids=...

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function setCookie(name, value, days = 7, path = '/') {
  const expires = new Date(Date.now() + days*24*60*60*1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=${path}`;
}
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

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-buy');
  if (!btn) return;
  e.preventDefault();

  // 1) Prioriza el atributo del propio botón: <button class="btn-buy" data-id="prd-2">
  let pid = btn.dataset.id || btn.dataset.productId;

  // 2) Si no está en el botón, intenta en la tarjeta contenedora
  if (!pid) {
    const card = btn.closest('.offer-card');
    pid = card?.dataset?.productId
       || card?.querySelector('[data-product-id]')?.dataset?.productId
       || card?.querySelector('[data-id]')?.dataset?.id
       || null;
  }

  // 3) Último fallback: slug del título (solo para no romper flujo en pruebas)
  if (!pid) {
    const card = btn.closest('.offer-card');
    const title = card?.querySelector('.offer-title')?.textContent || 'temp';
    pid = slug(title);
  }

  const producto_id = normPrd(pid);

  // Guarda/Acumula en cookie (sin duplicar)
  const raw = getCookie('cart_ids');
  const list = raw ? raw.split(',').filter(Boolean) : [];
  if (!list.includes(producto_id)) list.push(producto_id);
  setCookie('cart_ids', list.join(','), 7, '/');

  // (Opcional) Log para depurar
  console.log('ID de producto detectado =', producto_id);

  // Redirige a Mi Carrito
  location.assign(`./pages/micarrito.html?ids=${encodeURIComponent(producto_id)}`);
});