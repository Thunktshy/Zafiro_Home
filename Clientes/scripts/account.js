// /client-resources/scripts/account.js
// Verifica sesión cliente, gestiona uid (prefijo cl-), rehidrata enlaces, sidebar y logout.

(async () => {
  // ------- helpers -------
  const qs = new URLSearchParams(location.search);
  let uid = qs.get('uid') || sessionStorage.getItem('uid') || null;

  function ensureClPrefix(id) {
    if (!id) return id;
    return id.startsWith('cl-') ? id : `cl-${id.replace(/^cl-?/,'')}`;
  }

  function setUid(id) {
    uid = ensureClPrefix(id);
    if (!uid) return;
    try { sessionStorage.setItem('uid', uid); } catch {}
    // sincroniza la URL si falta el prefijo
    const current = new URL(location.href);
    if (current.searchParams.get('uid') !== uid) {
      current.searchParams.set('uid', uid);
      history.replaceState(null, '', current.pathname + current.search + current.hash);
    }
  }

  function appendUid(url) {
    if (!uid || !url) return url;
    try {
      const u = new URL(url, location.origin);
      u.searchParams.set('uid', uid);
      return u.pathname + u.search + u.hash;
    } catch {
      const sep = url.includes('?') ? '&' : '?';
      return url + sep + 'uid=' + encodeURIComponent(uid);
    }
  }

  function rehydrateLinks(root=document) {
    root.querySelectorAll('a[data-keep-uid="true"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      a.setAttribute('href', appendUid(href));
    });
  }

  function wireSidebarToggles() {
    document.querySelectorAll('.hm-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        const sub = btn.nextElementSibling;
        if (sub) sub.hidden = expanded;
      });
    });
  }

  async function logout() {
    try { await fetch('/logout', { method:'POST', credentials:'include' }); } catch {}
    try {
      ['username','isAdmin','isClient','uid'].forEach(k => sessionStorage.removeItem(k));
    } catch {}
    location.assign('/index.html');
  }

  // ------- flujo -------
  // 1) Asegura uid (y prefijo cl-)
  if (uid) setUid(uid);

  // 2) Verifica sesión/usuario
  let s = null;
  try {
    const r = await fetch('/auth/status', { credentials:'include', cache:'no-store' });
    s = r.ok ? await r.json() : null;
  } catch {}

  const authenticated = !!s?.authenticated;
  const isClient = s?.isClient === true || (s?.userType === 'cliente');
  const serverUid = s?.userID ? String(s.userID) : null;

  if (serverUid && !uid) setUid(serverUid);
  if (!uid && authenticated) {
    console.warn('No se encontró uid; ajusta backend para exponer userID en /auth/status o agrega ?uid=cl-...');
  }

  // Si no hay sesión cliente, vuelve a home para que el modal maneje el login.
  if (!authenticated || !isClient) {
    location.assign('/index.html');
    return;
  }

  // 3) Pinta username y acciones
  const username = s?.username || sessionStorage.getItem('username') || 'Usuario';
  const userEl = document.getElementById('account-username');
  if (userEl) userEl.textContent = username;

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', logout);

  // 4) Rehidrata enlaces con ?uid=cl-…
  rehydrateLinks(document);

  // 5) Sidebar toggles
  wireSidebarToggles();
})();
