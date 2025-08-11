// /Public/scripts/carrito.js
// maneja .nav-cart-icon y enlaces a miCarrito.html. Genera data-id si falta.

(() => {
  const LP = '[Carrito]';
  const now = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
  const log  = (...a) => console.log(now(), LP, ...a);
  const warn = (...a) => console.warn(now(), LP, ...a);
  const err  = (...a) => console.error(now(), LP, ...a);

  // =====================
  // Carrito (IDs en localStorage)
  // =====================
  const Cart = (() => {
    const KEY = 'tmpCartIds';
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        log('Cart.read raw:', raw);
        const arr = JSON.parse(raw || '[]');
        const out = Array.isArray(arr) ? arr.map(String) : [];
        log('Cart.read ->', out);
        return out;
      } catch (e) { warn('Cart.read error:', e); return []; }
    };
    const write = (ids) => {
      try {
        const uniq = [...new Set((ids||[]).map(String))];
        localStorage.setItem(KEY, JSON.stringify(uniq));
        log('Cart.write ->', uniq);
      } catch (e) { err('Cart.write error:', e); }
    };
    return {
      has: (id) => { const ok = read().includes(String(id)); log('Cart.has?', id, '->', ok); return ok; },
      add: (id) => {
        id = String(id||'').trim();
        log('Cart.add req ->', id);
        if (!id) { warn('Cart.add sin id'); return false; }
        const ids = read();
        if (ids.includes(id)) { warn('Cart.add ya existía', id); return false; }
        ids.push(id); write(ids); log('Cart.add OK', id); return true;
      },
      all: () => read(),
      clear: () => { log('Cart.clear'); write([]); },
      setOnly: (id) => { log('Cart.setOnly', id); write(id ? [String(id)] : []); }
    };
  })();

  // =====================
  // Auth helpers
  // =====================
  async function getAuth() {
    log('getAuth() refresh sesión…');
    try {
      const s = await (window.Auth?.refresh?.() || Promise.resolve({}));
      const out = { isAuth: !!s?.authenticated, uid: s?.uid ?? sessionStorage.getItem('uid') ?? null };
      log('getAuth() ->', out);
      return out;
    } catch (e) {
      const out = { isAuth: false, uid: sessionStorage.getItem('uid') ?? null };
      warn('getAuth() error -> asumiendo NO auth', e, out);
      return out;
    }
  }

  function buildCartUrl({ pid, ids, uid }) {
    const u = new URL('miCarrito.html', location.origin);
    if (pid) u.searchParams.set('pid', String(pid));
    if (ids?.length) u.searchParams.set('ids', ids.map(String).join(','));
    if (uid) u.searchParams.set('uid', String(uid));
    const href = u.pathname + u.search + u.hash;
    log('buildCartUrl ->', href);
    return href;
  }

  function safeGo(href) {
    log('Navegando a:', href);
    try { location.assign(href); }
    catch (e) { err('location.assign fallo, fallback href', e); location.href = href; }
  }

  // =====================
  // Utilidades UI
  // =====================
  function slugify(str) {
    return String(str || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function getPidFromTarget(target) {
    const btn = target?.closest?.('button[data-id]');
    if (btn?.dataset?.id) { log('pid por button[data-id]:', btn.dataset.id); return btn.dataset.id; }
    const card = target?.closest?.('.offer-card');
    if (card?.dataset?.id) { log('pid por .offer-card[data-id]:', card.dataset.id); return card.dataset.id; }
    warn('getPidFromTarget: no se encontró pid');
    return null;
  }

  // =====================
  // Acciones
  // =====================
  async function onBuyNow(pid) {
    log('CLICK "Comprar ahora"', { pid });
    if (!pid) { warn('Comprar ahora SIN pid'); alert('No se encontró el id del producto.'); return; }
    const { isAuth, uid } = await getAuth();

    if (!isAuth) {
      warn('No hay sesión -> solicitando login');
      const pending = buildCartUrl({ pid });
      try { sessionStorage.setItem('postLoginRedirect', pending); log('postLoginRedirect guardado:', pending); } catch {}
      window.dispatchEvent(new CustomEvent('auth:login-required'));
      return;
    }
    const href = buildCartUrl({ pid, uid });
    log('Con sesión -> redirigir', href);
    safeGo(href);
  }

  function onAddToCart(pid, btnEl) {
    log('CLICK "Agregar al carrito"', { pid });
    if (!pid) { warn('Agregar SIN pid'); alert('No se encontró el id del producto.'); return; }
    if (Cart.has(pid)) { warn('Ya en el carrito', pid); alert('Ya en el carrito'); return; }
    Cart.add(pid);
    if (btnEl) {
      const txt = btnEl.textContent; btnEl.disabled = true; btnEl.textContent = 'Agregado ✓';
      log('Feedback botón aplicado');
      setTimeout(() => { btnEl.disabled = false; btnEl.textContent = txt; log('Feedback botón restaurado'); }, 900);
    } else {
      warn('No se encontró botón para feedback');
    }
  }

  async function gotoCartFromAnywhere(ev) {
    log('CLICK ir al carrito (navbar/menú)');
    if (!window.Auth?.state?.authenticated) { log('Sin sesión (loginModal debe abrir)'); return; }
    ev?.preventDefault?.();
    const { uid } = await getAuth();
    const ids = Cart.all();
    const href = buildCartUrl({ ids, uid });
    log('Ir al carrito ->', href, { ids, uid });
    safeGo(href);
  }

  // Reanudar después del login
  window.addEventListener('auth:status-changed', (ev) => {
    const isLogged = !!ev?.detail?.isLoggedIn || window.Auth?.state?.authenticated;
    log('auth:status-changed', { isLogged, state: window.Auth?.state });
    if (!isLogged) return;

    const pending = sessionStorage.getItem('postLoginRedirect');
    log('postLoginRedirect actual:', pending);
    if (pending && /miCarrito\.html/i.test(pending)) {
      try { sessionStorage.removeItem('postLoginRedirect'); log('postLoginRedirect eliminado'); } catch {}
      const uid = sessionStorage.getItem('uid');
      try {
        const u = new URL(pending, location.origin);
        if (uid && !u.searchParams.has('uid')) { u.searchParams.set('uid', uid); log('UID añadido al redirect', uid); }
        safeGo(u.pathname + u.search + u.hash);
      } catch (e) {
        warn('URL pending inválida, fallback crudo', e);
        safeGo(pending);
      }
    }
  });

  // =====================
  // Arranque
  // =====================
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded');

    // 1) Grilla y data-id
    const grid = document.querySelector('.ofertas-grid');
    if (!grid) { warn('No existe .ofertas-grid'); }
    else {
      const cards = [...grid.querySelectorAll('.offer-card')];
      if (!cards.length) warn('No hay .offer-card dentro de la grilla');
      cards.forEach((card, i) => {
        if (!card.dataset.id) {
          const title = card.querySelector('.offer-title')?.textContent?.trim();
          const pid = title ? `slug-${slugify(title)}` : `static-${i+1}`;
          card.dataset.id = pid;
          card.querySelectorAll('button.btn-buy, button.btn-ad-to-cart').forEach(b => b.dataset.id = pid);
          log('Asignado data-id a card:', pid);
        }
      });

      grid.addEventListener('click', async (e) => {
        log('Click en .ofertas-grid', { target: e?.target?.tagName, class: e?.target?.className });
        const buyBtn = e.target.closest('button.btn-buy');
        const addBtn = e.target.closest('button.btn-ad-to-cart'); // nombre exacto del HTML
        if (!buyBtn && !addBtn) { log('Click ignorado (no buy/add)'); return; }
        const pid = getPidFromTarget(e.target);
        if (buyBtn) await onBuyNow(pid);
        if (addBtn) onAddToCart(pid, addBtn);
      });
    }

    // 2) Ícono navbar
    const navCart = document.querySelector('.nav-cart-icon');
    if (navCart) { log('Conectado .nav-cart-icon'); navCart.addEventListener('click', gotoCartFromAnywhere); }
    else { warn('No existe .nav-cart-icon'); }

    // 3) Enlaces laterales a miCarrito.html
    document.querySelectorAll('a[href="miCarrito.html"]').forEach(a => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const { isAuth } = await getAuth();
        if (!isAuth) {
          warn('Mi carrito sin sesión -> login');
          window.dispatchEvent(new CustomEvent('auth:login-required'));
          return;
        }
        gotoCartFromAnywhere(e);
      });
    });

    log('Carrito inicial:', Cart.all());
  });

  // Errores globales
  window.addEventListener('error', (e) => err('Global error:', e?.message, e?.filename, e?.lineno, e?.colno));
  window.addEventListener('unhandledrejection', (e) => err('Unhandled promise rejection:', e?.reason));
})();
