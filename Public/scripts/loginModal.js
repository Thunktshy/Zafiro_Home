// /scripts/loginModal.js (RESCRITO)
// Requiere: tryLogin (POST /login) y showError (UI)
import { tryLogin } from "./database/login.js";
import { showError } from "./showError.js";

// ==================================================
//  Auth mini-SDK (persistencia en sessionStorage)
// ==================================================
const Auth = (() => {
  const state = {
    authenticated: false,
    isAdmin: false,
    isClient: false,
    username: null,
    uid: null,
  };

  const KEYS = ["username", "isAdmin", "isClient", "uid"];

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
      state.isAdmin = sessionStorage.getItem("isAdmin") === "true";
      state.isClient = sessionStorage.getItem("isClient") === "true";
      const suid = sessionStorage.getItem("uid");
      state.uid = suid && suid !== "" ? suid : null;
      state.authenticated = !!(state.isAdmin || state.isClient || state.uid);
    } catch {}
  }

  function clear() {
    try { KEYS.forEach(k => sessionStorage.removeItem(k)); } catch {}
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
      state.isClient = !!s?.isClient;
      state.uid = s?.userID != null ? String(s.userID) : state.uid;
      persist();
      return { ...state };
    } catch {
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
    try { await fetch("/logout", { method: "POST", credentials: "include" }); } catch {}
    clear();
    window.dispatchEvent(new CustomEvent("auth:status-changed", {
      detail: { isLoggedIn: false, isAdmin: false, isClient: false, username: null, uid: null }
    }));
    location.assign(redirectTo);
  }

  return { state, refresh, appendUid, ensureHiddenUidInput, logout };
})();

// Expón para otros módulos/páginas
window.Auth = Auth;

// ==================================================
//  UI helpers del modal
// ==================================================
function bindBackdropClose(modal, closeFn) {
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeFn();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFn();
  });
}

// ==================================================
//  UI: Modal de Login + Bloqueos
// ==================================================
document.addEventListener("DOMContentLoaded", async () => {
  const cartIcon   = document.querySelector(".nav-cart-icon");       // Icono carrito (navbar)
  const loginItem  = document.querySelector(".nav-iniciar-sesion");  // Item "Iniciar Sesión" (li/a)
  const modal      = document.getElementById("loginmodal");
  const closeBtn   = modal?.querySelector(".btn-close") || document.getElementById("btn-close");
  const loginForm  = document.getElementById("form-login");
  const errorBox   = document.getElementById("error-message-box");

  // --- Mostrar/ocultar modal ---
  function showLoginModal() {
    if (!modal) return;
    modal.classList.add("show");
    modal.removeAttribute("aria-hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => modal.querySelector('input[type="text"], input[type="email"], input[name="Usuario"]')?.focus(), 50);
  }
  function closeLoginModal() {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (errorBox) errorBox.style.display = "none";

    // <- Si se cierra sin iniciar sesión, reestablece reglas/UI bloqueada
    if (!Auth.state.authenticated) applyLoggedOutUI();
    // Notifica cancelación (por si otros módulos quieren reaccionar)
    window.dispatchEvent(new CustomEvent("auth:login-cancelled"));
  }

  bindBackdropClose(modal, closeLoginModal);
  closeBtn?.addEventListener("click", closeLoginModal);

  // ==================================================
  //  Aplicadores de UI según estado
  // ==================================================
  function applyLoggedOutUI() {
    // Nav: Iniciar sesión como botón
    if (loginItem) {
      loginItem.textContent = "Iniciar sesión";
      loginItem.title = "Iniciar sesión";
      // Evita navegaciones residuales si fuera <a>
      if ("href" in loginItem) loginItem.setAttribute("href", "#");
      loginItem.onclick = (e) => { e.preventDefault(); showLoginModal(); };
      loginItem.setAttribute("aria-label", "Abrir inicio de sesión");
      loginItem.setAttribute("role", "button");
    }

    // Carrito: deshabilitado visualmente y sin navegación real
    if (cartIcon) {
      cartIcon.setAttribute("href", "#");
      cartIcon.setAttribute("aria-disabled", "true");
      cartIcon.setAttribute("title", "Inicia sesión para ver tu carrito");
    }
  }

  function applyLoggedInUI(uid) {
    const displayName = (sessionStorage.getItem("username") || "").trim() || "Mi cuenta";

    // Nav: Mi cuenta
    if (loginItem) {
      loginItem.textContent = displayName;
      loginItem.title = displayName;
      // Navega a Mi Cuenta
      const target = Auth.appendUid("/client-resources/pages/miCuenta.html", uid) || "/client-resources/pages/miCuenta.html";
      if ("href" in loginItem) loginItem.setAttribute("href", target);
      loginItem.onclick = (e) => {
        e.preventDefault();
        location.assign(target);
      };
    }

    // Carrito: a micarrito con uid
    if (cartIcon) {
      const href = Auth.appendUid("/pages/micarrito.html", uid) || "/pages/micarrito.html";
      cartIcon.setAttribute("href", href);
      cartIcon.removeAttribute("aria-disabled");
      cartIcon.removeAttribute("title");
    }
  }

  // ==================================================
  //  GATES (bloqueos por delegación) — SIEMPRE activos
  // ==================================================
  function gateClick(selector) {
    document.addEventListener("click", (ev) => {
      const el = ev.target.closest(selector);
      if (!el) return;
      if (!Auth.state.authenticated) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        showLoginModal();
      }
    }, { capture: false });
  }
  // Sidebar
  gateClick("#hm-drawer .hm-toggle");
  gateClick("#hm-drawer .hm-sub a");
  // Botones “Comprar ahora”
  gateClick(".btn-buy");
  // Navbar: iniciar sesión y carrito
  gateClick(".nav-iniciar-sesion");
  gateClick(".nav-cart-icon");

  // ==================================================
  //  Estado inicial
  // ==================================================
  const { authenticated } = await Auth.refresh();
  if (authenticated) applyLoggedInUI(Auth.state.uid);
  else applyLoggedOutUI();

  // ==================================================
  //  SUBMIT LOGIN
  // ==================================================
  loginForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const username = loginForm.elements["Usuario"]?.value?.trim();
    const password = loginForm.elements["Contraseña"]?.value?.trim();
    if (!username || !password) {
      showError("Por favor llena todos los campos.");
      return;
    }

    try {
      // /login -> { success, message, isAdmin, isClient, userID, username, redirect }
      const result = await tryLogin(username, password);

      if (!result?.success) {
        showError(result?.message || "Inicio de sesión fallido.");
        return;
      }

      // Marca sesión y refresca estado (para uid/roles)
      Auth.state.authenticated = true;
      Auth.state.isAdmin = !!result.isAdmin;
      Auth.state.isClient = !!result.isClient;
      Auth.state.username = result.username || "Bienvenido";

      const fresh = await Auth.refresh(); // obtiene userID/roles actuales

      // Persistimos para navbar/otras páginas
      try {
        sessionStorage.setItem("username", Auth.state.username);
        sessionStorage.setItem("isAdmin", String(Auth.state.isAdmin));
        sessionStorage.setItem("isClient", String(fresh.isClient));
        if (Auth.state.uid != null) sessionStorage.setItem("uid", String(Auth.state.uid));
      } catch {}

      // Actualiza UI visible a modo logueado
      applyLoggedInUI(Auth.state.uid);

      // Redirección prioritaria que venga del backend
      if (result.redirect) {
        const target = Auth.appendUid(result.redirect, Auth.state.uid) || result.redirect;
        location.assign(target);
        return;
      }

      // Cliente -> Home con uid
      if (fresh.isClient === true || result.isClient === true) {
        const target = Auth.appendUid("/index.html", Auth.state.uid) || "/index.html";
        try {
          const t = new URL(target, location.origin);
          const c = new URL(location.href);
          if (c.pathname === t.pathname && c.search === t.search) {
            location.reload();
          } else {
            location.assign(t.pathname + t.search + t.hash);
          }
        } catch {
          location.assign(target);
        }
        return;
      }

      // Admin -> Panel
      if (Auth.state.isAdmin) {
        location.assign("/admin-resources/pages/admin.html");
        return;
      }

      // Si no hay redirect, cierra el modal y notifica estado
      loginForm.reset();
      closeLoginModal();
      window.dispatchEvent(new CustomEvent("auth:status-changed", {
        detail: {
          isLoggedIn: true,
          isAdmin: Auth.state.isAdmin,
          isClient: fresh.isClient,
          username: Auth.state.username,
          uid: Auth.state.uid
        }
      }));

    } catch (error) {
      const msg = (String(error?.message || "").includes("500"))
        ? "No hay conexión con la base de datos"
        : ("Error al iniciar sesión: " + (error?.message || error));
      showError(msg);
    }
  });
});
