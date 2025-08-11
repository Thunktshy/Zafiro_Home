// /scripts/menu.js
// Sidebar/drawer protegido. Inyecta UID en links y agrega "Cerrar sesión" bajo el username.

(() => {
  // Elementos del drawer (ver index.html) :contentReference[oaicite:9]{index=9}
  const menuBtn = document.getElementById("menu");         // el botón hamburguesa (li con id="menu")
  const drawer  = document.getElementById("hm-drawer");
  const overlay = document.getElementById("hm-overlay");
  const closeBtn = drawer?.querySelector(".hm-close");

  if (!menuBtn || !drawer || !overlay || !closeBtn) return;

  // A11y básico
  menuBtn.setAttribute("role", "button");
  menuBtn.setAttribute("tabindex", "0");
  menuBtn.setAttribute("aria-label", "Abrir menú");

  let lastFocused = null;
  const focusableSelector = [
    'a[href]','button:not([disabled])','input:not([disabled])',
    '[tabindex]:not([tabindex="-1"])','select:not([disabled])','textarea:not([disabled])'
  ].join(',');

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

  async function openDrawer() {
    lastFocused = document.activeElement;
    openClasses();

    // Refresca estado de auth al abrir el drawer (usa /auth/status y sessionStorage)
    const s = await (window.Auth?.refresh?.() || Promise.resolve({}));
    const name = s?.username || sessionStorage.getItem("username") || "username";
    const uEl = document.getElementById("hm-username");    // donde imprimimos el nombre :contentReference[oaicite:10]{index=10}
    if (uEl && name) uEl.textContent = name;

    // Crea/actualiza acciones bajo el username (Mi cuenta / Cerrar sesión)
    ensureUserActions(s);

    // Reescribe enlaces de cliente con ?uid=...
    hydrateDrawerLinks(s?.uid);

    document.addEventListener("keydown", onKeyDown);
    drawer.addEventListener("keydown", trapFocus);

    // foco al primer elemento interactivo
    const firstFocusable = drawer.querySelector(focusableSelector) || closeBtn;
    firstFocusable.focus();
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

  menuBtn.addEventListener("click", openDrawer);
  menuBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDrawer(); }
  });
  overlay.addEventListener("click", closeDrawer);
  closeBtn.addEventListener("click", closeDrawer);

  // Toggler de submenús
  drawer.querySelectorAll(".hm-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const sub = btn.nextElementSibling;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      if (sub) sub.hidden = expanded;
    });
  });

  // ——— Utils ———
  function appendUid(url, uid) {
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

  function hydrateDrawerLinks(uid) {
    if (!uid) return;
    // Enlaces que vi en tu index.html (miCarrito, comprasRecientes, direccionesEnvio, metodosPago, pages/facturacion)
    // :contentReference[oaicite:11]{index=11} :contentReference[oaicite:12]{index=12} :contentReference[oaicite:13]{index=13}
    const whitelist = [
      "miCuenta.html",
      "miCarrito.html",
      "comprasRecientes.html",
      "direccionesEnvio.html",
      "metodosPago.html",
      "./pages/facturacion.html",
      "pages/facturacion.html"
    ];
    drawer.querySelectorAll("a[href]").forEach(a => {
      const href = a.getAttribute("href") || "";
      if (a.dataset.requiresAuth === "true" || whitelist.some(w => href.endsWith(w))) {
        a.setAttribute("href", appendUid(href, uid));
      }
    });
  }

  function ensureUserActions(s) {
    // Crea un contenedor debajo del encabezado del drawer,
    // justo después del bloque .hm-user
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

    // Link a "Mi cuenta" si hay sesión
    if (s?.authenticated) {
      const a = document.createElement("a");
      a.textContent = "Mi cuenta";
      a.href = appendUid("miCuenta.html", s?.uid);
      a.className = "hm-link-account";
      actions.appendChild(a);

      // Botón de Cerrar sesión
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Cerrar sesión";
      btn.className = "hm-btn-logout";
      btn.addEventListener("click", async () => {
        try {
          // Llama a Auth.logout para limpiar storage y cerrar sesión en backend
          await (window.Auth?.logout?.({ redirectTo: "/index.html" }) || Promise.resolve());
        } catch {}
      });
      actions.appendChild(btn);
    } else {
      // Si no hay sesión, muestra "Iniciar sesión"
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Iniciar sesión";
      b.addEventListener("click", () => window.dispatchEvent(new CustomEvent("auth:login-required")));
      actions.appendChild(b);
    }
  }

  // Intercepta clicks en enlaces de cliente si no hay sesión: abre modal
  drawer.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const requires = a.dataset.requiresAuth === "true";
    const isClientPage = requires || href.includes("/client-resources/") || [
      "miCuenta.html",
      "miCarrito.html",
      "comprasRecientes.html",
      "direccionesEnvio.html",
      "metodosPago.html",
      "pages/facturacion.html",
      "./pages/facturacion.html"
    ].some(w => href.endsWith(w));

    if (isClientPage && !(window.Auth?.state?.authenticated)) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("auth:login-required"));
    }
  });
})();
