// /scripts/carrito.js
// Carrito temporal + logs: "Comprar ahora" (redirige) y "Agregar al carrito" (siempre activo).

const TEMP_CART_KEY = "temProdIds";

/* =========================
   Helpers: sesión y storage
   ========================= */
function readSession() {
  const isAdmin  = sessionStorage.getItem("isAdmin")  === "true";
  const isClient = sessionStorage.getItem("isClient") === "true";
  const uid      = sessionStorage.getItem("uid") || null;
  const username = sessionStorage.getItem("username") || null;
  return { isAdmin, isClient, uid, username };
}

function readTempIds() {
  try {
    const raw = localStorage.getItem(TEMP_CART_KEY);
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeTempIds(arr) {
  try { localStorage.setItem(TEMP_CART_KEY, JSON.stringify(arr)); } catch {}
}

function addToTempCart(productId) {
  const ids = readTempIds();
  if (ids.includes(productId)) {
    alert("Ya se encuentra el producto en el carrito temporal");
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
  const withData = target.closest("[data-id]");
  if (withData?.dataset?.id) return String(withData.dataset.id);

  const card = target.closest(".offer-card");
  if (card?.dataset?.id) return String(card.dataset.id);

  const asAttr = target.getAttribute?.("data-id");
  return asAttr ? String(asAttr) : null;
}

/* =========================
   Delegación: COMPRAR AHORA
   ========================= */
document.addEventListener("click", (ev) => {
  const buyBtn = ev.target.closest(".btn-buy");
  if (!buyBtn) return;

  // Solo procede si hay sesión de cliente
  const { isClient, uid } = readSession();
  if (!isClient || !uid) return;

  const productId = getProductIdFromClick(buyBtn);
  if (!productId) {
    console.log("se presiono el btn comprar ahora, pero no se pudo obtener el producto id");
    return;
  }

  // Logs conservados
  console.log("se presiono el btn comprar ahora, se obtuvo el producto id=", productId);

  // Agrega al carrito temporal
  addToTempCart(productId);

  // Construye URL destino y REDIRIGE
  const url = `/client-resources/pages/micarrito.html?uid=${encodeURIComponent(uid)}&ids=${encodeURIComponent(productId)}`;
  console.log("redireccionando a", url);
  window.location.assign(url);
}, false);

/* ==================================
   Delegación: AGREGAR AL CARRITO (on)
   ================================== */
document.addEventListener("click", (ev) => {
  const addBtn = ev.target.closest(".btn-ad-to-cart");
  if (!addBtn) return;

  const productId = getProductIdFromClick(addBtn);
  if (!productId) {
    console.log("se presiono el btn agregar al carrito, pero no se pudo obtener el producto id");
    return;
  }

  // Logs conservados
  console.log("se presiono el btn agregar al carrito, se obtuvo el producto id =", productId);
  addToTempCart(productId);
}, false);
