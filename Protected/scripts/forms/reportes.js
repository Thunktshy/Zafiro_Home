// Panel: Reportes (Bootstrap + DataTables + Chart.js + logs estándar)
// Estructura esperada: { success, message, data }

import { reportesAPI } from "/admin-resources/scripts/apis/reportesManager.js";

/* =========================
   Helpers de logging + normalización
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
const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const dtStr = (x) => {
  if (!x) return "";
  const d = typeof x === "string" || typeof x === "number" ? new Date(x) : x;
  return isNaN(d?.getTime?.()) ? "" : d.toLocaleString("es-MX");
};
const ym = (y, m) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;

/* =========================
   Normalizadores por reporte
========================= */
function normalizePivotRow(row) {
  if (!row || typeof row !== "object") return null;
  const year   = row.anio ?? row.year ?? row.Año ?? row.Y ?? null;
  const month  = row.mes ?? row.month ?? row.Mes ?? row.M ?? null;
  const label  = row.periodo ?? row.ym ?? row["Año-Mes"] ?? (year != null && month != null ? ym(year, month) : "");
  const ventas = Number(row.ventas ?? row.unidades ?? row.pedidos ?? row.count ?? 0) || 0;
  const importe= Number(row.importe ?? row.total ?? row.monto ?? row.suma ?? 0) || 0;
  return { periodo: String(label || ""), ventas, importe };
}
function normalizeTopRow(row) {
  if (!row || typeof row !== "object") return null;
  const nombre = row.nombre_producto ?? row.nombre ?? row.producto ?? row.Producto ?? "";
  const unidades = Number(row.unidades ?? row.ventas ?? row.cantidad ?? row.count ?? 0) || 0;
  const importe  = Number(row.importe ?? row.total ?? row.monto ?? 0) || 0;
  return { producto: String(nombre), unidades, importe };
}
function normalizeClienteRow(row) {
  if (!row || typeof row !== "object") return null;
  const cliente_id = row.cliente_id ?? row.cliente ?? row.id ?? "";
  const cuenta     = row.cuenta ?? row.username ?? "";
  const email      = row.email ?? row.correo ?? "";
  const pedidos    = Number(row.pedidos ?? row.ordenes ?? row.orders ?? row.count ?? 0) || 0;
  const importe    = Number(row.importe ?? row.total ?? row.monto ?? 0) || 0;
  return {
    cliente_id: String(cliente_id),
    cuenta_email: `${cuenta || ""}${cuenta && email ? " / " : ""}${email || ""}`,
    pedidos,
    importe
  };
}
function normalizeHistRow(row) {
  if (!row || typeof row !== "object") return null;
  const pedido_id = row.pedido_id ?? row.pedido ?? row.id ?? "";
  const fecha     = dtStr(row.fecha ?? row.fecha_pedido ?? row.created_at ?? null);
  const estado    = row.estado ?? row.estado_pedido ?? "";
  const importe   = Number(row.importe ?? row.total ?? row.monto ?? 0) || 0;
  return { pedido_id: String(pedido_id), fecha, estado, importe };
}

/* =========================
   DOM refs
========================= */
const desdeInput         = document.getElementById("desde");
const hastaInput         = document.getElementById("hasta");
const btnAplicarFechas   = document.getElementById("btnAplicarFechas");
const btnLimpiarFechas   = document.getElementById("btnLimpiarFechas");
const alertBox           = document.getElementById("alertBox");

// Pivot
const tablaPivotEl       = document.getElementById("tablaPivot");
const chartPivotEl       = document.getElementById("chartPivot");

// Top ventas
const limitTopInput      = document.getElementById("limitTop");
const btnRefrescarTop    = document.getElementById("btnRefrescarTop");
const tablaTopEl         = document.getElementById("tablaTop");
const chartTopEl         = document.getElementById("chartTop");

// Clientes frecuencia
const tablaClientesEl    = document.getElementById("tablaClientes");
const chartClientesEl    = document.getElementById("chartClientes");

// Historial
const histClienteInput   = document.getElementById("histCliente");
const histDesdeInput     = document.getElementById("histDesde");
const histHastaInput     = document.getElementById("histHasta");
const btnBuscarHist      = document.getElementById("btnBuscarHist");
const tablaHistEl        = document.getElementById("tablaHistorial");

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
function markInvalid(el, invalid = true) {
  if (!el) return;
  el.classList.toggle("is-invalid", !!invalid);
}
function allFilled(...els) {
  return els.every((el) => el && String(el.value || "").trim().length > 0);
}
function validateDatesOrder(desde, hasta) {
  if (!desde || !hasta) return true;
  const d = new Date(desde), h = new Date(hasta);
  if (isNaN(d) || isNaN(h)) return false;
  return d.getTime() <= h.getTime();
}
function syncButtonsDisabled() {
  const globalOk = allFilled(desdeInput, hastaInput);
  btnAplicarFechas?.toggleAttribute("disabled", !globalOk);
  btnRefrescarTop?.toggleAttribute("disabled", !globalOk);

  const histOk = allFilled(histClienteInput, histDesdeInput, histHastaInput);
  btnBuscarHist?.toggleAttribute("disabled", !histOk);
}

/* =========================
   DataTables (instancias)
========================= */
let dtPivot = null, dtTop = null, dtClientes = null, dtHist = null;

function renderTablePivot(rows) {
  const data = rows.map(normalizePivotRow).filter(Boolean);
  if (dtPivot) {
    dtPivot.clear().rows.add(data).draw();
    return data;
  }
  dtPivot = $("#tablaPivot").DataTable({
    data,
    columns: [
      { data: "periodo", title: "Año-Mes" },
      { data: "ventas",  title: "Ventas" },
      { data: "importe", title: "Importe", render: (v) => money(v) }
    ],
    pageLength: 12,
    order: [[0, "asc"]],
    responsive: true
  });
  return data;
}
function renderTableTop(rows) {
  const data = rows.map(normalizeTopRow).filter(Boolean);
  if (dtTop) {
    dtTop.clear().rows.add(data).draw();
    return data;
  }
  dtTop = $("#tablaTop").DataTable({
    data,
    columns: [
      { data: null, title: "#", render: (_v, _t, _r, meta) => meta.row + 1 },
      { data: "producto",  title: "Producto" },
      { data: "unidades",  title: "Unidades" },
      { data: "importe",   title: "Importe", render: (v) => money(v) }
    ],
    pageLength: 10,
    order: [[2, "desc"]],
    responsive: true
  });
  return data;
}
function renderTableClientes(rows) {
  const data = rows.map(normalizeClienteRow).filter(Boolean);
  if (dtClientes) {
    dtClientes.clear().rows.add(data).draw();
    return data;
  }
  dtClientes = $("#tablaClientes").DataTable({
    data,
    columns: [
      { data: "cliente_id",   title: "Cliente" },
      { data: "cuenta_email", title: "Cuenta/Email" },
      { data: "pedidos",      title: "Pedidos" },
      { data: "importe",      title: "Importe", render: (v) => money(v) }
    ],
    pageLength: 10,
    order: [[2, "desc"]],
    responsive: true
  });
  return data;
}
function renderTableHist(rows) {
  const data = rows.map(normalizeHistRow).filter(Boolean);
  if (dtHist) {
    dtHist.clear().rows.add(data).draw();
    return data;
  }
  dtHist = $("#tablaHistorial").DataTable({
    data,
    columns: [
      { data: "pedido_id", title: "Pedido" },
      { data: "fecha",     title: "Fecha" },
      { data: "estado",    title: "Estado" },
      { data: "importe",   title: "Importe", render: (v) => money(v) }
    ],
    pageLength: 10,
    order: [[1, "desc"]],
    responsive: true
  });
  return data;
}

/* =========================
   Charts (Chart.js)
========================= */
let chartPivot = null, chartTop = null, chartClientes = null;

function drawPivotChart(rows) {
  const data = rows.map(normalizePivotRow).filter(Boolean);
  const labels = data.map(r => r.periodo);
  const ventas = data.map(r => r.ventas);
  const importe = data.map(r => r.importe);

  if (chartPivot) chartPivot.destroy();
  chartPivot = new Chart(chartPivotEl.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [
      { label: "Ventas (unidades)", data: ventas },
      { label: "Importe (MXN)", data: importe }
    ] }
  });
}
function drawTopChart(rows) {
  const data = rows.map(normalizeTopRow).filter(Boolean);
  const labels = data.map(r => r.producto);
  const unidades = data.map(r => r.unidades);

  if (chartTop) chartTop.destroy();
  chartTop = new Chart(chartTopEl.getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Unidades vendidas", data: unidades }] }
  });
}
function drawClientesChart(rows) {
  const data = rows.map(normalizeClienteRow).filter(Boolean).slice(0, 10);
  const labels = data.map(r => r.cliente_id);
  const pedidos = data.map(r => r.pedidos);

  if (chartClientes) chartClientes.destroy();
  chartClientes = new Chart(chartClientesEl.getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Pedidos", data: pedidos }] }
  });
}

/* =========================
   Validaciones y cargas (con guardas)
========================= */
function getFechas() {
  return {
    desde: (desdeInput.value || "").trim(),
    hasta: (hastaInput.value || "").trim()
  };
}
function guardGlobalFechas(actionLabel) {
  const { desde, hasta } = getFechas();
  const both = allFilled(desdeInput, hastaInput);
  markInvalid(desdeInput, !desde);
  markInvalid(hastaInput, !hasta);
  if (!both) {
    showAlert("warning", "Completa las fechas 'Desde' y 'Hasta' antes de continuar.");
    return null;
  }
  if (!validateDatesOrder(desde, hasta)) {
    markInvalid(desdeInput, true); markInvalid(hastaInput, true);
    showAlert("danger", "El rango de fechas es inválido: 'Desde' no puede ser mayor que 'Hasta'.");
    return null;
  }
  return { desde, hasta, actionLabel };
}

async function cargarPivot(trigger = "(user)") {
  const g = guardGlobalFechas(trigger);
  if (!g) return;
  const { desde, hasta } = g;
  try {
    const api  = `/reportes/ventas_mensual_pivot?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;
    const resp = assertOk(await reportesAPI.ventasMensualPivot(desde, hasta));
    const arr  = toArrayData(resp);
    const data = renderTablePivot(arr);
    drawPivotChart(data);
    logPaso(trigger, api, resp);
  } catch (err) {
    renderTablePivot([]);
    if (chartPivot) { chartPivot.destroy(); chartPivot = null; }
    logError(trigger, "/reportes/ventas_mensual_pivot", err);
    showAlert("danger", err?.message || "No fue posible cargar 'Ventas mensual (pivot)'.");
  }
}

async function cargarTop(trigger = "Refrescar Top") {
  const g = guardGlobalFechas(trigger);
  if (!g) return;
  const { desde, hasta } = g;
  const limit = Number(limitTopInput.value || 10) || 10;
  try {
    const api  = `/reportes/top_ventas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&limit=${limit}`;
    const resp = assertOk(await reportesAPI.topVentas(desde, hasta, limit));
    const arr  = toArrayData(resp);
    const data = renderTableTop(arr);
    drawTopChart(data);
    logPaso(trigger, api, resp);
  } catch (err) {
    renderTableTop([]);
    if (chartTop) { chartTop.destroy(); chartTop = null; }
    logError(trigger, "/reportes/top_ventas", err);
    showAlert("danger", err?.message || "No fue posible cargar 'Top ventas'.");
  }
}

async function cargarClientes(trigger = "(user) clientes") {
  const g = guardGlobalFechas(trigger);
  if (!g) return;
  const { desde, hasta } = g;
  try {
    const api  = `/reportes/clientes_frecuencia_compra?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;
    const resp = assertOk(await reportesAPI.clientesFrecuencia(desde, hasta));
    const arr  = toArrayData(resp);
    const data = renderTableClientes(arr);
    drawClientesChart(data);
    logPaso(trigger, api, resp);
  } catch (err) {
    renderTableClientes([]);
    if (chartClientes) { chartClientes.destroy(); chartClientes = null; }
    logError(trigger, "/reportes/clientes_frecuencia_compra", err);
    showAlert("danger", err?.message || "No fue posible cargar 'Clientes · Frecuencia'.");
  }
}

function guardHistorial() {
  const cliente = ensureCl(histClienteInput.value);
  const desde   = (histDesdeInput.value || "").trim();
  const hasta   = (histHastaInput.value || "").trim();

  markInvalid(histClienteInput, !cliente);
  markInvalid(histDesdeInput, !desde);
  markInvalid(histHastaInput, !hasta);

  if (!allFilled({ value: cliente }, { value: desde }, { value: hasta })) {
    showAlert("warning", "Completa Cliente, Desde y Hasta para buscar historial.");
    return null;
  }
  if (!validateDatesOrder(desde, hasta)) {
    markInvalid(histDesdeInput, true); markInvalid(histHastaInput, true);
    showAlert("danger", "El rango de fechas del historial es inválido.");
    return null;
  }
  return { cliente, desde, hasta };
}

async function cargarHistorial(trigger = "Buscar historial") {
  const g = guardHistorial();
  if (!g) return;
  const { cliente, desde, hasta } = g;
  try {
    const api  = `/reportes/historial_cliente?cliente_id=${encodeURIComponent(cliente)}&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;
    const resp = assertOk(await reportesAPI.historialCliente(cliente, desde, hasta));
    const arr  = toArrayData(resp);
    renderTableHist(arr);
    logPaso(trigger, api, resp);
    showAlert("info", `Se cargaron ${arr.length} movimientos`);
  } catch (err) {
    renderTableHist([]);
    logError(trigger, `/reportes/historial_cliente?cliente_id=${cliente}`, err);
    showAlert("danger", err?.message || "No fue posible cargar el historial");
  }
}

/* =========================
   Eventos UI
========================= */
// habilitar/deshabilitar según llenado
[desdeInput, hastaInput, histClienteInput, histDesdeInput, histHastaInput].forEach((el) => {
  el?.addEventListener("input", () => {
    markInvalid(el, !String(el.value || "").trim().length);
    syncButtonsDisabled();
  });
});

// Global
btnAplicarFechas?.addEventListener("click", async () => {
  // Aplica fechas actuales a TODOS los reportes (excepto historial)
  const guard = guardGlobalFechas("Aplicar a todos");
  if (!guard) return;
  await Promise.all([cargarPivot("Aplicar a todos"), cargarTop("Aplicar a todos"), cargarClientes("Aplicar a todos")]);
});
btnLimpiarFechas?.addEventListener("click", async () => {
  desdeInput.value = ""; hastaInput.value = "";
  markInvalid(desdeInput, false); markInvalid(hastaInput, false);
  syncButtonsDisabled();
  // Limpia tablas y gráficos
  renderTablePivot([]); if (chartPivot) { chartPivot.destroy(); chartPivot = null; }
  renderTableTop([]);   if (chartTop)   { chartTop.destroy();   chartTop   = null; }
  renderTableClientes([]); if (chartClientes) { chartClientes.destroy(); chartClientes = null; }
  showAlert("secondary", "Fechas limpiadas.");
});

// Top ventas
btnRefrescarTop?.addEventListener("click", async () => {
  await cargarTop("Refrescar Top");
});

// Historial por cliente
btnBuscarHist?.addEventListener("click", async () => {
  await cargarHistorial("Buscar historial");
});
histClienteInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    cargarHistorial("Buscar historial (enter)");
  }
});

/* =========================
   Boot
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Inicializa tablas vacías para que se vean encabezados al cargar
  renderTablePivot([]); renderTableTop([]); renderTableClientes([]); renderTableHist([]);

  // No se llaman APIs hasta que el usuario complete los campos requeridos.
  syncButtonsDisabled();
});
