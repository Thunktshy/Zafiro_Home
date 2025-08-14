// /admin-resources/scripts/forms/datos-facturacion.js
// Panel: Datos de facturación (Bootstrap + DataTables + logs)
// Estructura esperada: { success, message, data }
// HTML base: panel-datos-facturacion.html (incluye jQuery, DataTables, Bootstrap)

import { datosFacturacionAPI } from "/admin-resources/scripts/apis/datosFacturacionManager.js";

/* =========================
   Helpers (logs + normalización)
========================= */
function logPaso(boton, api, respuesta) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  if (respuesta !== undefined) console.log("respuesta :", respuesta);
}
function logError(boton, api, error) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  console.error("respuesta :", error?.message || error);
}
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
const ensureCl = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return s;
  return s.startsWith("cl-") ? s : `cl-${s}`;
};
const dtStr = (x) => {
  if (!x) return "";
  const d = typeof x === "string" || typeof x === "number" ? new Date(x) : x;
  return isNaN(d?.getTime?.()) ? "" : d.toLocaleString("es-MX");
};
function normalizeRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id ?? row.registro_id ?? row.datos_id ?? null,
    cliente_id: String(row.cliente_id ?? ""),
    rfc: String(row.rfc ?? ""),
    razon_social: String(row.razon_social ?? ""),
    direccion_fiscal: String(row.direccion_fiscal ?? ""),
    creado: dtStr(row.fecha_creacion ?? row.created_at ?? row.fecha ?? null)
  };
}
function showAlert(kind, msg) {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.className = `alert alert-${kind}`;
  box.textContent = msg;
  box.classList.remove("d-none");
  setTimeout(() => box.classList.add("d-none"), 2600);
}

/* =========================
   DOM refs
========================= */
const filtroCliente     = document.getElementById("filtroCliente");
const btnBuscarCliente  = document.getElementById("btnBuscarCliente");
const btnListarTodo     = document.getElementById("btnListarTodo");
const btnLimpiar        = document.getElementById("btnLimpiar");
const btnNuevo          = document.getElementById("btnNuevo");

const modalEl           = document.getElementById("modalDatos");
const formDatos         = document.getElementById("formDatos");
const modalTitulo       = document.getElementById("modalTitulo");

const f_registro_id     = document.getElementById("registro_id");
const f_cliente_id      = document.getElementById("cliente_id");
const f_rfc             = document.getElementById("rfc");
const f_razon_social    = document.getElementById("razon_social");
const f_direccion       = document.getElementById("direccion_fiscal");

// Confirmación
const modalConfirmEl    = document.getElementById("modalConfirm");
const confirmTitulo     = document.getElementById("confirmTitulo");
const confirmMsg        = document.getElementById("confirmMsg");
const confirmAccion     = document.getElementById("confirmAccion");
const confirmId         = document.getElementById("confirmId");
const confirmClienteId  = document.getElementById("confirmClienteId");

// Bootstrap helpers
const bsModal       = () => bootstrap.Modal.getOrCreateInstance(modalEl);
const bsModalConfirm= () => bootstrap.Modal.getOrCreateInstance(modalConfirmEl);

/* =========================
   DataTable
========================= */
let dt = null;
function initOrUpdateTable(rows) {
  const data = (rows || []).map(normalizeRow).filter(Boolean);
  if (dt) {
    dt.clear().rows.add(data).draw();
    return dt;
  }
  dt = $("#tablaDatosFiscales").DataTable({
    data,
    columns: [
      { data: "id", title: "ID" },
      { data: "cliente_id", title: "Cliente" },
      { data: "rfc", title: "RFC" },
      { data: "razon_social", title: "Razón social" },
      { data: "direccion_fiscal", title: "Dirección fiscal" },
      { data: "creado", title: "Creado" },
      {
        data: null,
        title: "Acciones",
        className: "text-end",
        orderable: false,
        render: (row) => `
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary btn-editar"
                    data-id="${row.id ?? ""}"
                    data-cliente="${row.cliente_id}">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-outline-danger btn-eliminar"
                    data-cliente="${row.cliente_id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`
      }
    ],
    pageLength: 10,
    order: [[0, "desc"]],
    responsive: true
  });
  return dt;
}

/* =========================
   Cargas / filtros
========================= */
async function listarTodos() {
  try {
    const api  = "/select_all";
    const resp = assertOk(await datosFacturacionAPI.getAll());
    const arr  = toArrayData(resp);
    initOrUpdateTable(arr);
    logPaso("Listar todos", api, resp);
    showAlert("info", `Se cargaron ${arr.length} registros`);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Listar todos", "/select_all", err);
    showAlert("danger", err?.message || "No fue posible listar");
  }
}
async function buscarPorCliente() {
  const id = ensureCl(filtroCliente.value);
  if (!id) return;
  try {
    const api  = `/select_by_cliente/${id}`;
    const resp = assertOk(await datosFacturacionAPI.getByCliente(id));
    const arr  = toArrayData(resp);
    initOrUpdateTable(arr);
    logPaso("Buscar por cliente", api, resp);
    showAlert("info", `Se cargaron ${arr.length} registro(s)`);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Buscar por cliente", `/select_by_cliente/${id}`, err);
    showAlert("danger", err?.message || "Cliente sin datos de facturación");
  }
}
function limpiar() {
  filtroCliente.value = "";
  initOrUpdateTable([]);
  logPaso("Limpiar", "(UI)", { ok: true });
}

btnListarTodo?.addEventListener("click", listarTodos);
btnBuscarCliente?.addEventListener("click", buscarPorCliente);
btnLimpiar?.addEventListener("click", limpiar);
filtroCliente?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    buscarPorCliente();
  }
});

/* =========================
   Nuevo / Editar
========================= */
btnNuevo?.addEventListener("click", () => {
  formDatos.reset();
  f_registro_id.value = "";
  modalTitulo.textContent = "Nuevo registro";
  bsModal().show();
  logPaso("Nuevo registro", "(abrir modal)", { ok: true });
});

// Cargar datos en modal desde la fila seleccionada
$("#tablaDatosFiscales tbody").on("click", "button.btn-editar", function () {
  const row = dt?.row($(this).closest("tr")).data();
  if (!row) return;

  f_registro_id.value = row.id ?? "";
  f_cliente_id.value  = row.cliente_id ?? "";
  f_rfc.value         = row.rfc ?? "";
  f_razon_social.value= row.razon_social ?? "";
  f_direccion.value   = row.direccion_fiscal ?? "";

  modalTitulo.textContent = "Editar registro";
  bsModal().show();
  logPaso("Editar (abrir modal)", "(UI)", row);
});

// Validación simple de RFC (12 o 13 chars)
function rfcValido(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s.length === 12 || s.length === 13;
}

// Guardar (insert/update)
formDatos?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formDatos.classList.add("was-validated");
  if (!formDatos.checkValidity()) return;

  const payload = {
    cliente_id: ensureCl(f_cliente_id.value),
    rfc: String(f_rfc.value || "").toUpperCase().trim(),
    razon_social: f_razon_social.value.trim(),
    direccion_fiscal: f_direccion.value.trim() || null
  };
  if (!rfcValido(payload.rfc)) {
    f_rfc.focus();
    showAlert("warning", "RFC debe tener 12 o 13 caracteres.");
    return;
  }

  try {
    if (f_registro_id.value) {
      const api  = "/update";
      const resp = assertOk(await datosFacturacionAPI.update(payload));
      logPaso("Guardar edición", api, resp);
      bsModal().hide();
      await recargarSegunFiltro();
      showAlert("success", "Registro actualizado.");
    } else {
      const api  = "/insert";
      const resp = assertOk(await datosFacturacionAPI.insert(payload));
      logPaso("Guardar nuevo", api, resp);
      bsModal().hide();
      await recargarSegunFiltro();
      showAlert("success", "Registro creado.");
    }
  } catch (err) {
    logError(f_registro_id.value ? "Guardar edición" : "Guardar nuevo",
             f_registro_id.value ? "/update" : "/insert", err);
    showAlert("danger", err?.message || "No se pudo guardar");
  }
});

/* =========================
   Eliminar (confirmación)
========================= */
function abrirConfirmDelete(cliente_id) {
  confirmAccion.value = "delete";
  confirmId.value = ""; // no se usa por API
  confirmClienteId.value = cliente_id;
  confirmTitulo.textContent = "Eliminar datos de facturación";
  confirmMsg.textContent = `¿Eliminar datos de facturación del cliente ${cliente_id}?`;
  bsModalConfirm().show();
}

$("#tablaDatosFiscales tbody").on("click", "button.btn-eliminar", function () {
  const row = dt?.row($(this).closest("tr")).data();
  if (!row) return;
  abrirConfirmDelete(row.cliente_id);
  logPaso("Eliminar (abrir confirmación)", "(modal)", { cliente_id: row.cliente_id });
});

document.getElementById("btnConfirmarAccion")?.addEventListener("click", async () => {
  if (confirmAccion.value !== "delete") return;
  const idCliente = confirmClienteId.value;
  try {
    const api  = "/delete";
    const resp = assertOk(await datosFacturacionAPI.remove(idCliente));
    logPaso("Eliminar", api, resp);
    bsModalConfirm().hide();
    await recargarSegunFiltro();
    showAlert("success", "Registro eliminado.");
  } catch (err) {
    logError("Eliminar", "/delete", err);
    showAlert("danger", err?.message || "No se pudo eliminar");
  }
});

/* =========================
   Recarga según filtro activo
========================= */
async function recargarSegunFiltro() {
  const id = ensureCl(filtroCliente.value);
  try {
    if (id) {
      const resp = assertOk(await datosFacturacionAPI.getByCliente(id));
      initOrUpdateTable(toArrayData(resp));
      return;
    }
    const resp = assertOk(await datosFacturacionAPI.getAll());
    initOrUpdateTable(toArrayData(resp));
  } catch (err) {
    initOrUpdateTable([]);
    logError("recargarSegunFiltro", "(datos_facturacion)", err);
  }
}

/* =========================
   Boot
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await listarTodos();
});
