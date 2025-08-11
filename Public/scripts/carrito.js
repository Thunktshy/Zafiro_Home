// /Public/scripts/carrito.js

(() => {
  // =====================
  // Carrito (IDs en localStorage)
  // =====================
  const Cart = (() => {
    const KEY = 'tmpCartIds';
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        const arr = JSON.parse(raw || '[]');
        const out = Array.isArray(arr) ? arr.map(String) : [];
        console.log('leer carrito ->', out);
        return out;
      } catch (e) {
        console.log('error al leer carrito', e);
        return [];
      }
    };
    const write = (ids) => {
      try {
        const uniq = [...new Set((ids || []).map(String))];
        localStorage.setItem(KEY, JSON.stringify(uniq));
        console.log('guardar carrito ->', uniq);
      } catch (e) {
        console.log('error al guardar carrito', e);
      }
    };
    return {
      has: (id) => {
        const ok = read().includes(String(id));
        console.log('carrito contiene?', id, '->', ok);
        return ok;
      },
      add: (id) => {
        id = String(id || '').trim();
        if (!id) { console.log('agregar carrito sin id'); return false; }
        const ids = read();
        if (ids.includes(id)) { console.log('ya estaba en carrito', id); return false; }
        ids.push(id);
        write(ids);
        console.log('agregado al carrito', id);
        return true;
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
    console.log('getAuth: consultando sesion…');
    try {
      const s = await (window.Auth?.refresh?.() || Promise.resolve({}));
      const out = { isAuth: !!s?.authenticated, uid: s?.uid ?? sessionStorage.getItem('uid') ?? null };
      console.log('getAuth: resultado ->', out);
      return out;
    } catch (e) {
      const out = { isAuth: false, uid: sessionStorage.getItem('uid') ?? null };
      console.log('getAuth: error, asumiendo no autenticado ->', out, e);
      return out;
    }
  }

  function buildCartUrl({ pid, ids, uid }) {
    const u = new URL('miCarrito.html', location.origin);
    if (pid) u.searchParams.set('pid', String(pid));
    if (ids?.length) u.searchParams.set('ids', ids.map(String).join(','));
    if (uid) u.searchParams.set('uid', String(uid));
    const href = u.pathname + u.search + u.hash;
    console.log('buildCartUrl ->', href);
    return href;
  }

  function safeGo(href) {
    console.log('navegar ->', href);
    try { location.assign(href); }
    catch (e) { console.log('location.assign fallo, usando location.href', e); location.href = href; }
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
    if (btn?.dataset?.id) { console.log('pid desde button[data-id]:', btn.dataset.id); return btn.dataset.id; }
    const card = target?.closest?.('.offer-card');
    if (card?.dataset?.id) { console.log('pid desde .offer-card[data-id]:', card.dataset.id); return card.dataset.id; }
    console.log('no se encontro data-id en el click');
    return null;
  }

  // =====================
  // Acciones
  // =====================
  async function onBuyNow(pid) {
    console.log('se presiono el boton "comprar ahora"', { pid });
    if (!pid) { console.log('no se encontro el id del producto (pid)'); alert('No se encontró el id del producto.'); return; }

    const { isAuth, uid } = await getAuth();
    if (!isAuth) {
      console.log('no se encontro session -> pidiendo login');
      const pending = buildCartUrl({ pid });
      try { sessionStorage.setItem('postLoginRedirect', pending); console.log('postLoginRedirect guardado', pending); } catch (e) { console.log('no se pudo guardar postLoginRedirect', e); }
      window.dispatchEvent(new CustomEvent('auth:login-required'));
      return;
    }

    const href = buildCartUrl({ pid, uid });
    console.log('comprar ahora con sesion -> redirigir', href);
    safeGo(href);
  }

  function onAddToCart(pid, btnEl) {
    console.log('se presiono el boton "agregar al carrito"', { pid });
    if (!pid) { console.log('no se encontro el id del producto (pid)'); alert('No se encontró el id del producto.'); return; }
    if (Cart.has(pid)) { console.log('ya en el carrito', pid); alert('Ya en el carrito'); return; }

    Cart.add(pid);
    if (btnEl) {
      const txt = btnEl.textContent;
      btnEl.disabled = true;
      btnEl.textContent = 'Agregado ✓';
      console.log('feedback de boton aplicado');
      setTimeout(() => { btnEl.disabled = false; btnEl.textContent = txt; console.log('feedback de boton restaurado'); }, 900);
    } else {
      console.log('no se encontro el boton para feedback');
    }
  }

  async function gotoCartFromAnywhere(ev) {
    console.log('se presiono ir a carrito (icono/enlace)');
    if (!window.Auth?.state?.authenticated) { console.log('no se encontro session (icono), loginModal deberia abrir'); return; }
    ev?.preventDefault?.();
    const { uid } = await getAuth();
    const ids = Cart.all();
    const href = buildCartUrl({ ids, uid });
    console.log('ir a carrito ->', href);
    safeGo(href);
  }

  // Reanudar después del login
  window.addEventListener('auth:status-changed', (ev) => {
    const isLogged = !!ev?.detail?.isLoggedIn || window.Auth?.state?.authenticated;
    console.log('evento auth:status-changed ->', { isLogged });
    if (!isLogged) return;

    const pending = sessionStorage.getItem('postLoginRedirect');
    console.log('postLoginRedirect actual ->', pending);
    if (pending && /miCarrito\.html/i.test(pending)) {
      try { sessionStorage.removeItem('postLoginRedirect'); console.log('postLoginRedirect eliminado'); } catch {}
      const uid = sessionStorage.getItem('uid');
      try {
        const u = new URL(pending, location.origin);
        if (uid && !u.searchParams.has('uid')) { u.searchParams.set('uid', uid); console.log('uid agregado al redirect', uid); }
        safeGo(u.pathname + u.search + u.hash);
      } catch (e) {
        console.log('url pending invalida, navegando crudo', e);
        safeGo(pending);
      }
    }
  });

  // =====================
  // Arranque
  // =====================
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded');

    // 1) Grilla de ofertas y auto-data-id
    const grid = document.querySelector('.ofertas-grid');
    if (!grid) { console.log('no se encontro .ofertas-grid'); }
    else {
      const cards = [...grid.querySelectorAll('.offer-card')];
      if (!cards.length) console.log('no se encontraron .offer-card dentro de .ofertas-grid');
      cards.forEach((card, i) => {
        if (!card.dataset.id) {
          const title = card.querySelector('.offer-title')?.textContent?.trim();
          const pid = title ? `slug-${slugify(title)}` : `static-${i+1}`;
          card.dataset.id = pid;
          card.querySelectorAll('button.btn-buy, button.btn-ad-to-cart').forEach(b => b.dataset.id = pid);
          console.log('no se encontro data-id, se genero uno ->', pid);
        }
      });

      // Delegación de clicks
      grid.addEventListener('click', async (e) => {
        console.log('click dentro de .ofertas-grid', { target: e?.target?.tagName, class: e?.target?.className });
        const buyBtn = e.target.closest('button.btn-buy');
        const addBtn = e.target.closest('button.btn-ad-to-cart'); // nombre exacto
        if (!buyBtn && !addBtn) { console.log('click ignorado: no era boton'); return; }

        const pid = getPidFromTarget(e.target);
        if (pid) console.log('se selecciono el producto', pid);
        else console.log('no se pudo obtener pid del click');

        if (buyBtn)  await onBuyNow(pid);
        if (addBtn)  onAddToCart(pid, addBtn);
      });
    }

    // 2) Icono carrito (navbar)
    const navCart = document.querySelector('.nav-cart-icon');
    if (navCart) {
      console.log('se encontro .nav-cart-icon');
      navCart.addEventListener('click', gotoCartFromAnywhere);
    } else {
      console.log('no se encontro .nav-cart-icon');
    }

    // 3) Enlaces a miCarrito.html (menu lateral)
    const links = [...document.querySelectorAll('a[href="../pages/miCarrito.html"]')];
    console.log('enlaces a miCarrito.html encontrados ->', links.length);
    links.forEach(a => {
      a.addEventListener('click', async (e) => {
        console.log('se presiono el enlace "mi carrito" del menu');
        e.preventDefault();
        const { isAuth } = await getAuth();
        if (!isAuth) {
          console.log('no se encontro session al abrir mi carrito -> pedir login');
          window.dispatchEvent(new CustomEvent('auth:login-required'));
          return;
        }
        gotoCartFromAnywhere(e);
      });
    });

    // 4) Estado inicial del carrito
    console.log('carrito inicial ->', Cart.all());
  });

  // Errores globales visibles
  window.addEventListener('error', (e) => console.log('global error ->', e?.message, e?.filename, e?.lineno, e?.colno));
  window.addEventListener('unhandledrejection', (e) => console.log('unhandled promise rejection ->', e?.reason));
})();
