// /scripts/bootAuthStatus.js
document.addEventListener('DOMContentLoaded', async () => {
  let status = { username: 'Bienvenido', isAdmin: false, authenticated: false };
  try {
    const r = await fetch('/auth/status', { credentials: 'include', cache: 'no-store' });
    if (r.ok) status = await r.json();
  } catch { /* ignore network errors; keep defaults */ }

  // expose for other scripts
  window.currentUser = {
    username: status.username || 'Bienvenido',
    isAdmin: !!status.isAdmin,
    authenticated: !!status.authenticated
  };

  // paint into the sidebar username spot if present
  const u = document.getElementById('hm-username');
  if (u) u.textContent = window.currentUser.username;

  // keep storage in sync for quick paints (optional)
  try { sessionStorage.setItem('username', window.currentUser.username); } catch {}
});

// optional: refresh username when auth state changes (e.g., after login)
window.addEventListener('auth:status-changed', async () => {
  try {
    const r = await fetch('/auth/status', { credentials: 'include', cache: 'no-store' });
    if (!r.ok) return;
    const s = await r.json();
    const name = s?.username || 'Bienvenido';
    const u = document.getElementById('hm-username');
    if (u) u.textContent = name;
    try { sessionStorage.setItem('username', name); } catch {}
  } catch {}
});
