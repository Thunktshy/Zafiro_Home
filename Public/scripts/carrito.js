// /Public/scripts/carrito.js
// Requiere: window.Auth expuesto por loginModal.js  (ya lo tienes). 
// - Detecta clicks en "Comprar ahora" y "Agregar al carrito".
// - Evita duplicados en el carrito temporal.
// - Redirige a miCarrito.html con ?pid=... (comprar ahora) o ?ids=a,b,c (mi carrito).

// =====================
// Carrito (solo IDs)
// =====================
const Cart = (() => {
  const KEY = 'tmpCartIds';
  const read = () => {
    try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch { return []; }
  };
  const write = (ids) => { try { localStorage.setItem(KEY, JSON.stringify([...new Set(ids || [])])); } catch {} };
  const has = (id) => read().includes(String(id));
  const add = (id) => {
    id = String(id || '').trim();
    if (!id) return false;
    const ids = read();
    if (ids.includes(id)) return false;          // ya existe
    ids.push(id);
    write(ids);
    return true;
  };
  const setOnly = (id) => write(id ? [String(id)] : []);
  const all = () => read();
  const clear = () => write([]);
  return { has, add, setOnly, all, clear };
})();

// =====================
// Auth helpers
// =====================
async function getAuth() {
  try {
    const s = await (window.Auth?.refresh?.() || Promise.resolve({}));
    return { isAuth: !!s?.authenticated, uid: s?.uid ?? sessionStorage.getItem('uid') ?? null };
  } catch {
    return { isAuth: false, uid: sessionStorage.getItem('uid') ?? null };
  }
}

function buildCartUrl({ pid, ids, uid }) {
  const url = new URL('miCarrito.html', location.origin);
  if (pid) url.searchParams.set('pid', String(pid));
  if (ids?.length) url.searchParams.set('ids', ids.map(String).join(','));
  if (uid) url.searchParams.set('uid', String(uid));
  return url.pathname + url.search + url.hash;
}

// =====================
// UI wiring
// =====================
function getPidFromTarget(target) {
  // Busca data-id en el botón o en el contenedor .offer-card
  const btn = target.closest('button[data-id]');
  if (btn?.dataset?.id) return btn.dataset.id;
  const card = target.closest('.offer-card[data-id]');
  if (card?.dataset?.id) return card.dataset.id;
  return null;
}

async function onBuyNow(pid) {
  const { isAuth, uid } = await getAuth();

  if (!pid) {
    alert('No se encontró el id del producto. Asegúrate de renderizar data-id en los botones.');
    return;
  }

  if (!isAuth) {
    // Guarda intención y pide login
    const pending = buildCartUrl({ pid, uid: null });
    try { sessionStorage.setItem('postLoginRedirect', pending); } catch {}
    window.dispatchEvent(new CustomEvent('auth:login-required'));
    return;
  }

  // Con sesión: vamos directo a miCarrito con ?pid=...&uid=...
  const href = buildCartUrl({ pid, uid });
  location.assign(href);
}

function onAddToCart(pid, btn) {
  if (!pid) {
    alert('No se encontró el id del producto. Asegúrate de renderizar data-id en los botones.');
    return;
  }
  if (Cart.has(pid)) {
    alert('Ya en el carrito');
    return;
  }
  Cart.add(pid);
  // Feedback rápido
  if (btn) {
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Agregado ✓';
    setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 900);
  }
}

async function onGoToCartClicked(ev) {
  ev.preventDefault();
  const { uid } = await getAuth();
  const ids = Cart.all();
  const href = buildCartUrl({ ids, uid });
  location.assign(href);
}

// Reanudar después de login si el usuario quería ir al carrito por "comprar ahora"
window.addEventListener('auth:status-changed', (ev) => {
  const isLogged = !!ev?.detail?.isLoggedIn || window.Auth?.state?.authenticated;
  if (!isLogged) return;
  const pending = sessionStorage.getItem('postLoginRedirect');
  if (pending && /miCarrito\.html/i.test(pending)) {
    sessionStorage.removeItem('postLoginRedirect');
    // añade uid actual si hace falta
    const uid = sessionStorage.getItem('uid');
    try {
      const u = new URL(pending, location.origin);
      if (uid && !u.searchParams.has('uid')) u.searchParams.set('uid', uid);
      location.assign(u.pathname + u.search + u.hash);
    } catch {
      location.assign(pending);
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // 1) Delegación en la grilla de ofertas (botones dinámicos)
  const grid = document.querySelector('.ofertas-grid'); // generado por llenarPagina.js :contentReference[oaicite:1]{index=1}
  grid?.addEventListener('click', async (e) => {
    const buyBtn = e.target.closest('.btn-buy');
    const addBtn = e.target.closest('.btn-ad-to-cart');
    if (!buyBtn && !addBtn) return;

    const pid = getPidFromTarget(e.target);
    if (buyBtn) await onBuyNow(pid);
    if (addBtn) onAddToCart(pid, addBtn);
  });

  // 2) “Mi carrito” del menú lateral (enlace existe en index.html) :contentReference[oaicite:2]{index=2}
  document.querySelectorAll('a[href="miCarrito.html"]').forEach(a => {
    a.addEventListener('click', onGoToCartClicked);
  });

  // 3) (Opcional) ícono del navbar si existe clase .nav-cart-icon (loginModal ya lo usa) :contentReference[oaicite:3]{index=3}
  document.querySelector('.nav-cart-icon')?.addEventListener('click', onGoToCartClicked);
});
