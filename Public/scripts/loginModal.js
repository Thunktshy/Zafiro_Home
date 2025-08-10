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
  const errorBox   = document.getElementById('error-message-box'); // <- corrected id

  // 2. HELPERS
  function upgradeNavForLoggedIn() {
    if (loginLink) {
      loginLink.textContent = 'Mi cuenta';
      loginLink.href        = 'miCuenta.html';
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
      if (isLoggedIn) upgradeNavForLoggedIn();
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
    const username = loginForm.Usuario.value.trim();
    const password = loginForm.Contraseña.value.trim();

    if (!username || !password) {
      showError("Por favor llena todos los campos.");
      return;
    }

    try {
      const loginResult = await tryLogin(username, password);
      if (loginResult?.success) {
        isLoggedIn = true;
        upgradeNavForLoggedIn();
        loginForm.reset();
        closeLoginModal();

        // notify everyone (hamburger menu will refresh)
        window.dispatchEvent(new CustomEvent('auth:status-changed'));

        // Optionally: redirect admins here if you want
        // if (loginResult.isAdmin) window.location.href = '/admin-resources/admin.html';
      } else {
        showError(loginResult?.message || "Inicio de sesión fallido. Verifique su usuario y contraseña.");
      }
    } catch (error) {
      const msg = (error?.message?.includes("500"))
        ? "No hay conexión con la base de datos"
        : ("Error while trying to log in: " + (error?.message || error));
      showError(msg);
    }
  });
});
