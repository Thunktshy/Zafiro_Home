// /admin-resources/scripts/forms/datos-personales.js
// Panel: Datos personales (Bootstrap + DataTables + logs estándar)
// Respuestas esperadas: { success, message, data }

import { datosPersonalesAPI } from "/admin-resources/scripts/apis/datosPersonalesManager.js";

/* =========================
   Helpers (logs y normalización)
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
    datos_id: row.datos_id ?? row.id ?? null,
    cliente_id: String(row.cliente_id ?? ""),
    nombre: String(row.nombre ?? ""),
    apellidos: String(row.apellidos ?? ""),
    telefono: String(row.telefono ?? ""),
    direccion: String(row.direccion ?? ""),
    ciudad: String(row.ciudad ?? ""),
    codigo_postal: String(row.codigo_postal ?? ""),
    pais: String(row.pais ?? ""),
    creado: dtStr(row.fecha_creacion ?? row.created_at ?? row.fecha ?? null)
  };
}

/* =========================
   DOM refs
========================= */
const alertBox        = document.getElementById("alertBox");

const filtroCliente   = document.getElementById("filtroCliente");
const btnBuscarCliente= document.getElementById("btnBuscarCliente");
const btnListarTodo   = document.getElementById("btnListarTodo");
const btnLimpiar      = document.getElementById("btnLimpiar");

const btnNuevo        = document.getElementById("btnNuevo");

const modalEl         = document.getElementById("modalDatos");
const formDatos       = document.getElementById("formDatos");
const modalTitulo     = document.getElementById("modalTitulo");

const f_datos_id      = document.getElementById("datos_id");
const f_cliente_id    = document.getElementById("cliente_id");
const f_nombre        = document.getElementById("nombre");
const f_apellidos     = document.getElementById("apellidos");
const f_telefono      = document.getElementById("telefono");
const f_direccion     = document.getElementById("direccion");
const f_ciudad        = document.getElementById("ciudad");
const f_cp            = document.getElementById("codigo_postal");
const f_pais          = document.getElementById("pais");

const modalConfirmEl  = document.getElementById("modalConfirm");
const confirmTitulo   = document.getElementById("confirmTitulo");
const confirmMsg      = document.getElementById("confirmMsg");
const confirmAccion   = document.getElementById("confirmAccion");
const confirmClienteId= document.getElementById("confirmClienteId");

const bsModal         = () => bootstrap.Modal.getOrCreateInstance(modalEl);
const bsModalConfirm  = () => bootstrap.Modal.getOrCreateInstance(modalConfirmEl);

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
   DataTable
========================= */
let dt = null;
function initOrUpdateTable(rows) {
  const data = (rows || []).map(normalizeRow).filter(Boolean);
  if (dt) {
    dt.clear().rows.add(data).draw();
    return dt;
  }
  dt = $("#tablaDatosPersonales").DataTable({
    data,
    columns: [
      { data: "datos_id", title: "ID" },
      { data: "cliente_id", title: "Cliente" },
      { data: "nombre", title: "Nombre" },
      { data: "apellidos", title: "Apellidos" },
      { data: "telefono", title: "Teléfono" },
      { data: "ciudad", title: "Ciudad" },
      { data: "codigo_postal", title: "CP" },
      { data: "pais", title: "País" },
      { data: "creado", title: "Creado" },
      {
        data: null,
        title: "Acciones",
        orderable: false,
        className: "text-end",
        render: (row) => `
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary btn-editar"
                    data-datosid="${row.datos_id ?? ""}"
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
   Acciones de carga / filtros
========================= */
async function listarTodos() {
  try {
    const api = "/select_all";
    const resp = assertOk(await datosPersonalesAPI.getAll());
    initOrUpdateTable(toArrayData(resp));
    logPaso("Listar todos", api, resp);
    showAlert("info", `Se cargaron ${toArrayData(resp).length} registros`);
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
    const api = `/select_by_cliente/${id}`;
    const resp = assertOk(await datosPersonalesAPI.getByCliente(id));
    initOrUpdateTable(toArrayData(resp));
    logPaso("Buscar por cliente", api, resp);
    showAlert("info", `Se cargaron ${toArrayData(resp).length} registros`);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Buscar por cliente", `/select_by_cliente/${id}`, err);
    showAlert("danger", err?.message || "Cliente sin datos personales");
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
  f_datos_id.value   = "";
  modalTitulo.textContent = "Nuevo registro";
  bsModal().show();
  logPaso("Nuevo registro", "(abrir modal)", { ok: true });
});

$("#tablaDatosPersonales tbody").on("click", "button.btn-editar", function () {
  // Cargamos los datos desde la fila del DataTable (ya normalizados)
  const row = dt?.row($(this).closest("tr")).data();
  if (!row) return;

  f_datos_id.value   = row.datos_id ?? "";
  f_cliente_id.value = row.cliente_id ?? "";
  f_nombre.value     = row.nombre ?? "";
  f_apellidos.value  = row.apellidos ?? "";
  f_telefono.value   = row.telefono ?? "";
  f_direccion.value  = row.direccion ?? "";
  f_ciudad.value     = row.ciudad ?? "";
  f_cp.value         = row.codigo_postal ?? "";
  f_pais.value       = row.pais ?? "";

  modalTitulo.textContent = "Editar registro";
  bsModal().show();
  logPaso("Editar (abrir modal)", "(UI)", row);
});

/* =========================
   Guardar (insert / update)
========================= */
formDatos?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formDatos.classList.add("was-validated");
  if (!formDatos.checkValidity()) return;

  const payload = {
    cliente_id: ensureCl(f_cliente_id.value),
    nombre: f_nombre.value.trim(),
    apellidos: f_apellidos.value.trim(),
    telefono: f_telefono.value.trim() || null,
    direccion: f_direccion.value.trim() || null,
    ciudad: f_ciudad.value.trim() || null,
    codigo_postal: f_cp.value.trim() || null,
    pais: f_pais.value.trim() || null
  };

  try {
    if (f_datos_id.value) {
      // Update por cliente_id (según panel)
      const api = "/update";
      const resp = assertOk(await datosPersonalesAPI.update(payload));
      logPaso("Guardar edición", api, resp);
      bsModal().hide();
      await recargarSegunFiltro();
      showAlert("success", "Registro actualizado.");
    } else {
      const api = "/insert";
      const resp = assertOk(await datosPersonalesAPI.insert(payload));
      logPaso("Guardar nuevo", api, resp);
      bsModal().hide();
      await recargarSegunFiltro();
      showAlert("success", "Registro creado.");
    }
  } catch (err) {
    logError(f_datos_id.value ? "Guardar edición" : "Guardar nuevo",
             f_datos_id.value ? "/update" : "/insert", err);
    showAlert("danger", err?.message || "No se pudo guardar");
  }
});

/* =========================
   Eliminar (confirmación)
========================= */
function abrirConfirmDelete(cliente_id) {
  confirmAccion.value = "delete";
  confirmClienteId.value = cliente_id;
  confirmTitulo.textContent = "Eliminar datos personales";
  confirmMsg.textContent = `¿Eliminar datos personales del cliente ${cliente_id}?`;
  bsModalConfirm().show();
}

$("#tablaDatosPersonales tbody").on("click", "button.btn-eliminar", function () {
  const row = dt?.row($(this).closest("tr")).data();
  if (!row) return;
  abrirConfirmDelete(row.cliente_id);
  logPaso("Eliminar (abrir confirmación)", "(modal)", { cliente_id: row.cliente_id });
});

document.getElementById("btnConfirmarAccion")?.addEventListener("click", async () => {
  if (confirmAccion.value !== "delete") return;
  const id = confirmClienteId.value;
  try {
    const api = "/delete";
    const resp = assertOk(await datosPersonalesAPI.remove(id));
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
      const resp = assertOk(await datosPersonalesAPI.getByCliente(id));
      initOrUpdateTable(toArrayData(resp));
      return;
    }
    const resp = assertOk(await datosPersonalesAPI.getAll());
    initOrUpdateTable(toArrayData(resp));
  } catch (err) {
    initOrUpdateTable([]);
    logError("recargarSegunFiltro", "(datos_personales)", err);
  }
}

/* =========================
   Boot (opcional: listar todos)
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Opcional: mostrar lista inicial vacía o todos
  // initOrUpdateTable([]);
  await listarTodos();
});
