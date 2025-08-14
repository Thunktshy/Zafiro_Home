// /scripts/carrito.js
// Carrito temporal + logs de prueba para "Comprar ahora" y "Agregar al carrito".

/* =========================
   Helpers: sesión y storage
   ========================= */
const TEMP_CART_KEY = "temProdIds";

function readSession() {
  // Lee exactamente de sessionStorage como pediste
  const isAdmin  = sessionStorage.getItem("isAdmin")  === "true";
  const isClient = sessionStorage.getItem("isClient") === "true";
  const uid      = sessionStorage.getItem("uid") || null;
  const username = sessionStorage.getItem("username") || null;
  return { isAdmin, isClient, uid, username };
}

function readTempIds() {
  try {
    const raw = localStorage.getItem(TEMP_CART_KEY);
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTempIds(arr) {
  try { localStorage.setItem(TEMP_CART_KEY, JSON.stringify(arr)); } catch {}
}

function addToTempCart(productId) {
  const ids = readTempIds();
  const exists = ids.includes(productId);
  if (exists) {
    alert("Ya se encuentra el producto en el carrito temporal");
    // No duplicamos; solo mostramos estado actual.
    console.log("local storage tem prodIds =", ids);
    return { added: false, ids };
  }
  ids.push(productId);
  writeTempIds(ids);
  console.log("se agrego a local storage,  local storage tem prodIds =", ids);
  return { added: true, ids };
}

/* =========================
   Helper: obtener productId
   ========================= */
function getProductIdFromClick(target) {
  // 1) botón con data-id
  const btn = target.closest("[data-id]");
  if (btn?.dataset?.id) return String(btn.dataset.id);

  // 2) card con data-id
  const card = target.closest(".offer-card");
  if (card?.dataset?.id) return String(card.dataset.id);

  // 3) último recurso: atributo data-id directo
  const any = target.getAttribute?.("data-id");
  return any ? String(any) : null;
}

/* =========================
   Delegación de clicks
   ========================= */
document.addEventListener("click", (ev) => {
  const buyBtn = ev.target.closest(".btn-buy");
  if (!buyBtn) return; // no es "Comprar ahora"

  // Solo hacemos el flujo si hay sesión (sin sesión el otro módulo ya bloquea y abre modal)
  const { isClient, uid } = readSession();
  if (!isClient || !uid) return;

  const productId = getProductIdFromClick(buyBtn);
  if (!productId) {
    console.log("se presiono el btn comprar ahora, pero no se pudo obtener el producto id");
    return;
  }

  console.log("se presiono el btn comprar ahora, se obtuvo el producto id=", productId);

  // Agregar al carrito temporal (aunque no redirijamos todavía)
  addToTempCart(productId);

  // Construir (solo para log) la URL de destino con uid + id de producto
  const url = `/client-resources/pages/micarrito.html?uid=${encodeURIComponent(uid)}&ids=${encodeURIComponent(productId)}`;
  console.log("redireccionando a", url, "(solo log; sin redireccionar)");
}, false);

// "Agregar al carrito" SIEMPRE activo (con o sin sesión)
document.addEventListener("click", (ev) => {
  const addBtn = ev.target.closest(".btn-ad-to-cart");
  if (!addBtn) return;

  const productId = getProductIdFromClick(addBtn);
  if (!productId) {
    console.log("se presiono el btn agregar al carrito, pero no se pudo obtener el producto id");
    return;
  }

  console.log("se presiono el btn agregar al carrito, se obtuvo el producto id =", productId);
  addToTempCart(productId); // maneja alerta de duplicado y log del estado
}, false);

/* =========================
   Log inicial (opcional)
   ========================= */
(() => {
  const { isAdmin, isClient, uid, username } = readSession();
  // Útil al iniciar para confirmar el contexto de pruebas:
  // console.log({ isAdmin, isClient, uid, username });
})();
