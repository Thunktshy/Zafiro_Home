// /admin-resources/scripts/forms/metodos-pago.js
// Panel: Métodos de pago (Bootstrap + DataTables + logs estándar)
// Respuestas esperadas: { success, message, data }

import { metodosPagoAPI } from "/admin-resources/scripts/apis/metodosPagoManager.js";

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
function normalizeMetodo(row) {
  if (!row || typeof row !== "object") return null;
  return {
    metodo_id: Number(row.metodo_id ?? row.id ?? 0),
    cliente_id: String(row.cliente_id ?? ""),
    tipo: String(row.tipo ?? ""),
    es_principal: Number(row.es_principal ?? row.principal ?? 0) ? 1 : 0,
    direccion: String(row.direccion ?? ""),
    ciudad: String(row.ciudad ?? ""),
    codigo_postal: String(row.codigo_postal ?? ""),
    pais: String(row.pais ?? ""),
    creado: dtStr(row.fecha_creacion ?? row.created_at ?? row.fecha ?? null),
    // conservar crudo para edición
    _datos: row.datos ?? null
  };
}
function tryPrettyJSON(input) {
  const s = String(input ?? "").trim();
  if (!s) return "";
  try {
    const parsed = typeof input === "string" ? JSON.parse(s) : input;
    return JSON.stringify(parsed, null, 2);
  } catch { return s; }
}
function tryParseJSONOrText(s) {
  const t = String(s ?? "").trim();
  if (!t) return null; // que el backend reciba null si está vacío
  try { return JSON.parse(t); } catch { return t; }
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

const modalEl           = document.getElementById("modalMetodo");
const formMetodo        = document.getElementById("formMetodo");
const modalTitulo       = document.getElementById("modalTitulo");

const f_metodo_id       = document.getElementById("metodo_id");
const f_cliente_id      = document.getElementById("cliente_id");
const f_tipo            = document.getElementById("tipo");
const f_es_principal    = document.getElementById("es_principal");
const f_datos           = document.getElementById("datos");
const f_direccion       = document.getElementById("direccion");
const f_ciudad          = document.getElementById("ciudad");
const f_cp              = document.getElementById("codigo_postal");
const f_pais            = document.getElementById("pais");

const rbOrigenManual    = document.getElementById("origenManual");
const rbOrigenPers      = document.getElementById("origenPersonales");
const grupoCamposManual = document.getElementById("grupoCamposManual");
const btnFormatearJSON  = document.getElementById("btnFormatearJSON");

// Confirmación
const modalConfirmEl    = document.getElementById("modalConfirm");
const confirmTitulo     = document.getElementById("confirmTitulo");
const confirmMsg        = document.getElementById("confirmMsg");
const confirmAccion     = document.getElementById("confirmAccion");
const confirmId         = document.getElementById("confirmId");

// Bootstrap helpers
const bsModal       = () => bootstrap.Modal.getOrCreateInstance(modalEl);
const bsModalConfirm= () => bootstrap.Modal.getOrCreateInstance(modalConfirmEl);

/* =========================
   DataTable
========================= */
let dt = null;
function initOrUpdateTable(rows) {
  const data = (rows || []).map(normalizeMetodo).filter(Boolean);
  if (dt) {
    dt.clear().rows.add(data).draw();
    return dt;
  }
  dt = $("#tablaMetodos").DataTable({
    data,
    columns: [
      { data: "metodo_id", title: "ID" },
      { data: "cliente_id", title: "Cliente" },
      { data: "tipo", title: "Tipo" },
      {
        data: "es_principal", title: "Principal",
        render: (v) => Number(v) ? `<span class="badge bg-success">Sí</span>` : `<span class="badge bg-secondary">No</span>`
      },
      { data: "direccion", title: "Dirección" },
      { data: "ciudad", title: "Ciudad" },
      { data: "codigo_postal", title: "CP" },
      { data: "pais", title: "País" },
      { data: "creado", title: "Creado" },
      {
        data: null,
        title: "Acciones",
        className: "text-end",
        orderable: false,
        render: (row) => `
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary btn-editar" data-id="${row.metodo_id}">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-outline-danger btn-eliminar" data-id="${row.metodo_id}">
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
    const resp = assertOk(await metodosPagoAPI.getAll());
    const arr  = toArrayData(resp);
    initOrUpdateTable(arr);
    logPaso("Listar todos", api, resp);
    showAlert("info", `Se cargaron ${arr.length} registro(s)`);
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
    const resp = assertOk(await metodosPagoAPI.getByCliente(id));
    const arr  = toArrayData(resp);
    initOrUpdateTable(arr);
    logPaso("Buscar por cliente", api, resp);
    showAlert("info", `Se cargaron ${arr.length} registro(s)`);
  } catch (err) {
    initOrUpdateTable([]);
    logError("Buscar por cliente", `/select_by_cliente/${id}`, err);
    showAlert("danger", err?.message || "Cliente sin métodos de pago");
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
  if (e.key === "Enter") { e.preventDefault(); buscarPorCliente(); }
});

/* =========================
   Nuevo / Editar
========================= */
function toggleOrigen() {
  const manual = rbOrigenManual.checked;
  grupoCamposManual.classList.toggle("d-none", !manual);
}
[rbOrigenManual, rbOrigenPers].forEach((el) => el?.addEventListener("change", toggleOrigen));

btnNuevo?.addEventListener("click", () => {
  formMetodo.reset();
  f_metodo_id.value = "";
  rbOrigenManual.checked = true;
  rbOrigenPers.checked = false;
  toggleOrigen();
  modalTitulo.textContent = "Nuevo método";
  bsModal().show();
  logPaso("Nuevo método", "(abrir modal)", { ok: true });
});

// Cargar datos de la fila para editar
$("#tablaMetodos tbody").on("click", "button.btn-editar", function () {
  const row = dt?.row($(this).closest("tr")).data();
  if (!row) return;
  const n = normalizeMetodo(row);

  f_metodo_id.value    = n.metodo_id;
  f_cliente_id.value   = n.cliente_id;
  f_tipo.value         = n.tipo || "";
  f_es_principal.checked = !!n.es_principal;
  f_direccion.value    = n.direccion || "";
  f_ciudad.value       = n.ciudad || "";
  f_cp.value           = n.codigo_postal || "";
  f_pais.value         = n.pais || "";
  f_datos.value        = tryPrettyJSON(row._datos);

  // En edición, siempre manual (update no tiene “from_personales”)
  rbOrigenManual.checked = true;
  rbOrigenPers.checked = false;
  toggleOrigen();

  modalTitulo.textContent = "Editar método";
  bsModal().show();
  logPaso("Editar (abrir modal)", "(UI)", n);
});

btnFormatearJSON?.addEventListener("click", () => {
  f_datos.value = tryPrettyJSON(f_datos.value);
  logPaso("Formatear JSON", "(UI)", { ok: true });
});

// Guardar (insert/update)
formMetodo?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formMetodo.classList.add("was-validated");
  if (!formMetodo.checkValidity()) return;

  const payloadBase = {
    cliente_id: ensureCl(f_cliente_id.value),
    tipo: f_tipo.value.trim(),
    direccion: f_direccion.value.trim() || null,
    ciudad: f_ciudad.value.trim() || null,
    codigo_postal: f_cp.value.trim() || null,
    pais: f_pais.value.trim() || null,
    es_principal: f_es_principal.checked ? 1 : 0
  };

  try {
    if (f_metodo_id.value) {
      // UPDATE siempre manual (se debe enviar "datos")
      const api  = "/update";
      const resp = assertOk(await metodosPagoAPI.update({
        metodo_id: Number(f_metodo_id.value),
        ...payloadBase,
        datos: tryParseJSONOrText(f_datos.value)
      }));
      logPaso("Guardar edición", api, resp);
      bsModal().hide();
      await recargarSegunFiltro();
      showAlert("success", "Método actualizado.");
    } else {
      if (rbOrigenPers.checked) {
        const api  = "/from_personales";
        const resp = assertOk(await metodosPagoAPI.insertFromPersonales({
          cliente_id: payloadBase.cliente_id,
          tipo: payloadBase.tipo,
          es_principal: payloadBase.es_principal
        }));
        logPaso("Guardar nuevo (desde personales)", api, resp);
      } else {
        const api  = "/insert";
        const resp = assertOk(await metodosPagoAPI.insert({
          ...payloadBase,
          datos: tryParseJSONOrText(f_datos.value)
        }));
        logPaso("Guardar nuevo", api, resp);
      }
      bsModal().hide();
      await recargarSegunFiltro();
      showAlert("success", "Método creado.");
    }
  } catch (err) {
    logError(f_metodo_id.value ? "Guardar edición" : "Guardar nuevo",
             f_metodo_id.value ? "/update" : (rbOrigenPers.checked ? "/from_personales" : "/insert"),
             err);
    showAlert("danger", err?.message || "No se pudo guardar");
  }
});

/* =========================
   Eliminar (confirmación)
========================= */
function abrirConfirmDelete(metodo_id) {
  confirmAccion.value = "delete";
  confirmId.value = String(metodo_id ?? "");
  confirmTitulo.textContent = "Eliminar método de pago";
  confirmMsg.textContent = `¿Eliminar el método #${metodo_id}?`;
  bsModalConfirm().show();
}
$("#tablaMetodos tbody").on("click", "button.btn-eliminar", function () {
  const id = this.dataset.id;
  abrirConfirmDelete(id);
  logPaso("Eliminar (abrir confirmación)", "(modal)", { id });
});

document.getElementById("btnConfirmarAccion")?.addEventListener("click", async () => {
  if (confirmAccion.value !== "delete") return;
  const id = Number(confirmId.value);
  try {
    const api  = "/delete";
    const resp = assertOk(await metodosPagoAPI.remove(id));
    logPaso("Eliminar", api, resp);
    bsModalConfirm().hide();
    await recargarSegunFiltro();
    showAlert("success", "Método eliminado.");
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
      const resp = assertOk(await metodosPagoAPI.getByCliente(id));
      initOrUpdateTable(toArrayData(resp));
      return;
    }
    const resp = assertOk(await metodosPagoAPI.getAll());
    initOrUpdateTable(toArrayData(resp));
  } catch (err) {
    initOrUpdateTable([]);
    logError("recargarSegunFiltro", "(metodos_pago)", err);
  }
}

/* =========================
   Boot
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await listarTodos();
  // UI init
  toggleOrigen();
});
