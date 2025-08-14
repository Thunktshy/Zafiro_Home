// /admin-resources/scripts/forms/promociones.js
// Panel: Promociones (Bootstrap + DataTables + logs estándar)
// Respuestas esperadas: { success, message, data }

import { categoriasAPI } from "/admin-resources/scripts/apis/categoriasManager.js";
import { productosAPI } from "/admin-resources/scripts/apis/productosManager.js";
import { promocionesAPI } from "/admin-resources/scripts/apis/promocionesManager.js";

/* =========================
   Logs en el formato solicitado
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
   Normalización y utilidades
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
const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const dateISO = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return "";
  const mm = `${x.getMonth() + 1}`.padStart(2, "0");
  const dd = `${x.getDate()}`.padStart(2, "0");
  return `${x.getFullYear()}-${mm}-${dd}`;
};

function normalizePromo(row) {
  if (!row || typeof row !== "object") return null;

  const producto_id = row.producto_id ?? row.producto ?? row.id_producto ?? row.ProductoID ?? "";
  const nombre_producto = row.nombre_producto ?? row.nombre ?? "";
  const categoria_id = row.categoria_id ?? row.categoria ?? null;
  const nombre_categoria = row.nombre_categoria ?? row.categoria_nombre ?? "";

  const promo_nombre = row.promo_nombre ?? row.promocion ?? row.nombre_promo ?? "";
  const tipo = (row.tipo_descuento ?? row.tipo ?? "").toString().toLowerCase(); // 'porcentaje' | 'monto' | ...
  const valor =
    row.valor_descuento ?? row.valor ?? row.porcentaje ?? row.monto ?? row.descuento ?? 0;

  const precio_original =
    Number(row.precio_original ?? row.precio_unitario ?? row.precio ?? 0) || 0;

  let precio_promo = Number(row.precio_promo ?? row.precio_promocion ?? 0);
  if (!Number.isFinite(precio_promo) || precio_promo <= 0) {
    if (tipo.includes("porc") || tipo === "percent" || tipo === "percentage") {
      precio_promo = Math.max(0, precio_original * (1 - Number(valor) / 100));
    } else {
      // monto
      precio_promo = Math.max(0, precio_original - Number(valor));
    }
  }

  const f1 =
    row.fecha_inicio ?? row.inicio ?? row.fecha_desde ?? row.valid_from ?? row.vigencia_inicio;
  const f2 = row.fecha_fin ?? row.fin ?? row.fecha_hasta ?? row.valid_to ?? row.vigencia_fin;

  return {
    producto_id: String(producto_id),
    nombre_producto: String(nombre_producto),
    categoria_id: categoria_id != null ? Number(categoria_id) : null,
    nombre_categoria: String(nombre_categoria || ""),
    promo_nombre: String(promo_nombre || ""),
    tipo: tipo || (Number(valor) <= 1 && valor > 0 ? "porcentaje" : "monto"),
    valor: Number(valor) || 0,
    precio_original,
    precio_promo,
    fecha_inicio: f1 ? dateISO(f1) : "",
    fecha_fin: f2 ? dateISO(f2) : "",
    _raw: row
  };
}

/* =========================
   DOM refs
========================= */
const filtroFecha = document.getElementById("filtroFecha");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroProducto = document.getElementById("filtroProducto");
const btnBuscar = document.getElementById("btnBuscar");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnRefrescar = document.getElementById("btnRefrescar");

const detalleJSON = document.getElementById("detalleJSON");
const modalDetalleEl = document.getElementById("modalDetalle");
const bsModalDetalle = () => bootstrap.Modal.getOrCreateInstance(modalDetalleEl);

/* =========================
   DataTable
========================= */
let dt = null;
function initOrUpdateTable(rows) {
  const data = (rows || []).map(normalizePromo).filter(Boolean);
  if (dt) {
    dt.clear().rows.add(data).draw();
    return dt;
  }
  dt = $("#tablaPromos").DataTable({
    data,
    columns: [
      { data: "producto_id", title: "Producto" },
      { data: "nombre_producto", title: "Nombre producto" },
      {
        data: null,
        title: "Categoría",
        render: (row) => row.nombre_categoria || row.categoria_id || ""
      },
      { data: "promo_nombre", title: "Promoción" },
      { data: "tipo", title: "Tipo", render: (v) => (String(v).includes("porc") ? "Porcentaje" : "Monto") },
      {
        data: "valor",
        title: "Valor",
        render: (v, _t, row) =>
          String(row.tipo).includes("porc") ? `${Number(v)}%` : money(v)
      },
      { data: "precio_original", title: "Precio original", render: (v) => money(v) },
      { data: "precio_promo", title: "Precio promo", render: (v) => money(v) },
      {
        data: null,
        title: "Vigencia",
        render: (row) =>
          row.fecha_inicio && row.fecha_fin ? `${row.fecha_inicio} — ${row.fecha_fin}` : ""
      },
      {
        data: null,
        title: "Acciones",
        className: "text-end",
        orderable: false,
        render: (row) => `
          <button class="btn btn-outline-secondary btn-sm btn-detalle" data-id="${row.producto_id}">
            <i class="fa-solid fa-eye"></i>
          </button>`
      }
    ],
    pageLength: 10,
    order: [[0, "asc"]],
    responsive: true
  });
  return dt;
}

/* =========================
   Cargas iniciales (categorías / productos)
========================= */
async function cargarCategorias() {
  try {
    const resp = assertOk(await categoriasAPI.getList());
    const list = toArrayData(resp)
      .map((c) => ({
        id: c.categoria_id ?? c.id,
        nombre: c.nombre_categoria ?? c.nombre
      }))
      .filter((x) => x.id != null && x.nombre != null);

    // limpiar y poblar
    while (filtroCategoria.firstChild) filtroCategoria.removeChild(filtroCategoria.firstChild);
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "(Todas)";
    filtroCategoria.appendChild(optAll);

    list.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = `${c.id} — ${c.nombre}`;
      filtroCategoria.appendChild(o);
    });

    logPaso("(auto) cargar categorías", "/categorias/get_list", resp);
  } catch (err) {
    logError("(auto) cargar categorías", "/categorias/get_list", err);
  }
}
async function cargarProductos() {
  try {
    const resp = assertOk(await productosAPI.getList());
    const list = toArrayData(resp)
      .map((p) => ({
        id: p.producto_id ?? p.id,
        nombre: p.nombre_producto ?? p.nombre
      }))
      .filter((x) => x.id != null && x.nombre != null);

    while (filtroProducto.firstChild) filtroProducto.removeChild(filtroProducto.firstChild);
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "(Todos)";
    filtroProducto.appendChild(optAll);

    list.forEach((p) => {
      const o = document.createElement("option");
      o.value = String(p.id);
      o.textContent = `${p.id} — ${p.nombre}`;
      filtroProducto.appendChild(o);
    });

    logPaso("(auto) cargar productos", "/productos/get_list", resp);
  } catch (err) {
    logError("(auto) cargar productos", "/productos/get_list", err);
  }
}

/* =========================
   Carga de promociones y filtrado
========================= */
let cachePromos = []; // promos normalizadas de la última consulta

async function cargarPromos(fechaISO) {
  try {
    const api = `/activas_por_producto${fechaISO ? `?fecha=${fechaISO}` : ""}`;
    const resp = assertOk(await promocionesAPI.activasPorProducto(fechaISO));
    const arr = toArrayData(resp).map(normalizePromo).filter(Boolean);
    cachePromos = arr;
    initOrUpdateTable(cachePromos);
    logPaso("Refrescar/Buscar", api, resp);
  } catch (err) {
    cachePromos = [];
    initOrUpdateTable([]);
    logError("Refrescar/Buscar", "/activas_por_producto", err);
  }
}

function aplicarFiltrosFrontend() {
  const cat = filtroCategoria.value.trim();
  const prod = filtroProducto.value.trim();
  let data = cachePromos.slice();

  if (cat) data = data.filter((r) => String(r.categoria_id) === cat);
  if (prod) data = data.filter((r) => String(r.producto_id) === prod);

  initOrUpdateTable(data);
}

/* =========================
   Eventos UI
========================= */
btnRefrescar?.addEventListener("click", async () => {
  const fecha = filtroFecha.value || dateISO(new Date());
  await cargarPromos(fecha);
  aplicarFiltrosFrontend();
});

btnBuscar?.addEventListener("click", async () => {
  const fecha = filtroFecha.value || dateISO(new Date());
  await cargarPromos(fecha);
  aplicarFiltrosFrontend();
});

btnLimpiar?.addEventListener("click", async () => {
  filtroFecha.value = "";
  filtroCategoria.value = "";
  filtroProducto.value = "";
  const hoy = dateISO(new Date());
  await cargarPromos(hoy);
  initOrUpdateTable(cachePromos);
  logPaso("Limpiar", "(UI)", { ok: true });
});

/* =========================
   Acciones en tabla
========================= */
$("#tablaPromos tbody").on("click", "button.btn-detalle", function () {
  const row = dt?.row($(this).closest("tr")).data();
  if (!row) return;
  // Mostrar el objeto crudo de la promo (para inspección)
  const pretty = JSON.stringify(row?._raw ?? row, null, 2);
  detalleJSON.textContent = pretty;
  bsModalDetalle().show();
  logPaso("Ver detalle (abrir modal)", "(UI)", row);
});

/* =========================
   Boot
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  // selects
  await Promise.all([cargarCategorias(), cargarProductos()]);
  // por defecto: vigentes hoy
  const hoy = dateISO(new Date());
  filtroFecha.value = "";
  await cargarPromos(hoy);
  initOrUpdateTable(cachePromos);
});
