// /admin-resources/scripts/forms/control-pedidos.js
// UI: Control de pedidos (agregar/quitar ítems, verificar stock, confirmar/cancelar)
// Requiere DataTables 1.13 + Bootstrap + jQuery (ya incluidos en el HTML)

import { controlPedidosAPI, addItemConVerificacion } from "/admin-resources/scripts/apis/controlPedidosManager.js";
import { pedidosAPI, confirmarConVerificacion } from "/admin-resources/scripts/apis/pedidosManager.js";

/* =========================
   Helpers de logging (estilo solicitado)
   ========================= */
function logPaso(boton, api, respuesta) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  if (respuesta !== undefined) console.log("respuesta :", respuesta);
}
function logError(boton, api, error) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  console.error("respuesta :", error?.message || error);
}

/* =========================
   Normalización de respuestas y filas
   ========================= */
function assertOk(resp) {
  if (resp && typeof resp === "object" && "success" in resp) {
    if (!resp.success) throw new Error(resp.message || "Operación no exitosa");
  }
  return resp;
}
function toArrayData(resp) {
  const r = resp && typeof resp === "object" && "data" in resp ? resp.data : resp;
  if (Array.isArray(r)) return r;
  if (!r) return [];
  return [r];
}
function money(n) {
  return (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
function ensurePrefix(v, prefix) {
  const s = String(v ?? "").trim();
  if (!s) return s;
  return s.startsWith(prefix) ? s : `${prefix}${s}`;
}
const ped = (id) => ensurePrefix(id, "ped-");
const prd = (id) => ensurePrefix(id, "prd-");

// Normaliza renglón de detalle a columnas esperadas
function normalizeDetalle(row) {
  if (!row || typeof row !== "object") return null;
  const producto_id = row.producto_id ?? row.producto ?? row.id_producto ?? "";
  const nombre      = row.nombre_producto ?? row.nombre ?? "";
  const cantidad    = Number(row.cantidad ?? row.qty ?? 0) || 0;
  const precio      = Number(row.precio_unitario ?? row.precio ?? 0) || 0;
  return {
    producto_id: String(producto_id),
    nombre_producto: String(nombre),
    cantidad,
    precio_unitario: precio,
    importe: cantidad * precio
  };
}

/* =========================
   DOM refs
   ========================= */
const alertBox          = document.getElementById("alertBox");

const pedidoIdInput     = document.getElementById("pedidoId");
const btnCargar         = document.getElementById("btnCargar");

const prodIdInput       = document.getElementById("prodId");
const cantidadInput     = document.getElementById("cantidad");
const precioUnitInput   = document.getElementById("precioUnit");
const btnAgregar        = document.getElementById("btnAgregar");

const btnVerificar      = document.getElementById("btnVerificar");
const btnConfirmar      = document.getElementById("btnConfirmar");
const btnCancelar       = document.getElementById("btnCancelar");

const totalPedidoEl     = document.getElementById("totalPedido");

// Modal confirmación genérica
const modalConfirmEl    = document.getElementById("modalConfirm");
const confirmTitulo     = document.getElementById("confirmTitulo");
const confirmMsg        = document.getElementById("confirmMsg");
const confirmAccion     = document.getElementById("confirmAccion");
const confirmProductoId = document.getElementById("confirmProductoId");
const confirmCantidad   = document.getElementById("confirmCantidad");
const btnConfirmarAccion= document.getElementById("btnConfirmarAccion");

// Modal faltantes
const modalFaltantesEl  = document.getElementById("modalFaltantes");
const faltTbody         = document.getElementById("faltTbody");

// Bootstrap helpers
const bsModalConfirm    = () => bootstrap.Modal.getOrCreateInstance(modalConfirmEl);
const bsModalFaltantes  = () => bootstrap.Modal.getOrCreateInstance(modalFaltantesEl);

/* =========================
   UI helpers
   ========================= */
function showAlert(kind, msg) {
  if (!alertBox) return;
  alertBox.className = `alert alert-${kind}`;
  alertBox.textContent = msg;
  alertBox.classList.remove("d-none");
  setTimeout(() => alertBox.classList.add("d-none"), 2600);
}

/* =========================
   DataTable (líneas del pedido)
   ========================= */
let dt = null;
function initOrUpdateTable(rows) {
  const data = (rows || []).map(normalizeDetalle).filter(Boolean);
  if (dt) {
    dt.clear().rows.add(data).draw();
  } else {
    dt = $("#tablaLineas").DataTable({
      data,
      columns: [
        { data: "producto_id", title: "Producto" },
        { data: "nombre_producto", title: "Nombre" },
        { data: "cantidad", title: "Cantidad" },
        { data: "precio_unitario", title: "Precio", render: (v) => money(v) },
        { data: "importe", title: "Importe", render: (v) => money(v) },
        {
          data: null,
          title: "Acciones",
          className: "text-end",
          orderable: false,
          render: (row) => `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-secondary btn-dec" data-id="${row.producto_id}">
                <i class="fa-solid fa-minus"></i>
              </button>
              <button class="btn btn-outline-danger btn-del" data-id="${row.producto_id}" data-name="${row.nombre_producto}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>`
        }
      ],
      pageLength: 10,
      order: [[0, "asc"]],
      responsive: true
    });
  }
  // Total del pedido
  const total = data.reduce((acc, r) => acc + (Number(r.importe) || 0), 0);
  totalPedidoEl.textContent = money(total);
}

/* =========================
   Estado actual
   ========================= */
let currentPedidoId = ""; // siempre normalizado "ped-###"

/* =========================
   Cargas / acciones
   ========================= */
async function cargarLineas(pedidoId) {
  if (!pedidoId) return;
  try {
    const api = `/get_detalles/${ped(pedidoId)}`;
    const resp = assertOk(await pedidosAPI.getDetalles(pedidoId));
    const rows = toArrayData(resp);
    initOrUpdateTable(rows);
    logPaso("Cargar líneas", api, resp);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Cargar líneas", `/get_detalles/${ped(pedidoId)}`, err);
    showAlert("danger", err?.message || "No se pudieron cargar las líneas");
  }
}

btnCargar?.addEventListener("click", async () => {
  const id = ped(pedidoIdInput.value);
  if (!id) return;
  currentPedidoId = id;
  await cargarLineas(currentPedidoId);
  logPaso("Cargar", `/get_detalles/${currentPedidoId}`, { currentPedidoId });
});

btnAgregar?.addEventListener("click", async () => {
  if (!currentPedidoId) {
    showAlert("warning", "Primero carga un pedido.");
    return;
  }
  const producto_id = prd(prodIdInput.value);
  const cantidad = Number(cantidadInput.value || 1);
  const precio_unitario = precioUnitInput.value ? Number(precioUnitInput.value) : undefined;
  if (!producto_id || cantidad <= 0) return;

  try {
    const api = "/add_item";
    const resp = assertOk(await addItemConVerificacion({
      pedido_id: currentPedidoId,
      producto_id,
      cantidad,
      precio_unitario
    }, controlPedidosAPI));
    logPaso("Agregar ítem", api, resp);
    await cargarLineas(currentPedidoId);
    showAlert("success", "Producto agregado.");
  } catch (err) {
    // Si hubo faltantes, muéstralos
    if (String(err?.message || "").toLowerCase().includes("stock insuficiente") && Array.isArray(err?.faltantes)) {
      faltTbody.innerHTML = err.faltantes.map(f => `
        <tr>
          <td>${f.producto_id ?? ""}</td>
          <td>${f.nombre_producto ?? ""}</td>
          <td>${f.requerido ?? f.cantidad ?? ""}</td>
          <td>${f.stock_disponible ?? f.disponible ?? ""}</td>
        </tr>
      `).join("");
      bsModalFaltantes().show();
      logError("Agregar ítem", "/add_item", err);
      return;
    }
    logError("Agregar ítem", "/add_item", err);
    showAlert("danger", err?.message || "No se pudo agregar el producto");
  }
});

/* =========================
   Verificar / Confirmar / Cancelar pedido
   ========================= */
btnVerificar?.addEventListener("click", async () => {
  if (!currentPedidoId) return showAlert("warning", "Primero carga un pedido.");
  try {
    const api = `/verificar_productos/${currentPedidoId}`;
    const resp = assertOk(await controlPedidosAPI.verificarProductos(currentPedidoId));
    const faltantes = toArrayData(resp).filter(x => {
      const req = Number(x.requerido ?? 0);
      const disp = Number(x.stock_disponible ?? x.disponible ?? 0);
      const def = Number(x.deficit ?? (req - disp));
      return def > 0 || req > disp;
    });
    if (faltantes.length) {
      faltTbody.innerHTML = faltantes.map(f => `
        <tr>
          <td>${f.producto_id ?? ""}</td>
          <td>${f.nombre_producto ?? ""}</td>
          <td>${f.requerido ?? ""}</td>
          <td>${f.stock_disponible ?? f.disponible ?? ""}</td>
        </tr>
      `).join("");
      bsModalFaltantes().show();
      showAlert("warning", "Hay faltantes de stock.");
    } else {
      showAlert("success", "Stock suficiente para confirmar.");
    }
    logPaso("Verificar stock", api, resp);
  } catch (err) {
    logError("Verificar stock", `/verificar_productos/${currentPedidoId}`, err);
    showAlert("danger", err?.message || "No se pudo verificar el stock");
  }
});

// Abre modal para confirmar/cancelar pedido
btnConfirmar?.addEventListener("click", () => {
  if (!currentPedidoId) return showAlert("warning", "Primero carga un pedido.");
  confirmAccion.value = "confirmar_pedido";
  confirmProductoId.value = "";
  confirmCantidad.value = "";
  confirmTitulo.textContent = "Confirmar pedido";
  confirmMsg.textContent = `¿Deseas confirmar el pedido ${currentPedidoId}?`;
  bsModalConfirm().show();
  logPaso("Confirmar pedido", "(abrir modal)", { id: currentPedidoId });
});
btnCancelar?.addEventListener("click", () => {
  if (!currentPedidoId) return showAlert("warning", "Primero carga un pedido.");
  confirmAccion.value = "cancelar_pedido";
  confirmProductoId.value = "";
  confirmCantidad.value = "";
  confirmTitulo.textContent = "Cancelar pedido";
  confirmMsg.textContent = `¿Deseas cancelar el pedido ${currentPedidoId}?`;
  bsModalConfirm().show();
  logPaso("Cancelar pedido", "(abrir modal)", { id: currentPedidoId });
});

// Confirmación genérica (pedido o líneas)
btnConfirmarAccion?.addEventListener("click", async () => {
  const accion = confirmAccion.value;
  const pid = currentPedidoId;
  const prod = confirmProductoId.value ? prd(confirmProductoId.value) : null;
  const cant = confirmCantidad.value ? Number(confirmCantidad.value) : null;

  try {
    let resp, api;
    if (accion === "confirmar_pedido") {
      api = "/confirmar";
      resp = await confirmarConVerificacion(pid, pedidosAPI, controlPedidosAPI);
      assertOk(resp);
      logPaso("Confirmar pedido", api, resp);
      showAlert("success", "Pedido confirmado.");
      bsModalConfirm().hide();
      await cargarLineas(pid);
      return;
    }
    if (accion === "cancelar_pedido") {
      api = "/cancelar";
      resp = assertOk(await pedidosAPI.cancelar(pid));
      logPaso("Cancelar pedido", api, resp);
      showAlert("success", "Pedido cancelado.");
      bsModalConfirm().hide();
      await cargarLineas(pid);
      return;
    }
    if (accion === "decrementar_linea") {
      api = "/remove_item";
      resp = assertOk(await controlPedidosAPI.removeItem({
        pedido_id: pid, producto_id: prod, cantidad: cant ?? 1
      }));
      logPaso("Decrementar línea", api, resp);
      bsModalConfirm().hide();
      await cargarLineas(pid);
      return;
    }
    if (accion === "eliminar_linea") {
      api = "/remove_item";
      resp = assertOk(await controlPedidosAPI.removeItem({
        pedido_id: pid, producto_id: prod, cantidad: null // elimina toda la línea
      }));
      logPaso("Eliminar línea", api, resp);
      bsModalConfirm().hide();
      await cargarLineas(pid);
      return;
    }
  } catch (err) {
    // Si confirmar falló por stock insuficiente, mostrar faltantes
    if (String(err?.message || "").toLowerCase().includes("stock insuficiente") && Array.isArray(err?.faltantes)) {
      faltTbody.innerHTML = err.faltantes.map(f => `
        <tr>
          <td>${f.producto_id ?? ""}</td>
          <td>${f.nombre_producto ?? ""}</td>
          <td>${f.requerido ?? ""}</td>
          <td>${f.stock_disponible ?? f.disponible ?? ""}</td>
        </tr>
      `).join("");
      bsModalConfirm().hide();
      bsModalFaltantes().show();
      logError("Confirmar pedido", "/confirmar", err);
      return;
    }
    logError("Acción confirmada", accion, err);
    showAlert("danger", err?.message || "No se pudo completar la acción");
  }
});

/* =========================
   Delegación de acciones en la tabla (decrementar / eliminar)
   ========================= */
$("#tablaLineas tbody").on("click", "button.btn-dec", function () {
  const id = this.dataset.id;
  confirmAccion.value = "decrementar_linea";
  confirmProductoId.value = id;
  confirmCantidad.value = "1";
  confirmTitulo.textContent = "Decrementar línea";
  confirmMsg.textContent = `¿Restar 1 unidad del producto ${id}?`;
  bsModalConfirm().show();
  logPaso("Decrementar (abrir confirmación)", "(modal)", { id });
});

$("#tablaLineas tbody").on("click", "button.btn-del", function () {
  const id = this.dataset.id;
  const name = this.dataset.name || id;
  confirmAccion.value = "eliminar_linea";
  confirmProductoId.value = id;
  confirmCantidad.value = "";
  confirmTitulo.textContent = "Eliminar línea";
  confirmMsg.textContent = `¿Eliminar completamente "${name}" (${id}) del pedido?`;
  bsModalConfirm().show();
  logPaso("Eliminar (abrir confirmación)", "(modal)", { id, name });
});

/* =========================
   Boot (opcional: si viene un id en el input)
   ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  const maybeId = pedidoIdInput?.value?.trim();
  if (maybeId) {
    currentPedidoId = ped(maybeId);
    await cargarLineas(currentPedidoId);
  }
});
