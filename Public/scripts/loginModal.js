// /scripts/loginModal.js
// Requiere: tryLogin (POST /login) y showError (UI)
import { tryLogin } from "./database/login.js";
import { showError } from "./showError.js";

// Utilidad global para otras páginas (nav, formularios, etc.)
const Auth = (() => {
  const state = {
    authenticated: false,
    isAdmin: false,
    isClient: false,
    username: null,
    uid: null
  };

  const keys = ["username", "isAdmin", "isClient", "uid"];

  function persist() {
    try {
      sessionStorage.setItem("username", state.username ?? "");
      sessionStorage.setItem("isAdmin", String(!!state.isAdmin));
      sessionStorage.setItem("isClient", String(!!state.isClient));
      if (state.uid != null) sessionStorage.setItem("uid", String(state.uid));
    } catch {}
  }

  function readFromSession() {
    try {
      state.username = sessionStorage.getItem("username") || null;
      state.isAdmin = (sessionStorage.getItem("isAdmin") === "true");
      state.isClient = (sessionStorage.getItem("isClient") === "true");
      const suid = sessionStorage.getItem("uid");
      state.uid = suid != null && suid !== "" ? suid : null;
    } catch {}
  }

  function clear() {
    try { keys.forEach(k => sessionStorage.removeItem(k)); } catch {}
    state.authenticated = false;
    state.isAdmin = false;
    state.isClient = false;
    state.username = null;
    state.uid = null;
  }

  async function refresh() {
    try {
      const r = await fetch("/auth/status", { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error("status http " + r.status);
      const s = await r.json();
      state.authenticated = !!s.authenticated;
      state.username = s?.username || null;
      state.isAdmin = !!s?.isAdmin;
      // Estos dos campos son opcionales si ya los expusiste en backend:
      state.isClient = s?.isClient === true || state.isClient;
      if (s?.userID != null) state.uid = String(s.userID);

      persist();
      return { ...state };
    } catch {
      // si hay error, intenta con sessionStorage
      readFromSession();
      return { ...state };
    }
  }

  function appendUid(url, uid = state.uid) {
    if (!url || !uid) return url;
    try {
      const u = new URL(url, location.origin);
      u.searchParams.set("uid", String(uid));
      return u.pathname + u.search + u.hash;
    } catch {
      const sep = url.includes("?") ? "&" : "?";
      return url + sep + "uid=" + encodeURIComponent(uid);
    }
  }

  function ensureHiddenUidInput(form, uid = state.uid) {
    if (!form || !uid) return;
    let hidden = form.querySelector('input[type="hidden"][name="uid"]');
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "uid";
      form.appendChild(hidden);
    }
    hidden.value = String(uid);
  }

  async function logout({ redirectTo = "/" } = {}) {
    try {
      await fetch("/logout", { method: "POST", credentials: "include" });
    } catch {}
    clear();
    window.dispatchEvent(new CustomEvent("auth:status-changed", {
      detail: { isLoggedIn: false, isAdmin: false, isClient: false, username: null, uid: null }
    }));
    // vuelve a home pública
    location.assign(redirectTo);
  }

  return { state, refresh, appendUid, ensureHiddenUidInput, logout };
})();

// Expón para otros módulos/páginas
window.Auth = Auth;

document.addEventListener("DOMContentLoaded", async () => {
  // ELEMENTOS (según tu index.html)
  const cartLink  = document.querySelector(".nav-cart-icon");
  const loginLink = document.querySelector(".nav-iniciar-sesion");
  const modal     = document.getElementById("loginmodal");         // :contentReference[oaicite:6]{index=6}
  const closeBtn  = modal?.querySelector(".btn-close");
  const loginForm = document.getElementById("form-login");         // :contentReference[oaicite:7]{index=7}
  const errorBox  = document.getElementById("error-message-box");

  function showLoginModal() {
    if (!modal) return;
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
    setTimeout(() => modal.querySelector('input[type="text"]')?.focus(), 150);
  }
  function closeLoginModal() {
    if (!modal) return;
    modal.classList.remove("show");
    document.body.style.overflow = "";
    if (errorBox) errorBox.style.display = "none";
  }

  // Mejora navbar al tener sesión
  function upgradeNavForLoggedIn(uid) {
    const name = (sessionStorage.getItem("username") || "").trim();
    if (loginLink) {
      loginLink.textContent = name || "Mi cuenta";
      loginLink.title = name ? `Sesión de ${name}` : "Mi cuenta";
      // si existe una página de cuenta local, ajusta aquí:
      loginLink.href = Auth.appendUid("miCuenta.html", uid);
    }
    if (cartLink) {
      cartLink.href = Auth.appendUid("miCarrito.html", uid);
    }
  }

  // Inicializa estado de auth
  let { authenticated, uid } = await Auth.refresh();
  if (authenticated) upgradeNavForLoggedIn(uid);

  // Pide login si el usuario intenta entrar a áreas protegidas
  cartLink?.addEventListener("click", e => {
    if (!Auth.state.authenticated) { e.preventDefault(); showLoginModal(); }
  });
  loginLink?.addEventListener("click", e => {
    // Si es link al perfil, exige login
    if (!Auth.state.authenticated) { e.preventDefault(); showLoginModal(); }
  });
  window.addEventListener("auth:login-required", showLoginModal);
  modal?.addEventListener("click", e => { if (e.target === modal) closeLoginModal(); });
  closeBtn?.addEventListener("click", closeLoginModal);

  // SUBMIT LOGIN
  loginForm?.addEventListener("submit", async ev => {
    ev.preventDefault();
    const username = loginForm.elements["Usuario"]?.value?.trim();
    const password = loginForm.elements["Contraseña"]?.value?.trim();
    if (!username || !password) {
      showError("Por favor llena todos los campos.");
      return;
    }

    try {
      const result = await tryLogin(username, password); // devuelve { success, message, isAdmin, username, redirect, ... } :contentReference[oaicite:8]{index=8}
      if (!result?.success) {
        showError(result?.message || "Inicio de sesión fallido.");
        return;
      }

      // Actualiza estado local (el backend puede enviar isClient y userID si ya lo agregaste)
      Auth.state.authenticated = true;
      Auth.state.isAdmin = !!result.isAdmin;
      Auth.state.username = result.username || "Bienvenido";

      // Intenta obtener isClient/uid frescos
      const fresh = await Auth.refresh();
      uid = fresh.uid;

      // Persiste y actualiza UI
      upgradeNavForLoggedIn(uid);
      try {
        sessionStorage.setItem("username", Auth.state.username);
        sessionStorage.setItem("isAdmin", String(Auth.state.isAdmin));
        if (typeof fresh.isClient === "boolean") sessionStorage.setItem("isClient", String(fresh.isClient));
        if (uid != null) sessionStorage.setItem("uid", String(uid));
      } catch {}

      // Redirección prioritaria del backend, pero agregando ?uid=...
      if (result.redirect) {
        const target = Auth.appendUid(result.redirect, uid);
        location.assign(target);
        return;
      }

      // Fallback por tipo:
      if (Auth.state.isAdmin) {
        location.assign("/admin-resources/pages/admin.html");
        return;
      }

      // Último recurso: cierra modal y emite evento
      loginForm.reset();
      closeLoginModal();
      window.dispatchEvent(new CustomEvent("auth:status-changed", {
        detail: { isLoggedIn: true, isAdmin: Auth.state.isAdmin, isClient: fresh.isClient, username: Auth.state.username, uid }
      }));

    } catch (error) {
      const msg = (String(error?.message || "").includes("500"))
        ? "No hay conexión con la base de datos"
        : ("Error al iniciar sesión: " + (error?.message || error));
      showError(msg);
    }
  });
});


