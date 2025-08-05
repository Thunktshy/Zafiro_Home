import { showError } from "./showError.js";

document.addEventListener('DOMContentLoaded', () => {
  // 1. ELEMENTS
  const cartLink   = document.querySelector('.nav-cart-icon');
  const loginLink  = document.querySelector('.nav-iniciar-sesion');
  const modal      = document.getElementById('loginmodal');
  const closeBtn   = modal.querySelector('.btn-close');
  const loginForm  = document.getElementById('form-login');

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
    document.getElementById('error-message').style.display = 'none';
  }

  // 3. LOGIN STATE
  // ► Replace with real check; for demo we start as “not logged in”
  const isLoggedIn = false;
  if (isLoggedIn) {
    upgradeNavForLoggedIn();
  }

  // 4. EVENT LISTENERS

  // Cart: block if not logged in, otherwise go to miCarrito.html
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
    } else {
      upgradeNavForLoggedIn();
      // let the link navigate naturally
    }
  });

  // Modal-overlay click closes ilogin Modal
  modal.addEventListener('click', e => {
    if (e.target === modal) closeLoginModal();
  });

  // “X” button closes login Modal
  closeBtn.addEventListener('click', closeLoginModal);

  // Fake login demo
  loginForm.onsubmit = ev => {
    ev.preventDefault();
    const user = loginForm.Usuario.value.trim();
    const pass = loginForm.Contraseña.value.trim();

    if (!user || !pass) {
      showError("Por favor llena todos los campos.");
    } else if (user === 'admin' && pass === 'zafiro123') {
      alert("¡Bienvenido/a, admin! (Demo: No navega)");
    } else {
      showError("Credenciales no válidas.");
    }
  };
});


