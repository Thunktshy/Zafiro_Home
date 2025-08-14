// /admin-resources/scripts/forms/pedidos.js
// UI de administración de Pedidos (DataTables + Bootstrap + logs estándar)
// Formato de respuesta esperado: { success, message, data }

import { pedidosAPI, confirmarConVerificacion } from "/admin-resources/scripts/apis/pedidosManager.js";
import { controlPedidosAPI } from "/admin-resources/scripts/apis/controlPedidosManager.js"; // usado para diagnóstico de faltantes
// (opcional) importar productosAPI si llegas a enriquecer detalles
// import { productosAPI } from "/admin-resources/scripts/apis/productosManager.js";

/* =========================
   Helpers de logging
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
   Normalización respuestas / IDs / filas
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
function toOneData(resp) {
  const list = toArrayData(resp);
  return list.length ? list[0] : null;
}
const ensurePrefix = (v, prefix) => {
  const s = String(v ?? "").trim();
  if (!s) return s;
  return s.startsWith(prefix) ? s : `${prefix}${s}`;
};
const ped = (id) => ensurePrefix(id, "ped-");
const cli = (id) => ensurePrefix(id, "cl-");

// Formato de filas para la tabla
function normalizePedido(row) {
  if (!row || typeof row !== "object") return null;
  const pedido_id   = row.pedido_id   ?? row.pedido ?? row.id ?? "";
  const cliente_id  = row.cliente_id  ?? row.cliente ?? "";
  const estado      = row.estado_pedido ?? row.estado ?? "";
  const fechaRaw    = row.fecha_pedido ?? row.fecha ?? row.created_at ?? null;
  const totalRaw    = row.total_pedido ?? row.total ?? row.importe ?? 0;

  const fecha = fechaRaw ? new Date(fechaRaw) : null;
  const total = Number(totalRaw) || 0;

  return {
    pedido_id: String(pedido_id),
    cliente_id: String(cliente_id),
    estado_pedido: String(estado),
    fecha_pedido: fecha ? fecha.toLocaleString("es-MX") : "",
    total_pedido: total
  };
}

function money(n) {
  return (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// Detalle de pedido
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
const filtroPedidoId    = document.getElementById("filtroPedidoId");
const filtroClienteId   = document.getElementById("filtroClienteId");
const filtroEstado      = document.getElementById("filtroEstado");
const btnAplicarFiltros = document.getElementById("btnAplicarFiltros");
const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
const btnNuevoPedido    = document.getElementById("btnNuevoPedido");

// Nuevo pedido (modal)
const modalNuevoPedidoEl= document.getElementById("modalNuevoPedido");
const formNuevoPedido   = document.getElementById("formNuevoPedido");
const npClienteId       = document.getElementById("npClienteId");
const npMetodoPago      = document.getElementById("npMetodoPago");
const bsModalNuevo      = () => bootstrap.Modal.getOrCreateInstance(modalNuevoPedidoEl);

// Detalles (modal)
const modalDetallesEl   = document.getElementById("modalDetalles");
const detPedidoIdSpan   = document.getElementById("detPedidoId");
const detTbody          = document.getElementById("detTbody");
const bsModalDetalles   = () => bootstrap.Modal.getOrCreateInstance(modalDetallesEl);

// Confirmación genérica (confirmar/cancelar)
const modalConfirmEl    = document.getElementById("modalConfirm");
const confirmTitulo     = document.getElementById("confirmTitulo");
const confirmMsg        = document.getElementById("confirmMsg");
const confirmAccion     = document.getElementById("confirmAccion");
const confirmPedidoId   = document.getElementById("confirmPedidoId");
const btnConfirmarAccion= document.getElementById("btnConfirmarAccion");
const bsModalConfirm    = () => bootstrap.Modal.getOrCreateInstance(modalConfirmEl);

// Faltantes (stock insuficiente)
const modalFaltantesEl  = document.getElementById("modalFaltantes");
const faltTbody         = document.getElementById("faltTbody");
const bsModalFaltantes  = () => bootstrap.Modal.getOrCreateInstance(modalFaltantesEl);

/* =========================
   UI helpers
   ========================= */
function showAlert(kind, msg) {
  if (!alertBox) return;
  alertBox.className = `alert alert-${kind}`;
  alertBox.textContent = msg;
  alertBox.classList.remove("d-none");
  setTimeout(() => alertBox.classList.add("d-none"), 2500);
}

/* =========================
   DataTable
   ========================= */
let dt = null;
function initOrUpdateTable(rows) {
  const data = (rows || []).map(normalizePedido).filter(Boolean);
  if (dt) {
    dt.clear().rows.add(data).draw();
    return dt;
  }
  dt = $("#tablaPedidos").DataTable({
    data,
    columns: [
      { data: "pedido_id", title: "Pedido" },
      { data: "cliente_id", title: "Cliente" },
      { data: "estado_pedido", title: "Estado" },
      { data: "fecha_pedido", title: "Fecha" },
      { data: "total_pedido", title: "Total", render: (v) => money(v) },
      {
        data: null,
        title: "Acciones",
        orderable: false,
        className: "text-end",
        render: (row) => {
          const disabledConfirm = row.estado_pedido !== "Por confirmar" ? "disabled" : "";
          const disabledCancel  = row.estado_pedido === "Cancelado" ? "disabled" : "";
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-secondary btn-ver" data-id="${row.pedido_id}">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button class="btn btn-outline-success btn-confirmar" data-id="${row.pedido_id}" ${disabledConfirm}>
                <i class="fa-solid fa-check"></i>
              </button>
              <button class="btn btn-outline-danger btn-cancelar" data-id="${row.pedido_id}" ${disabledCancel}>
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>`;
        }
      }
    ],
    responsive: true,
    pageLength: 10,
    order: [[3, "desc"]]
  });
  return dt;
}

/* =========================
   Cargas / filtros
   ========================= */
async function aplicarFiltros() {
  const pid = filtroPedidoId.value.trim();
  const cid = filtroClienteId.value.trim();
  const est = (filtroEstado.value || "").trim();

  try {
    let resp, api, boton = "Aplicar";
    if (pid) {
      api = `/get/${ped(pid)}`;
      resp = assertOk(await pedidosAPI.getOne(pid));
      initOrUpdateTable(toArrayData(resp));
    } else if (cid) {
      api = `/por_cliente/${cli(cid)}`;
      resp = assertOk(await pedidosAPI.getByCliente(cid));
      initOrUpdateTable(toArrayData(resp));
    } else if (est) {
      api = `/por_estado/${est}`;
      resp = assertOk(await pedidosAPI.getByEstado(est));
      initOrUpdateTable(toArrayData(resp));
    } else {
      // Por defecto mostramos “Por confirmar”
      api = `/por_confirmar`;
      resp = assertOk(await pedidosAPI.getPorConfirmar());
      initOrUpdateTable(toArrayData(resp));
    }
    logPaso(boton, api, resp);
    showAlert("info", `Se cargaron ${toArrayData(resp).length} pedidos`);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Aplicar", "(filtros)", err);
    showAlert("danger", err?.message || "Error al aplicar filtros");
  }
}

btnAplicarFiltros?.addEventListener("click", aplicarFiltros);

btnLimpiarFiltros?.addEventListener("click", async () => {
  filtroPedidoId.value = "";
  filtroClienteId.value = "";
  filtroEstado.value = "Por confirmar";
  try {
    const resp = assertOk(await pedidosAPI.getPorConfirmar());
    initOrUpdateTable(toArrayData(resp));
    logPaso("Limpiar", "/por_confirmar", resp);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Limpiar", "/por_confirmar", err);
  }
});

/* =========================
   Nuevo pedido
   ========================= */
btnNuevoPedido?.addEventListener("click", () => {
  formNuevoPedido.reset();
  bsModalNuevo().show();
  logPaso("Nuevo pedido", "(abrir modal)", { ok: true });
});

formNuevoPedido?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formNuevoPedido.classList.add("was-validated");
  if (!formNuevoPedido.checkValidity()) return;

  const payload = {
    cliente_id: cli(npClienteId.value),
    metodo_pago: (npMetodoPago.value || "").trim() || null
  };

  try {
    const api = "/insert";
    const resp = assertOk(await pedidosAPI.insert(payload));
    logPaso("Crear pedido", api, resp);
    bsModalNuevo().hide();

    const pedObj = toOneData(resp);
    if (pedObj?.pedido_id) {
      filtroPedidoId.value = pedObj.pedido_id;
    }
    await aplicarFiltros();
    showAlert("success", "Pedido creado correctamente.");
  } catch (err) {
    logError("Crear pedido", "/insert", err);
    showAlert("danger", err?.message || "Error al crear pedido");
  }
});

/* =========================
   Detalles
   ========================= */
async function cargarDetalles(pedido_id) {
  try {
    const api = `/get_detalles/${ped(pedido_id)}`;
    const resp = assertOk(await pedidosAPI.getDetalles(pedido_id));
    const rows = toArrayData(resp).map(normalizeDetalle).filter(Boolean);

    // Pinta en tabla simple del modal
    detPedidoIdSpan.textContent = pedido_id;
    detTbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.producto_id}</td>
        <td>${r.nombre_producto}</td>
        <td>${r.cantidad}</td>
        <td>${money(r.precio_unitario)}</td>
        <td>${money(r.importe)}</td>
      </tr>
    `).join("");

    bsModalDetalles().show();
    logPaso("Ver detalles", api, resp);
  } catch (err) {
    logError("Ver detalles", `/get_detalles/${ped(pedido_id)}`, err);
    showAlert("danger", err?.message || "No se pudieron cargar los detalles");
  }
}

/* =========================
   Confirmar / Cancelar con modal de confirmación
   ========================= */
function abrirConfirmModal(accion, pedido_id) {
  confirmAccion.value = accion;
  confirmPedidoId.value = pedido_id;
  confirmTitulo.textContent = accion === "confirmar" ? "Confirmar pedido" : "Cancelar pedido";
  confirmMsg.textContent = accion === "confirmar"
    ? `¿Deseas confirmar el pedido ${pedido_id}?`
    : `¿Deseas cancelar el pedido ${pedido_id}?`;
  bsModalConfirm().show();
}

btnConfirmarAccion?.addEventListener("click", async () => {
  const accion = confirmAccion.value;
  const pedidoId = confirmPedidoId.value;
  if (!accion || !pedidoId) return;

  try {
    if (accion === "confirmar") {
      // Usa el helper que revisa stock y, si falla, trae faltantes
      const api = "/confirmar";
      const resp = await confirmarConVerificacion(pedidoId, pedidosAPI, controlPedidosAPI);
      logPaso("Confirmar pedido", api, resp);
      showAlert("success", "Pedido confirmado.");
    } else {
      const api = "/cancelar";
      const resp = assertOk(await pedidosAPI.cancelar(pedidoId));
      logPaso("Cancelar pedido", api, resp);
      showAlert("success", "Pedido cancelado.");
    }
    bsModalConfirm().hide();
    await aplicarFiltros();
  } catch (err) {
    // Si viene con faltantes desde confirmarConVerificacion
    if (String(err?.message || "").toLowerCase().includes("stock insuficiente") && Array.isArray(err?.faltantes)) {
      faltTbody.innerHTML = err.faltantes.map(f => `
        <tr>
          <td>${f.producto_id ?? ""}</td>
          <td>${f.nombre_producto ?? ""}</td>
          <td>${f.requerido ?? f.cantidad ?? ""}</td>
          <td>${f.disponible ?? f.stock ?? ""}</td>
        </tr>
      `).join("");
      bsModalConfirm().hide();
      bsModalFaltantes().show();
      logError("Confirmar pedido", "/confirmar", err);
      return;
    }
    logError(accion === "confirmar" ? "Confirmar pedido" : "Cancelar pedido",
             accion === "confirmar" ? "/confirmar" : "/cancelar", err);
    showAlert("danger", err?.message || "No se pudo completar la acción");
  }
});

/* =========================
   Delegación de acciones en la tabla
   ========================= */
$("#tablaPedidos tbody").on("click", "button.btn-ver", function () {
  const id = this.dataset.id;
  cargarDetalles(id);
});
$("#tablaPedidos tbody").on("click", "button.btn-confirmar", function () {
  const id = this.dataset.id;
  abrirConfirmModal("confirmar", id);
});
$("#tablaPedidos tbody").on("click", "button.btn-cancelar", function () {
  const id = this.dataset.id;
  abrirConfirmModal("cancelar", id);
});

/* =========================
   Boot
   ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Por defecto, lista “Por confirmar”
  filtroEstado.value = "Por confirmar";
  await aplicarFiltros();
});
