// /scripts/loginModal.js
import { tryLogin } from "./database/login.js";
import { showError } from "./showError.js";

document.addEventListener('DOMContentLoaded', async () => {
  // 1. ELEMENTS
  const cartLink   = document.querySelector('.nav-cart-icon');
  const loginLink  = document.querySelector('.nav-iniciar-sesion'); 
  const modal      = document.getElementById('loginmodal');
  const closeBtn   = modal?.querySelector('.btn-close');
  const loginForm  = document.getElementById('form-login');
  const errorBox   = document.getElementById('error-message-box');

  // 2. HELPERS
  function upgradeNavForLoggedIn() {
    const name = (sessionStorage.getItem('username') || '').trim();
    if (loginLink) {
      loginLink.textContent = name || 'Mi cuenta';
      loginLink.href        = 'miCuenta.html';
      loginLink.title       = name ? `Sesión de ${name}` : 'Mi cuenta';
    }
    if (cartLink) cartLink.href = 'miCarrito.html';
  }
  function showLoginModal() {
    if (!modal) return;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.querySelector('input[type="text"]')?.focus(), 200);
  }
  function closeLoginModal() {
    if (!modal) return;
    modal.classList.remove('show');
    document.body.style.overflow = '';
    if (errorBox) errorBox.style.display = 'none';
  }

  // 3. LOGIN STATE (initialize from server)
  let isLoggedIn = false;
  try {
    const r = await fetch('/auth/status', { credentials: 'include', cache: 'no-store' });
    if (r.ok) {
      const s = await r.json();
      isLoggedIn = !!s.authenticated;
      // Si el backend provee username/isAdmin aquí, persístelos
      if (isLoggedIn) {
        try {
          if (s.username) sessionStorage.setItem('username', s.username);
          if (typeof s.isAdmin === 'boolean') sessionStorage.setItem('isAdmin', String(s.isAdmin));
        } catch {}
        upgradeNavForLoggedIn();
      }
    }
  } catch { /* ignore */ }

  // 4. EVENT LISTENERS
  cartLink?.addEventListener('click', e => {
    if (!isLoggedIn) { e.preventDefault(); showLoginModal(); }
  });
  loginLink?.addEventListener('click', e => {
    if (!isLoggedIn) { e.preventDefault(); showLoginModal(); }
  });
  modal?.addEventListener('click', e => { if (e.target === modal) closeLoginModal(); });
  closeBtn?.addEventListener('click', closeLoginModal);

  loginForm?.addEventListener('submit', async ev => {
    ev.preventDefault();

    // Usa elements[] para evitar problemas con nombres con acentos
    const username = loginForm.elements['Usuario']?.value?.trim();
    const password = loginForm.elements['Contraseña']?.value?.trim();

    if (!username || !password) {
      showError("Por favor llena todos los campos.");
      return;
    }

    try {
      const loginResult = await tryLogin(username, password);
      console.log(loginResult); 
     
      if (!loginResult?.success) {
        showError(loginResult?.message || "Inicio de sesión fallido. Verifique su usuario y contraseña.");
        return;
      }

      // Éxito
      isLoggedIn = true;

      // Persistir username e isAdmin (el backend ya manda 'Bienvenido' por defecto)
      const safeName = loginResult.username || 'Bienvenido';
      try {
        sessionStorage.setItem('username', safeName);
        sessionStorage.setItem('isAdmin', String(loginResult.isAdmin === true));
      } catch {}

      // Redirección prioritaria desde el servidor (admin/cliente)
      if (loginResult.redirect) {
        window.location.assign(loginResult.redirect);
        return;
      }

      // Fallback: redirige por isAdmin
      if (loginResult.isAdmin) {
        window.location.assign('/admin-resources/pages/admin.html');
        return;
      }

      // Fallback final: permanecer y actualizar UI
      upgradeNavForLoggedIn();
      loginForm.reset();
      closeLoginModal();
      window.dispatchEvent(new CustomEvent('auth:status-changed', {
        detail: { isLoggedIn: true, isAdmin: loginResult.isAdmin === true, username: safeName }
      }));

    } catch (error) {
      const msg = (String(error?.message || '').includes("500"))
        ? "No hay conexión con la base de datos"
        : ("Error while trying to log in: " + (error?.message || error));
      showError(msg);
    }
  });
});


