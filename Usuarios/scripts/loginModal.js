import { tryLogin } from "./database/authentication.js";
import { showError } from "./showError.js";

document.addEventListener('DOMContentLoaded', () => {
  // 1. ELEMENTS
  const cartLink   = document.querySelector('.nav-cart-icon');
  const loginLink  = document.querySelector('.nav-iniciar-sesion');
  const modal      = document.getElementById('loginmodal');
  const closeBtn   = modal.querySelector('.btn-close');
  const loginForm  = document.getElementById('form-login');
  const errorMsg   = document.getElementById('error-message');

  // 2. HELPERS
  function upgradeNavForLoggedIn() {
    loginLink.textContent = 'Mi cuenta';
    loginLink.href       = 'miCuenta.html';
    cartLink.href        = 'miCarrito.html';
  }

  function showLoginModal() {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      modal.querySelector('input[type="text"]').focus();
    }, 200);
  }

  function closeLoginModal() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    errorMsg.style.display = 'none';
  }

  // 3. LOGIN STATE
  let isLoggedIn = false;   // ← changed to let

  if (isLoggedIn) {
    upgradeNavForLoggedIn();
  }

  // 4. EVENT LISTENERS

  // Cart: block if not logged in
  cartLink.addEventListener('click', e => {
    if (!isLoggedIn) {
      e.preventDefault();
      showLoginModal();
    }
  });

  // Login link: show modal or go to miCuenta.html
  loginLink.addEventListener('click', e => {
    if (!isLoggedIn) {
      e.preventDefault();
      showLoginModal();
    }
    // else: natural navigation to miCuenta.html
  });

  // Overlay click closes modal
  modal.addEventListener('click', e => {
    if (e.target === modal) closeLoginModal();
  });

  // “X” button closes modal
  closeBtn.addEventListener('click', closeLoginModal);

  // Login form submit
  loginForm.addEventListener('submit', async ev => {
    ev.preventDefault();

    const username = loginForm.Usuario.value.trim();
    const password = loginForm.Contraseña.value.trim();

    // 1) Basic validation
    if (!username || !password) {
      showError("Por favor llena todos los campos.");
      return;
    }

    try {
      // 2) Call API and log response
      const loginResult = await tryLogin(username, password);

      // 3) On success...
      if (loginResult.success) {
          isLoggedIn = true;               // ← flip the flag
          upgradeNavForLoggedIn();         // ← update nav UI
          loginForm.reset();               // ← clear fields
          alert("¡Bienvenido/a, admin! (Demo: No navega)");
      } else if (loginResult) {
        showError(loginResult.message || "Inicio de sesión fallido. Verifique su usuario y contraseña.");
      } else {
        // Si result es indefinido, posiblemente por falta de conexión
        showError("No hay conexión con la base de datos");
      }
    } catch (error) {
        // Si el mensaje de error indica un error 404, muestra el mensaje de error de conexión a la base de datos
        if (error.message && error.message.includes("500")) {
            showError("No hay conexión con la base de datos");
        } else {
            showError("Error while trying to log in: " + error.message);
        }
    }
  });
});
