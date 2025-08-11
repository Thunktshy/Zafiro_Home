// Public/scripts/forms/newClientForm.js
import { submitNewUser } from '../database/submitNewUser.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('userRegistrationForm');
  if (!form) return;

  // Top-level message box
  const box = document.getElementById('error-message');

  // Field-level error elements
  const eEmail   = document.getElementById('error-email');
  const eUser    = document.getElementById('error-username');
  const ePass    = document.getElementById('error-password');
  const eConfirm = document.getElementById('error-confirmPassword');

  // Inputs
  const iEmail   = document.getElementById('email');
  const iUser    = document.getElementById('username');
  const iPass    = document.getElementById('password');
  const iConfirm = document.getElementById('confirmPassword');

  // Helpers
  const hide = el => { if (el) { el.textContent = ''; el.classList.add('hidden'); } };
  const show = (el, msg) => { if (el) { el.textContent = msg; el.classList.remove('hidden'); } };
  const clearAllErrors = () => {
    hide(box);
    hide(eEmail); hide(eUser); hide(ePass); hide(eConfirm);
  };
  const emailLooksOk = (val) => /^\S+@\S+\.\S+$/.test(val);

  // Basic client-side validation (demo-level)
  function validate() {
    clearAllErrors();

    const email = (iEmail?.value || '').trim();
    const user  = (iUser?.value || '').trim();
    const pass  = iPass?.value || '';
    const conf  = iConfirm?.value || '';

    let ok = true;

    if (!email) { show(eEmail, 'El correo es obligatorio.'); ok = false; }
    else if (!emailLooksOk(email)) { show(eEmail, 'Formato de correo inválido.'); ok = false; }
    else if (email.length > 150) { show(eEmail, 'Máximo 150 caracteres.'); ok = false; }

    if (!user) { show(eUser, 'El usuario es obligatorio.'); ok = false; }
    else if (user.length > 20) { show(eUser, 'Máximo 20 caracteres.'); ok = false; }

    if (!pass) { show(ePass, 'La contraseña es obligatoria.'); ok = false; }
    else if (pass.length < 6) { show(ePass, 'Mínimo 6 caracteres.'); ok = false; }
    else if (pass.length > 255) { show(ePass, 'Máximo 255 caracteres.'); ok = false; }

    if (!conf) { show(eConfirm, 'Confirma tu contraseña.'); ok = false; }
    else if (conf !== pass) { show(eConfirm, 'Las contraseñas no coinciden.'); ok = false; }

    return { ok, values: { email, user, pass } };
  }

  // Clear field error on input
  [iEmail, iUser, iPass, iConfirm].forEach(inp => {
    inp?.addEventListener('input', () => {
      clearAllErrors();
    });
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const { ok, values } = validate();
    if (!ok) return;

    // Build the payload your API expects:
    // { cuenta, contrasena, email }
    const payload = {
      cuenta: values.user,
      contrasena: values.pass,
      email: values.email
    };

    // Disable submit while sending (optional)
    const submitBtn = document.getElementById('submitForm');
    if (submitBtn) submitBtn.disabled = true;

    const res = await submitNewUser(payload);

    if (submitBtn) submitBtn.disabled = false;

    if (res.ok && res.data?.success) {
      // Success: go home
      window.location.href = '/index.html';
      return;
    }

    // Show a friendly error
    const serverMsg = res.data?.message || 'No se pudo registrar. Intenta nuevamente.';
    if (box) {
      box.textContent = serverMsg;
      box.classList.remove('hidden');
    } else {
      alert(serverMsg);
    }
  });
});
