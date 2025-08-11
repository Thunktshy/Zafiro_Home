// /Public/scripts/carrito.js  — Modo depuración detallado
// Usa: activa con window.DEBUG_CART = true (por default true en dev)
window.DEBUG_CART = window.DEBUG_CART ?? true;

(() => {
  const LOG_PREFIX = '[Carrito]';
  const now = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
  const log = (...args) => { if (window.DEBUG_CART) console.log(now(), LOG_PREFIX, ...args); };
  const warn = (...args) => { if (window.DEBUG_CART) console.warn(now(), LOG_PREFIX, ...args); };
  const err = (...args) => console.error(now(), LOG_PREFIX, ...args);

  log('Script cargado. DEBUG_CART=', window.DEBUG_CART, 'Auth?', !!window.Auth);

  // =====================
  // Carrito (solo IDs)
  // =====================
  const Cart = (() => {
    const KEY = 'tmpCartIds';
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        log('Cart.read() intentó leer localStorage:', { raw });
        const a = JSON.parse(raw || '[]');
        const out = Array.isArray(a) ? a.map(String) : [];
        log('Cart.read() ok ->', out);
        return out;
      } catch (e) {
        err('Cart.read() fallo al parsear:', e);
        return [];
      }
    };
    const write = (ids) => {
      try {
        const uniq = [...new Set((ids || []).map(String))];
        localStorage.setItem(KEY, JSON.stringify(uniq));
        log('Cart.write() guardado ->', uniq);
      } catch (e) {
        err('Cart.write() error:', e);
      }
    };
    const has = (id) => {
      const r = read().includes(String(id));
      log('Cart.has()', { id: String(id), existe: r });
      return r;
    };
    const add = (id) => {
      id = String(id || '').trim();
      log('Cart.add() solicitado ->', { id });
      if (!id) { warn('Cart.add() id vacío'); return false; }
      const ids = read();
      if (ids.includes(id)) { warn('Cart.add() ya existía en carrito', { id }); return false; }
      ids.push(id);
      write(ids);
      log('Cart.add() agregado OK', { id, total: ids.length });
      return true;
    };
    const setOnly = (id) => { log('Cart.setOnly()', { id }); write(id ? [String(id)] : []); };
    const all = () => read();
    const clear = () => { log('Cart.clear()'); write([]); };
    return { has, add, setOnly, all, clear };
  })();

  // =====================
  // Auth helpers
  // =====================
  async function getAuth() {
    log('getAuth() intentando refresh de sesión…');
    try {
      const s = await (window.Auth?.refresh?.() || Promise.resolve({}));
      const out = { isAuth: !!s?.authenticated, uid: s?.uid ?? sessionStorage.getItem('uid') ?? null };
      log('getAuth() resultado:', out);
      return out;
    } catch (e) {
      const out = { isAuth: false, uid: sessionStorage.getItem('uid') ?? null };
      warn('getAuth() error, asumiendo no autenticado:', e, '->', out);
      return out;
    }
  }

  function buildCartUrl({ pid, ids, uid }) {
    const url = new URL('miCarrito.html', location.origin);
    if (pid) url.searchParams.set('pid', String(pid));
    if (ids?.length) url.searchParams.set('ids', ids.map(String).join(','));
    if (uid) url.searchParams.set('uid', String(uid));
    const finalUrl = url.pathname + url.search + url.hash;
    log('buildCartUrl()', { pid, ids, uid, finalUrl });
    return finalUrl;
  }

  function safeGo(href) {
    log('Navegando a:', href);
    try { location.assign(href); }
    catch (e) { err('location.assign() fallo:', e, 'Intentando location.href…'); location.href = href; }
  }

  // =====================
  // UI wiring
  // =====================
  function getPidFromTarget(target) {
    log('getPidFromTarget() target:', { tag: target?.tagName, classes: target?.className });
    // Busca data-id en el botón o en el contenedor .offer-card
    const btn = target?.closest?.('button[data-id]');
    if (btn?.dataset?.id) { log('getPidFromTarget() encontró en botón:', btn.dataset.id); return btn.dataset.id; }
    const card = target?.closest?.('.offer-card[data-id]');
    if (card?.dataset?.id) { log('getPidFromTarget() encontró en card:', card.dataset.id); return card.dataset.id; }
    warn('getPidFromTarget() no encontró data-id en el DOM del click');
    return null;
  }

  async function onBuyNow(pid) {
    log('onBuyNow() se presionó "Comprar ahora"', { pid });
    const { isAuth, uid } = await getAuth();

    if (!pid) {
      warn('onBuyNow() sin pid -> alert');
      alert('No se encontró el id del producto. Asegúrate de renderizar data-id en los botones.');
      return;
    }

    if (!isAuth) {
      warn('onBuyNow() no se encontró sesión -> solicitando login');
      // Guarda intención y pide login
      const pending = buildCartUrl({ pid, uid: null });
      try { sessionStorage.setItem('postLoginRedirect', pending); log('postLoginRedirect guardado', pending); } catch (e) { err('No se pudo guardar postLoginRedirect', e); }
      window.dispatchEvent(new CustomEvent('auth:login-required'));
      return;
    }

    // Con sesión: vamos directo a miCarrito con ?pid=...&uid=...
    const href = buildCartUrl({ pid, uid });
    log('onBuyNow() con sesión, redirigiendo ->', href);
    safeGo(href);
  }

  function onAddToCart(pid, btn) {
    log('onAddToCart() se presionó "Agregar al carrito"', { pid });
    if (!pid) {
      warn('onAddToCart() sin pid -> alert');
      alert('No se encontró el id del producto. Asegúrate de renderizar data-id en los botones.');
      return;
    }
    if (Cart.has(pid)) {
      warn('onAddToCart() ya estaba en el carrito', { pid });
      alert('Ya en el carrito');
      return;
    }
    Cart.add(pid);
    // Feedback rápido
    if (btn) {
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Agregado ✓';
      log('onAddToCart() feedback visual aplicado al botón');
      setTimeout(() => { btn.disabled = false; btn.textContent = orig; log('onAddToCart() feedback restaurado'); }, 900);
    } else {
      warn('onAddToCart() no se encontró el botón para feedback');
    }
  }

  async function onGoToCartClicked(ev) {
    log('onGoToCartClicked() se presionó "Mi carrito"');
    ev.preventDefault();
    const { uid } = await getAuth();
    const ids = Cart.all();
    const href = buildCartUrl({ ids, uid });
    log('onGoToCartClicked() redirigiendo con ids:', ids, '->', href);
    safeGo(href);
  }

  // Reanudar después de login si el usuario quería ir al carrito por "comprar ahora"
  window.addEventListener('auth:status-changed', (ev) => {
    const isLogged = !!ev?.detail?.isLoggedIn || window.Auth?.state?.authenticated;
    log('Evento auth:status-changed', { isLogged, state: window.Auth?.state });
    if (!isLogged) return;
    const pending = sessionStorage.getItem('postLoginRedirect');
    log('postLoginRedirect actual:', pending);
    if (pending && /miCarrito\.html/i.test(pending)) {
      try { sessionStorage.removeItem('postLoginRedirect'); log('postLoginRedirect eliminado'); } catch {}
      // añade uid actual si hace falta
      const uid = sessionStorage.getItem('uid');
      try {
        const u = new URL(pending, location.origin);
        if (uid && !u.searchParams.has('uid')) {
          u.searchParams.set('uid', uid);
          log('Adjuntando uid al redirect', uid);
        }
        safeGo(u.pathname + u.search + u.hash);
      } catch (e) {
        warn('URL de pending inválida, navegando crudo:', pending, e);
        safeGo(pending);
      }
    }
  });

  // Errores globales útiles para depurar
  window.addEventListener('error', (e) => err('Global error:', e?.message, e?.filename, e?.lineno, e?.colno));
  window.addEventListener('unhandledrejection', (e) => err('Unhandled promise rejection:', e?.reason));

  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded');
    // 1) Delegación en la grilla de ofertas (botones dinámicos)
    const grid = document.querySelector('.ofertas-grid'); // generado por llenarPagina.js
    if (!grid) { warn('No se encontró .ofertas-grid; no se podrán escuchar clicks en tarjetas'); }
    grid?.addEventListener('click', async (e) => {
      log('Click dentro de .ofertas-grid', { target: e?.target?.tagName, classes: e?.target?.className });

      // Tolerar posible typo en clase: "btn-ad-to-cart" vs "btn-add-to-cart"
      const buyBtn = e.target.closest('.btn-buy');
      let addBtn = e.target.closest('.btn-ad-to-cart');
      if (!addBtn) addBtn = e.target.closest('.btn-add-to-cart'); // fallback por si la clase real es "btn-add-to-cart"

      if (!buyBtn && !addBtn) { log('Click ignorado: no era botón buy/add'); return; }

      const pid = getPidFromTarget(e.target);
      if (pid) log('Se seleccionó el producto', { pid });
      else warn('No se pudo obtener pid del click');

      if (buyBtn) {
        log('Se presionó el botón "Comprar ahora"');
        await onBuyNow(pid);
      }
      if (addBtn) {
        log('Se presionó el botón "Agregar al carrito"');
        onAddToCart(pid, addBtn);
      }
    });

    // 2) “Mi carrito” del menú lateral (enlace existe en index.html)
    const anchors = [...document.querySelectorAll('a[href="miCarrito.html"]')];
    log('Anchors a miCarrito.html encontrados:', anchors.length);
    anchors.forEach(a => a.addEventListener('click', onGoToCartClicked));

    // 3) (Opcional) ícono del navbar si existe clase .nav-cart-icon (loginModal ya lo usa)
    const navIcon = document.querySelector('.nav-cart-icon');
    if (navIcon) {
      log('Encontrado .nav-cart-icon, conectando listener');
      navIcon.addEventListener('click', onGoToCartClicked);
    } else {
      log('No existe .nav-cart-icon (opcional)');
    }

    // Estado inicial del carrito:
    log('Carrito inicial:', Cart.all());
  });
})();
