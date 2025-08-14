// /admin-resources/scripts/forms/stock-alertas.js
// Panel: Stock & Alertas (Logs, ajustes de stock, alertas, precios masivos)

import { categoriasAPI } from "/admin-resources/scripts/apis/categoriasManager.js";
import { gestionStockAlertasAPI as gsaAPI } from "/admin-resources/scripts/apis/gestion_stock_y_alertasManager.js";

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
const ensurePrd = (id) => {
  const s = String(id ?? "").trim();
  if (!s) return "";
  return /^\d+$/.test(s) ? `prd-${s}` : s.toLowerCase().startsWith("prd-") ? s : `prd-${s}`;
};

// Normaliza un renglón de LOG a las columnas esperadas en la tabla
function normalizeLog(row) {
  if (!row || typeof row !== "object") return null;
  const fechaRaw =
    row.fecha || row.fecha_log || row.created_at || row.fecha_registro || row.timestamp || null;
  const fecha = fechaRaw ? new Date(fechaRaw) : null;

  const producto =
    row.producto_id ?? row.producto ?? row.id_producto ?? row.ProductoID ?? null;
  const categoria =
    row.categoria_id ?? row.categoria ?? row.id_categoria ?? row.CategoriaID ?? null;

  const accion = row.accion ?? row.action ?? row.tipo ?? "";
  const cantidad =
    row.cantidad ?? row.qty ?? row.cant ?? row.delta ?? null;
  const stock =
    row.stock ?? row.stock_resultante ?? row.nuevo_stock ?? row.stock_nuevo ?? null;

  const usuario =
    row.usuario ?? row.user ?? row.usuario_id ?? row.User ?? "";
  const nota =
    row.nota ?? row.comentario ?? row.detalle ?? row.descripcion ?? "";

  return {
    fecha: fecha ? fecha.toLocaleString("es-MX") : "",
    producto: producto != null ? String(producto) : "",
    categoria: categoria != null ? String(categoria) : "",
    accion: String(accion || ""),
    cantidad: Number(cantidad ?? 0),
    stock: Number(stock ?? 0),
    usuario: String(usuario || ""),
    nota: String(nota || "")
  };
}
function mapLogs(resp) {
  return toArrayData(resp).map(normalizeLog).filter(Boolean);
}

/* =========================
   UI helpers
   ========================= */
function showAlert(kind, msg) {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.className = `alert alert-${kind}`;
  box.textContent = msg;
  box.classList.remove("d-none");
  setTimeout(() => box.classList.add("d-none"), 2600);
}

/* =========================
   Referencias DOM
   ========================= */
const filtroProducto   = document.getElementById("filtroProducto");
const filtroCategoria  = document.getElementById("filtroCategoria");
const filtroDesde      = document.getElementById("filtroDesde");
const filtroHasta      = document.getElementById("filtroHasta");
const btnAplicarFiltros= document.getElementById("btnAplicarFiltros");
const btnLimpiarFiltros= document.getElementById("btnLimpiarFiltros");

const btnAgregarStock  = document.getElementById("btnAgregarStock");
const btnReducirStock  = document.getElementById("btnReducirStock");
const btnGenerarAlertas= document.getElementById("btnGenerarAlertas");
const btnPreciosMasivos= document.getElementById("btnPreciosMasivos");

// Modales y campos (Stock)
const modalStockEl     = document.getElementById("modalStock");
const formStock        = document.getElementById("formStock");
const stockAccion      = document.getElementById("stockAccion");
const stockProductoId  = document.getElementById("stockProductoId");
const stockCantidad    = document.getElementById("stockCantidad");

// Modales y campos (Alertas)
const modalAlertasEl   = document.getElementById("modalAlertas");
const formAlertas      = document.getElementById("formAlertas");
const umbralGlobal     = document.getElementById("umbralGlobal");
const soloActivos      = document.getElementById("soloActivos");

// Modales y campos (Precios)
const modalPreciosEl   = document.getElementById("modalPrecios");
const formPrecios      = document.getElementById("formPrecios");
const precioIncrementar= document.getElementById("precioIncrementar");
const precioReducir    = document.getElementById("precioReducir");
const precioDescuento  = document.getElementById("precioDescuento");
const grupoMonto       = document.getElementById("grupoMonto");
const grupoPorcentaje  = document.getElementById("grupoPorcentaje");
const monto            = document.getElementById("monto");
const porcentaje       = document.getElementById("porcentaje");
const categoriaPrecio  = document.getElementById("categoriaPrecio");
const soloActivosPrecio= document.getElementById("soloActivosPrecio");

// Bootstrap helpers
const bsModalStock   = () => bootstrap.Modal.getOrCreateInstance(modalStockEl);
const bsModalAlertas = () => bootstrap.Modal.getOrCreateInstance(modalAlertasEl);
const bsModalPrecios = () => bootstrap.Modal.getOrCreateInstance(modalPreciosEl);

/* =========================
   DataTable (logs)
   ========================= */
let dtLogs = null;
function initOrUpdateLogs(rows) {
  const data = Array.isArray(rows) ? rows : [];
  if (dtLogs) {
    dtLogs.clear().rows.add(data).draw();
    return dtLogs;
  }
  dtLogs = $("#tablaLogs").DataTable({
    data,
    columns: [
      { data: "fecha", title: "Fecha" },
      { data: "producto", title: "Producto" },
      { data: "categoria", title: "Categoría" },
      { data: "accion", title: "Acción" },
      { data: "cantidad", title: "Cantidad" },
      { data: "stock", title: "Stock" },
      { data: "usuario", title: "Usuario" },
      { data: "nota", title: "Nota" }
    ],
    pageLength: 10,
    order: [[0, "desc"]],
    responsive: true
  });
  return dtLogs;
}

/* =========================
   Carga de categorías en selects
   ========================= */
async function cargarCategorias() {
  try {
    const resp = assertOk(await categoriasAPI.getList());
    const lista = toArrayData(resp)
      .map((c) => ({
        id: c.categoria_id ?? c.id,
        nombre: c.nombre_categoria ?? c.nombre
      }))
      .filter((c) => c.id != null && c.nombre != null);

    // Filtro
    while (filtroCategoria.firstChild) filtroCategoria.removeChild(filtroCategoria.firstChild);
    let op = document.createElement("option");
    op.value = "";
    op.textContent = "(Todas)";
    filtroCategoria.appendChild(op);
    lista.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = `${c.id} — ${c.nombre}`;
      filtroCategoria.appendChild(o);
    });

    // Precios (categoría opcional)
    while (categoriaPrecio.firstChild) categoriaPrecio.removeChild(categoriaPrecio.firstChild);
    op = document.createElement("option");
    op.value = "";
    op.textContent = "(Todas)";
    categoriaPrecio.appendChild(op);
    lista.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = `${c.id} — ${c.nombre}`;
      categoriaPrecio.appendChild(o);
    });

    logPaso("(auto) cargar categorias", "/categorias/get_list", resp);
  } catch (err) {
    console.error("Error al cargar categorias:", err?.message || err);
  }
}

/* =========================
   Filtros de logs
   ========================= */
async function aplicarFiltros() {
  const p = ensurePrd(filtroProducto.value);
  const c = filtroCategoria.value;
  const d = filtroDesde.value;
  const h = filtroHasta.value;

  try {
    let resp, api, boton = "Aplicar filtros";
    if (p && d && h) {
      api = `/logs/by_producto_rango/${p}?desde=${d}&hasta=${h}`;
      resp = assertOk(await gsaAPI.logsGetByProductoRango(p, d, h));
    } else if (c && d && h) {
      api = `/logs/by_categoria_rango?categoria_id=${c}&desde=${d}&hasta=${h}`;
      resp = assertOk(await gsaAPI.logsGetByCategoriaRango(c, d, h));
    } else if (p && !d && !h) {
      api = `/logs/by_producto/${p}`;
      resp = assertOk(await gsaAPI.logsGetByProducto(p));
    } else if (c && !d && !h) {
      api = `/logs/by_categoria/${c}`;
      resp = assertOk(await gsaAPI.logsGetByCategoria(c));
    } else if (!p && !c && d && h) {
      api = `/logs/by_rango?desde=${d}&hasta=${h}`;
      resp = assertOk(await gsaAPI.logsGetByRango(d, h));
    } else {
      api = "/logs/all";
      resp = assertOk(await gsaAPI.logsGetAll());
    }

    const data = mapLogs(resp);
    initOrUpdateLogs(data);
    logPaso(boton, api, resp);
    showAlert("info", `Se cargaron ${data.length} registros`);
  } catch (err) {
    initOrUpdateLogs([]);
    logError("Aplicar filtros", "(varios)", err);
    showAlert("danger", err?.message || "Error al aplicar filtros");
  }
}

btnAplicarFiltros?.addEventListener("click", aplicarFiltros);

btnLimpiarFiltros?.addEventListener("click", async () => {
  filtroProducto.value = "";
  filtroCategoria.value = "";
  filtroDesde.value = "";
  filtroHasta.value = "";
  try {
    const resp = assertOk(await gsaAPI.logsGetAll());
    initOrUpdateLogs(mapLogs(resp));
    logPaso("Limpiar filtros", "/logs/all", resp);
  } catch (err) {
    initOrUpdateLogs([]);
    logError("Limpiar filtros", "/logs/all", err);
  }
});

/* =========================
   Ajustes de stock (modal)
   ========================= */
btnAgregarStock?.addEventListener("click", () => {
  stockAccion.value = "agregar";
  document.getElementById("modalStockTitulo").textContent = "Agregar stock";
  formStock.reset();
  bsModalStock().show();
  logPaso("Agregar stock", "(abrir modal)", { ok: true });
});

btnReducirStock?.addEventListener("click", () => {
  stockAccion.value = "reducir";
  document.getElementById("modalStockTitulo").textContent = "Reducir stock";
  formStock.reset();
  bsModalStock().show();
  logPaso("Reducir stock", "(abrir modal)", { ok: true });
});

formStock?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formStock.classList.add("was-validated");
  if (!formStock.checkValidity()) return;

  const payload = {
    producto_id: ensurePrd(stockProductoId.value),
    cantidad: Number(stockCantidad.value)
  };

  try {
    if (stockAccion.value === "reducir") {
      const api = "/stock/reducir";
      const resp = assertOk(await gsaAPI.stockReducir(payload));
      logPaso("Guardar stock (reducir)", api, resp);
      showAlert("success", "Stock reducido.");
    } else {
      const api = "/stock/agregar";
      const resp = assertOk(await gsaAPI.stockAgregar(payload));
      logPaso("Guardar stock (agregar)", api, resp);
      showAlert("success", "Stock agregado.");
    }
    bsModalStock().hide();
    await aplicarFiltros();
  } catch (err) {
    logError("Guardar stock", stockAccion.value === "reducir" ? "/stock/reducir" : "/stock/agregar", err);
    showAlert("danger", err?.message || "Error al ajustar stock");
  }
});

/* =========================
   Alertas (modal)
   ========================= */
btnGenerarAlertas?.addEventListener("click", () => {
  formAlertas.reset();
  umbralGlobal.value = 5;
  soloActivos.checked = true;
  bsModalAlertas().show();
  logPaso("Generar alertas", "(abrir modal)", { ok: true });
});

formAlertas?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formAlertas.classList.add("was-validated");
  if (!formAlertas.checkValidity()) return;

  const payload = {
    umbral_global: Number(umbralGlobal.value),
    solo_activos: soloActivos.checked ? 1 : 0
  };

  try {
    const api = "/alertas/generar";
    const resp = assertOk(await gsaAPI.alertasGenerar(payload));
    logPaso("Generar alertas (guardar)", api, resp);
    bsModalAlertas().hide();
    showAlert("success", "Alertas generadas.");
    await aplicarFiltros();
  } catch (err) {
    logError("Generar alertas (guardar)", "/alertas/generar", err);
    showAlert("danger", err?.message || "Error al generar alertas");
  }
});

/* =========================
   Precios masivos (modal)
   ========================= */
function togglePrecioInputs() {
  const isDescuento = precioDescuento.checked;
  grupoMonto.classList.toggle("d-none", isDescuento);
  grupoPorcentaje.classList.toggle("d-none", !isDescuento);
  if (isDescuento) {
    monto.value = "";
  } else {
    porcentaje.value = "";
  }
}
[precioIncrementar, precioReducir, precioDescuento].forEach((el) =>
  el?.addEventListener("change", togglePrecioInputs)
);

btnPreciosMasivos?.addEventListener("click", () => {
  formPrecios.reset();
  precioIncrementar.checked = true;
  togglePrecioInputs();
  soloActivosPrecio.checked = true;
  categoriaPrecio.value = "";
  bsModalPrecios().show();
  logPaso("Precios masivos", "(abrir modal)", { ok: true });
});

formPrecios?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formPrecios.classList.add("was-validated");

  try {
    let resp, api, boton = "Aplicar precios";
    if (precioDescuento.checked) {
      if (!porcentaje.value || Number(porcentaje.value) <= 0) return;
      api = "/precios/descuento";
      resp = assertOk(await gsaAPI.preciosAgregarDescuento({
        porcentaje: Number(porcentaje.value),
        categoria_id: categoriaPrecio.value ? Number(categoriaPrecio.value) : null,
        solo_activos: soloActivosPrecio.checked ? 1 : 0
      }));
    } else if (precioReducir.checked) {
      if (!monto.value || Number(monto.value) <= 0) return;
      api = "/precios/reducir";
      resp = assertOk(await gsaAPI.preciosReducir({
        monto: Number(monto.value),
        categoria_id: categoriaPrecio.value ? Number(categoriaPrecio.value) : null,
        solo_activos: soloActivosPrecio.checked ? 1 : 0
      }));
    } else {
      if (!monto.value || Number(monto.value) <= 0) return;
      api = "/precios/incrementar";
      resp = assertOk(await gsaAPI.preciosIncrementar({
        monto: Number(monto.value),
        categoria_id: categoriaPrecio.value ? Number(categoriaPrecio.value) : null,
        solo_activos: soloActivosPrecio.checked ? 1 : 0
      }));
    }
    logPaso(boton, api, resp);
    bsModalPrecios().hide();
    showAlert("success", "Actualización de precios aplicada.");
    await aplicarFiltros();
  } catch (err) {
    logError("Aplicar precios", "(varios)", err);
    showAlert("danger", err?.message || "Error al actualizar precios");
  }
});

/* =========================
   Boot
   ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await cargarCategorias();
  try {
    const resp = assertOk(await gsaAPI.logsGetAll());
    initOrUpdateLogs(mapLogs(resp));
    logPaso("(auto) cargar logs", "/logs/all", resp);
  } catch (err) {
    initOrUpdateLogs([]);
    logError("(auto) cargar logs", "/logs/all", err);
  }
});
