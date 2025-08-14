// /admin-resources/scripts/forms/clientes.js
// UI de administración de Clientes (Bootstrap + DataTables)
// Estructura de respuesta esperada: { success, message, data }

import { clientsAPI } from "/admin-resources/scripts/apis/clientesManager.js";

/* =========================
   Helpers de logging (formato solicitado)
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
function ensureCl(v) {
  const s = String(v ?? "").trim();
  if (!s) return s;
  return s.startsWith("cl-") ? s : `cl-${s}`;
}
function dtString(x) {
  if (!x) return "";
  const d = typeof x === "string" || typeof x === "number" ? new Date(x) : x;
  return isNaN(d.getTime()) ? "" : d.toLocaleString("es-MX");
}
function normalizeCliente(row) {
  if (!row || typeof row !== "object") return null;
  const cliente_id     = row.cliente_id ?? row.id ?? "";
  const cuenta         = row.cuenta ?? row.username ?? "";
  const email          = row.email ?? row.correo ?? "";
  const estadoVal      = row.estado ?? row.activo ?? row.enabled ?? 1; // 1|0
  const ultimoAcceso   = row.ultimo_acceso ?? row.last_login ?? row.ultimo_login ?? null;
  const fechaCreacion  = row.fecha_creacion ?? row.created_at ?? row.fecha ?? null;

  return {
    cliente_id: String(cliente_id),
    cuenta: String(cuenta),
    email: String(email),
    estado_num: Number(estadoVal) ? 1 : 0,
    estado_texto: Number(estadoVal) ? "Activo" : "Inactivo",
    ultimo_acceso: dtString(ultimoAcceso),
    fecha_creacion: dtString(fechaCreacion)
  };
}

/* =========================
   DOM refs
   ========================= */
const alertBox        = document.getElementById("alertBox");

const filtroTerm      = document.getElementById("filtroTerm");
const soloActivos     = document.getElementById("soloActivos");
const filtroId        = document.getElementById("filtroId");

const btnBuscar       = document.getElementById("btnBuscar");
const btnBuscarId     = document.getElementById("btnBuscarId");
const btnLimpiar      = document.getElementById("btnLimpiar");
const btnNuevo        = document.getElementById("btnNuevo");

// Modal crear/editar
const modalClienteEl  = document.getElementById("modalCliente");
const formCliente     = document.getElementById("formCliente");
const modalTitulo     = document.getElementById("modalClienteTitulo");
const f_id            = document.getElementById("cliente_id");
const f_cuenta        = document.getElementById("cuenta");
const f_email         = document.getElementById("email");
const f_contra        = document.getElementById("contrasena");
const grupoContra     = document.getElementById("grupoContrasena");

// Modal confirmación
const modalConfirmEl  = document.getElementById("modalConfirm");
const confirmTitulo   = document.getElementById("confirmTitulo");
const confirmMsg      = document.getElementById("confirmMsg");
const confirmAccion   = document.getElementById("confirmAccion");
const confirmId       = document.getElementById("confirmId");

// Bootstrap helpers
const bsModalCliente  = () => bootstrap.Modal.getOrCreateInstance(modalClienteEl);
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
  const data = (rows || []).map(normalizeCliente).filter(Boolean);
  if (dt) {
    dt.clear().rows.add(data).draw();
    return dt;
  }
  dt = $("#tablaClientes").DataTable({
    data,
    columns: [
      { data: "cliente_id", title: "ID" },
      { data: "cuenta", title: "Cuenta" },
      { data: "email", title: "Email" },
      {
        data: "estado_texto",
        title: "Estado",
        render: (v, _t, row) =>
          row.estado_num
            ? `<span class="badge bg-success">Activo</span>`
            : `<span class="badge bg-secondary">Inactivo</span>`
      },
      { data: "ultimo_acceso", title: "Último acceso" },
      { data: "fecha_creacion", title: "Creado" },
      {
        data: null,
        title: "Acciones",
        className: "text-end",
        orderable: false,
        render: (row) => `
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary btn-editar" data-id="${row.cliente_id}">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            ${
              row.estado_num
                ? `<button class="btn btn-outline-warning btn-desactivar" data-id="${row.cliente_id}" data-name="${row.cuenta}">
                     <i class="fa-solid fa-user-slash"></i>
                   </button>`
                : `<button class="btn btn-outline-success btn-reactivar" data-id="${row.cliente_id}" data-name="${row.cuenta}">
                     <i class="fa-solid fa-user-check"></i>
                   </button>`
            }
            <button class="btn btn-outline-danger btn-eliminar" data-id="${row.cliente_id}" data-name="${row.cuenta}">
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
async function cargarListadoInicial() {
  try {
    // Estrategia: search con term vacío devuelve listado (solo_activos checked)
    const boton = "(auto) cargar";
    const api   = `/search?term=&solo_activos=${soloActivos.checked ? 1 : 0}`;
    const resp  = assertOk(await clientsAPI.search({ term: "", solo_activos: soloActivos.checked ? 1 : 0 }));
    initOrUpdateTable(toArrayData(resp));
    logPaso(boton, api, resp);
  } catch (err) {
    initOrUpdateTable([]);
    logError("(auto) cargar", "/search", err);
  }
}

async function buscarPorTerm() {
  const term = String(filtroTerm.value || "").trim();
  const only = soloActivos.checked ? 1 : 0;
  try {
    const boton = "Buscar";
    const api   = `/search?term=${encodeURIComponent(term)}&solo_activos=${only}`;
    const resp  = assertOk(await clientsAPI.search({ term, solo_activos: only }));
    initOrUpdateTable(toArrayData(resp));
    logPaso(boton, api, resp);
    showAlert("info", `Se cargaron ${toArrayData(resp).length} clientes`);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Buscar", `/search?term=${term}&solo_activos=${only}`, err);
    showAlert("danger", err?.message || "Error de búsqueda");
  }
}

async function buscarPorId() {
  const id = filtroId.value.trim();
  if (!id) return;
  try {
    const boton = "Buscar por ID";
    const api   = `/por_id/${encodeURIComponent(id)}`;
    const resp  = assertOk(await clientsAPI.getOne(id));
    initOrUpdateTable(toArrayData(resp));
    logPaso(boton, api, resp);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Buscar por ID", `/por_id/${id}`, err);
    showAlert("danger", err?.message || "Cliente no encontrado");
  }
}

btnBuscar?.addEventListener("click", buscarPorTerm);
btnBuscarId?.addEventListener("click", buscarPorId);
btnLimpiar?.addEventListener("click", async () => {
  filtroTerm.value = "";
  filtroId.value   = "";
  soloActivos.checked = true;
  await cargarListadoInicial();
});

/* =========================
   Nuevo / Editar
   ========================= */
btnNuevo?.addEventListener("click", () => {
  modalTitulo.textContent = "Nuevo cliente";
  f_id.value = "";
  formCliente.reset();
  // En alta, contraseña visible/obligatoria
  grupoContra.classList.remove("d-none");
  f_contra.required = true;
  bsModalCliente().show();
  logPaso("Nuevo cliente", "(abrir modal)", { ok: true });
});

// Delegación: editar
$("#tablaClientes tbody").on("click", "button.btn-editar", async function () {
  const id = this.dataset.id;
  try {
    const boton = "Editar (cargar)";
    const api   = `/por_id/${id}`;
    const resp  = assertOk(await clientsAPI.getOne(id));
    const c     = toArrayData(resp)[0] || resp?.data || resp;
    const n     = normalizeCliente(c);

    modalTitulo.textContent = "Editar cliente";
    f_id.value    = n.cliente_id || id;
    f_cuenta.value= n.cuenta || "";
    f_email.value = n.email || "";

    // En edición, contraseña opcional/oculta
    grupoContra.classList.add("d-none");
    f_contra.required = false;
    f_contra.value = "";

    bsModalCliente().show();
    logPaso(boton, api, resp);
  } catch (err) {
    logError("Editar (cargar)", `/por_id/${id}`, err);
    showAlert("danger", err?.message || "No se pudo cargar el cliente");
  }
});

// Guardar (insert/update)
formCliente?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formCliente.classList.add("was-validated");
  if (!formCliente.checkValidity()) return;

  const id  = f_id.value.trim();
  const cue = f_cuenta.value.trim();
  const em  = f_email.value.trim();

  try {
    if (id) {
      const boton = "Guardar edición";
      const api   = "/update";
      const resp  = assertOk(await clientsAPI.update({ cliente_id: id, cuenta: cue, email: em }));
      logPaso(boton, api, resp);
      bsModalCliente().hide();
      await buscarPorTerm();
      showAlert("success", "Cliente actualizado.");
    } else {
      // Insert requiere contraseña
      const pw = f_contra.value.trim();
      if (!pw) {
        f_contra.focus();
        return;
      }
      const boton = "Guardar nuevo";
      const api   = "/insert";
      const resp  = assertOk(await clientsAPI.insert({ cuenta: cue, contrasena: pw, email: em }));
      logPaso(boton, api, resp);
      bsModalCliente().hide();
      await buscarPorTerm();
      showAlert("success", "Cliente creado.");
    }
  } catch (err) {
    logError(id ? "Guardar edición" : "Guardar nuevo", id ? "/update" : "/insert", err);
    showAlert("danger", err?.message || "No se pudo guardar");
  }
});

/* =========================
   Acciones: desactivar / reactivar / eliminar
   ========================= */
function abrirConfirm(accion, id, name) {
  confirmAccion.value = accion;
  confirmId.value = id;
  confirmTitulo.textContent =
    accion === "soft_delete" ? "Desactivar cliente" :
    accion === "reactivar"   ? "Reactivar cliente" :
    "Eliminar cliente";
  confirmMsg.textContent =
    accion === "soft_delete" ? `¿Deseas desactivar ${name} (${id})?` :
    accion === "reactivar"   ? `¿Deseas reactivar ${name} (${id})?` :
    `¿Eliminar definitivamente ${name} (${id})?`;
  bsModalConfirm().show();
}

$("#tablaClientes tbody").on("click", "button.btn-desactivar", function () {
  abrirConfirm("soft_delete", this.dataset.id, this.dataset.name || this.dataset.id);
  logPaso("Desactivar (abrir confirmación)", "(modal)", { id: this.dataset.id });
});
$("#tablaClientes tbody").on("click", "button.btn-reactivar", function () {
  abrirConfirm("reactivar", this.dataset.id, this.dataset.name || this.dataset.id);
  logPaso("Reactivar (abrir confirmación)", "(modal)", { id: this.dataset.id });
});
$("#tablaClientes tbody").on("click", "button.btn-eliminar", function () {
  abrirConfirm("delete", this.dataset.id, this.dataset.name || this.dataset.id);
  logPaso("Eliminar (abrir confirmación)", "(modal)", { id: this.dataset.id });
});

document.getElementById("btnConfirmarAccion")?.addEventListener("click", async () => {
  const accion = confirmAccion.value;
  const id     = confirmId.value;
  try {
    if (accion === "soft_delete") {
      const boton = "Desactivar cliente", api = "/soft_delete";
      const resp  = assertOk(await clientsAPI.softDelete(id));
      logPaso(boton, api, resp);
      showAlert("success", "Cliente desactivado.");
    } else if (accion === "reactivar") {
      const boton = "Reactivar cliente", api = "/reactivar";
      const resp  = assertOk(await clientsAPI.reactivate(id));
      logPaso(boton, api, resp);
      showAlert("success", "Cliente reactivado.");
    } else if (accion === "delete") {
      const boton = "Eliminar cliente", api = "/delete";
      const resp  = assertOk(await clientsAPI.remove(id));
      logPaso(boton, api, resp);
      showAlert("success", "Cliente eliminado.");
    }
    bsModalConfirm().hide();
    await buscarPorTerm();
  } catch (err) {
    logError("Acción cliente", accion, err);
    showAlert("danger", err?.message || "No se pudo completar la acción");
  }
});

/* =========================
   Búsqueda rápida por Enter
   ========================= */
filtroTerm?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    buscarPorTerm();
  }
});
filtroId?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    buscarPorId();
  }
});

/* =========================
   Boot
   ========================= */
document.addEventListener("DOMContentLoaded", cargarListadoInicial);
