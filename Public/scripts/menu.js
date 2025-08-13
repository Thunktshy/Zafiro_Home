// /scripts/menu.js 

(() => {
  const BLOCK_DRAWER_WHEN_LOGGED_OUT = true; // Precaución: bloquear apertura del drawer sin sesión

  // Elementos principales
  const menuBtn  = document.getElementById("menu");        // botón hamburguesa
  const drawer   = document.getElementById("hm-drawer");
  const overlay  = document.getElementById("hm-overlay");
  const closeBtn = drawer?.querySelector(".hm-close");

  if (!menuBtn || !drawer || !overlay || !closeBtn) return;

  // A11y básico
  menuBtn.setAttribute("role", "button");
  menuBtn.setAttribute("tabindex", "0");
  menuBtn.setAttribute("aria-label", "Abrir menú");

  let lastFocused = null;
  const focusableSelector = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    '[tabindex]:not([tabindex="-1"])', 'select:not([disabled])', 'textarea:not([disabled])'
  ].join(',');

  // ------------- Utils comunes -------------
  function appendUid(url, uid) {
    if (window.Auth?.appendUid) return window.Auth.appendUid(url, uid);
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

  function isAuthRequiredLink(a) {
    const href = (a.getAttribute("href") || "").trim();
    if (a.dataset.requiresAuth === "true") return true;
    const ends = (suffix) => href.endsWith(suffix);
    // Lista blanca de páginas de cliente
    return href.includes("/client-resources/")
        || ends("miCuenta.html")
        || ends("miCarrito.html")
        || ends("comprasRecientes.html")
        || ends("direccionesEnvio.html")
        || ends("metodosPago.html")
        || ends("pages/facturacion.html")
        || ends("./pages/facturacion.html");
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const nodes = drawer.querySelectorAll(focusableSelector);
    if (!nodes.length) return;
    const first = nodes[0];
    const last  = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function openClasses() {
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    overlay.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("hm-locked");
  }
  function closeClasses() {
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("hm-locked");
    setTimeout(() => { overlay.hidden = true; }, 200);
  }

  // ------------- Hidratar contenido del drawer según estado -------------
  function rewriteAuthLinksLoggedOut() {
    drawer.querySelectorAll("a[href]").forEach(a => {
      if (!isAuthRequiredLink(a)) return;
      const href = a.getAttribute("href") || "#";
      if (!a.dataset.hrefAuthOrig) a.dataset.hrefAuthOrig = href;
      a.setAttribute("href", "#");
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("title", "Inicia sesión para acceder");
    });
  }

  function rewriteAuthLinksLoggedIn(uid) {
    drawer.querySelectorAll("a[href]").forEach(a => {
      if (!isAuthRequiredLink(a)) return;
      const base = a.dataset.hrefAuthOrig || a.getAttribute("href") || "";
      const withUid = appendUid(base, uid) || base;
      a.setAttribute("href", withUid);
      a.removeAttribute("aria-disabled");
      a.removeAttribute("title");
    });
  }

  function ensureUserActions(state) {
    const header = drawer.querySelector(".hm-header");
    if (!header) return;

    let actions = header.querySelector(".hm-user-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "hm-user-actions";
      actions.style.marginTop = "8px";
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.flexWrap = "wrap";
      header.appendChild(actions);
    }
    actions.innerHTML = "";

    const nameEl = drawer.querySelector("#hm-username");
    const displayName = (state?.username || sessionStorage.getItem("username") || "username");
    if (nameEl) nameEl.textContent = displayName;

    if (state?.authenticated) {
      // Mi cuenta
      const a = document.createElement("a");
      a.textContent = "Mi cuenta";
      a.href = appendUid("/client-resources/pages/miCuenta.html", state?.uid) || "/client-resources/pages/miCuenta.html";
      a.className = "hm-link-account";
      actions.appendChild(a);

      // Cerrar sesión
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Cerrar sesión";
      btn.className = "hm-btn-logout";
      btn.addEventListener("click", async () => {
        try {
          await (window.Auth?.logout?.({ redirectTo: "/index.html" }) || Promise.resolve());
        } catch {}
      });
      actions.appendChild(btn);
    } else {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Iniciar sesión";
      b.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("auth:login-required"));
      });
      actions.appendChild(b);
    }
  }

  async function hydrateDrawer() {
    const s = await (window.Auth?.refresh?.() || Promise.resolve({}));
    ensureUserActions(s);
    if (s?.authenticated) rewriteAuthLinksLoggedIn(s?.uid);
    else rewriteAuthLinksLoggedOut();
  }

  // ------------- Apertura / cierre del drawer -------------
  async function openDrawer() {
    const s = await (window.Auth?.refresh?.() || Promise.resolve({ authenticated: false }));
    if (BLOCK_DRAWER_WHEN_LOGGED_OUT && !s.authenticated) {
      // Precaución: sin sesión, no abrir; mostrar login
      window.dispatchEvent(new CustomEvent("auth:login-required"));
      return;
    }

    lastFocused = document.activeElement;
    await hydrateDrawer();
    openClasses();

    document.addEventListener("keydown", onKeyDown);
    drawer.addEventListener("keydown", trapFocus);

    const firstFocusable = drawer.querySelector(focusableSelector) || closeBtn;
    firstFocusable?.focus?.();
  }

  function closeDrawer() {
    closeClasses();
    document.removeEventListener("keydown", onKeyDown);
    drawer.removeEventListener("keydown", trapFocus);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") closeDrawer();
  }

  // ------------- Listeners base -------------
  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openDrawer();
  });
  menuBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(); }
  });
  overlay.addEventListener("click", closeDrawer);
  closeBtn.addEventListener("click", closeDrawer);

  // Toggler de submenús (solo visual; los enlaces igualmente están protegidos)
  drawer.querySelectorAll(".hm-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const sub = btn.nextElementSibling;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      if (sub) sub.hidden = expanded;
    });
  });

  // ------------- Guard adicional: interceptar enlaces del drawer si no hay sesión -------------
  drawer.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;

    // Si el enlace requiere auth y no hay sesión, abrir login y bloquear
    if (isAuthRequiredLink(a) && !(window.Auth?.state?.authenticated)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent("auth:login-required"));
    }
  });

  // ------------- Reaccionar a cambios de auth -------------
  // Si se inicia/cierra sesión, re-hidratar el drawer si está abierto.
  window.addEventListener("auth:status-changed", async (ev) => {
    const isOpen = drawer.classList.contains("is-open");
    if (!isOpen) return;
    await hydrateDrawer();
  });

  // Si el usuario cierra el modal sin loguearse, aseguremos estado bloqueado
  window.addEventListener("auth:login-cancelled", () => {
    const s = window.Auth?.state;
    if (s?.authenticated) return;
    // Reescribir a modo bloqueado si el drawer está abierto
    if (drawer.classList.contains("is-open")) {
      rewriteAuthLinksLoggedOut();
      ensureUserActions({ authenticated: false });
    }
  });

  // Hidratación inicial suave (por si el drawer arranca abierto por CSS)
  (async () => {
    if (drawer.classList.contains("is-open")) await hydrateDrawer();
  })();
})();
