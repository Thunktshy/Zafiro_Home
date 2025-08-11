// /Public/scripts/carrito.js
// Conecta botones .btn-buy y .btn-ad-to-cart dentro de .ofertas-grid
// Maneja ícono .nav-cart-icon y enlaces a miCarrito.html del menú lateral.
// Genera data-id sintético si falta. Logs muy explícitos en español.
window.DEBUG_CART = window.DEBUG_CART ?? true;

(() => {
  const LP = '[Carrito]';
  const t = () => new Date().toISOString().replace('T', ' ').replace('Z', '');
  const log  = (...a) => { if (window.DEBUG_CART) console.log(t(), LP, ...a); };
  const warn = (...a) => { if (window.DEBUG_CART) console.warn(t(), LP, ...a); };
  const err  = (...a) => console.error(t(), LP, ...a);

  // =====================
  // Carrito (IDs en localStorage)
  // =====================
  const Cart = (() => {
    const KEY = 'tmpCartIds';
    const read = () => {
      try { const raw = localStorage.getItem(KEY); const arr = JSON.parse(raw || '[]'); return Array.isArray(arr) ? arr.map(String) : []; }
      catch (e) { warn('No se pudo leer carrito:', e); return []; }
    };
    const write = (ids) => {
      try { const uniq = [...new Set((ids||[]).map(String))]; localStorage.setItem(KEY, JSON.stringify(uniq)); log('Se guardó carrito:', uniq); }
      catch (e) { err('No se pudo escribir carrito:', e); }
    };
    return {
      has: (id) => { const ok = read().includes(String(id)); log('Cart.has?', id, '->', ok); return ok; },
      add: (id) => {
        id = String(id||'').trim();
        if (!id) { warn('Cart.add sin id'); return false; }
        const ids = read();
        if (ids.includes(id)) { warn('Ya estaba en carrito', id); return false; }
        ids.push(id); write(ids); log('Añadido al carrito', id); return true;
      },
      all: () => read(),
      clear: () => write([]),
      setOnly: (id) => write(id ? [String(id)] : [])
    };
  })();

  // =====================
  // Auth helpers
  // =====================
  async function getAuth() {
    log('Consultando estado de sesión…');
    try {
      const s = await (window.Auth?.refresh?.() || Promise.resolve({}));
      const out = { isAuth: !!s?.authenticated, uid: s?.uid ?? sessionStorage.getItem('uid') ?? null };
      log('Estado de sesión:', out);
      return out;
    } catch (e) {
      warn('No se pudo refrescar sesión, asumiendo no autenticado', e);
      return { isAuth: false, uid: sessionStorage.getItem('uid') ?? null };
    }
  }

  function buildCartUrl({ pid, ids, uid }) {
    const u = new URL('miCarrito.html', location.origin);
    if (pid) u.searchParams.set('pid', String(pid));
    if (ids?.length) u.searchParams.set('ids', ids.map(String).join(','));
    if (uid) u.searchParams.set('uid', String(uid));
    const href = u.pathname + u.search + u.hash;
    log('URL carrito construida:', href);
    return href;
  }

  function safeGo(href) {
    log('Navegando a', href);
    try { location.assign(href); } catch (e) { err('location.assign falló, usando location.href', e); location.href = href; }
  }

  // =====================
  // Utilidades UI
  // =====================
  function slugify(str) {
    return String(str || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // Busca un pid en el DOM del click
  function getPidFromTarget(target) {
    const btn = target?.closest?.('button[data-id]');
    if (btn?.dataset?.id) { log('pid desde button[data-id]:', btn.dataset.id); return btn.dataset.id; }
    const card = target?.closest?.('.offer-card');
    if (card?.dataset?.id) { log('pid desde .offer-card[data-id]:', card.dataset.id); return card.dataset.id; }
    warn('No se encontró pid en el DOM del click');
    return null;
  }

  // =====================
  // Acciones
  // =====================
  async function onBuyNow(pid) {
    log('Se presionó "Comprar ahora"', { pid });
    if (!pid) { warn('Comprar ahora SIN pid'); alert('No se encontró el id del producto.'); return; }

    const { isAuth, uid } = await getAuth();
    if (!isAuth) {
      warn('No se encontró sesión -> pidiendo login');
      const pending = buildCartUrl({ pid });
      try { sessionStorage.setItem('postLoginRedirect', pending); } catch {}
      window.dispatchEvent(new CustomEvent('auth:login-required'));
      return;
    }

    const href = buildCartUrl({ pid, uid });
    safeGo(href);
  }

  function onAddToCart(pid, btnEl) {
    log('Se presionó "Agregar al carrito"', { pid });
    if (!pid) { warn('Agregar al carrito SIN pid'); alert('No se encontró el id del producto.'); return; }
    if (Cart.has(pid)) { warn('Ya en el carrito', { pid }); alert('Ya en el carrito'); return; }

    Cart.add(pid);
    // feedback visual
    if (btnEl) {
      const txt = btnEl.textContent; btnEl.disabled = true; btnEl.textContent = 'Agregado ✓';
      setTimeout(() => { btnEl.disabled = false; btnEl.textContent = txt; }, 900);
    }
  }

  async function gotoCartFromAnywhere(ev) {
    // Este handler lo uso solo si YA está logueado; si no, dejo que loginModal.js intercepte
    if (!window.Auth?.state?.authenticated) { log('Click en carrito sin sesión (loginModal debe abrir)'); return; }
    ev?.preventDefault?.();
    const { uid } = await getAuth();
    const ids = Cart.all();
    const href = buildCartUrl({ ids, uid });
    safeGo(href);
  }

  // Reanudar después del login
  window.addEventListener('auth:status-changed', (ev) => {
    const isLogged = !!ev?.detail?.isLoggedIn || window.Auth?.state?.authenticated;
    log('Evento auth:status-changed', { isLogged });
    if (!isLogged) return;

    const pending = sessionStorage.getItem('postLoginRedirect');
    if (pending && /miCarrito\.html/i.test(pending)) {
      try { sessionStorage.removeItem('postLoginRedirect'); } catch {}
      const uid = sessionStorage.getItem('uid');
      try {
        const u = new URL(pending, location.origin);
        if (uid && !u.searchParams.has('uid')) u.searchParams.set('uid', uid);
        safeGo(u.pathname + u.search + u.hash);
      } catch { safeGo(pending); }
    }
  });

  // =====================
  // Arranque
  // =====================
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded – Iniciando cableado UI');

    // 1) Grilla de ofertas y auto-data-id
    const grid = document.querySelector('.ofertas-grid');
    if (!grid) { warn('No se encontró .ofertas-grid; no se podrán escuchar clicks'); }
    else {
      const cards = [...grid.querySelectorAll('.offer-card')];
      if (!cards.length) warn('La grilla no tiene .offer-card');
      cards.forEach((card, i) => {
        if (!card.dataset.id) {
          const title = card.querySelector('.offer-title')?.textContent?.trim();
          const pid = title ? `slug-${slugify(title)}` : `static-${i+1}`;
          card.dataset.id = pid;
          card.querySelectorAll('button.btn-buy, button.btn-ad-to-cart').forEach(b => b.dataset.id = pid);
          log('Asignado data-id a card:', pid);
        }
      });

      // Delegación de clicks dentro de la grilla
      grid.addEventListener('click', async (e) => {
        const buyBtn = e.target.closest('button.btn-buy');
        const addBtn = e.target.closest('button.btn-ad-to-cart'); // nombre exacto del HTML
        if (!buyBtn && !addBtn) return;

        const pid = getPidFromTarget(e.target);
        if (buyBtn)  await onBuyNow(pid);
        if (addBtn)  onAddToCart(pid, addBtn);
      });
    }

    // 2) Ícono del carrito en navbar (class .nav-cart-icon)
    const navCart = document.querySelector('.nav-cart-icon');
    if (navCart) {
      log('Conectado .nav-cart-icon');
      navCart.addEventListener('click', gotoCartFromAnywhere);
    } else {
      warn('No existe .nav-cart-icon en navbar');
    }

    // 3) Enlaces a miCarrito.html en el menú lateral (hm-drawer)
    document.querySelectorAll('a[href="miCarrito.html"]').forEach(a => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const { isAuth } = await getAuth();
        if (!isAuth) {
          warn('Se presionó "Mi carrito" sin sesión -> pidiendo login');
          window.dispatchEvent(new CustomEvent('auth:login-required'));
          return;
        }
        gotoCartFromAnywhere(e);
      });
    });

    // 4) Estado inicial del carrito
    log('Carrito inicial:', Cart.all());
  });

  // Errores globales
  window.addEventListener('error', (e) => err('Global error:', e?.message, e?.filename, e?.lineno, e?.colno));
  window.addEventListener('unhandledrejection', (e) => err('Unhandled promise rejection:', e?.reason));
})();
