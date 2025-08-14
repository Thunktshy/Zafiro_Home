// /admin-resources/scripts/forms/crear-promociones.js
// Crear promociones (solo creación por CATEGORÍA en backend actual)
// Previsualización: por producto o por categoría
// Logs: "se preciono el boton ..." + api llamada + "respuesta :"

import { categoriasAPI } from "/admin-resources/scripts/apis/categoriasManager.js";
import { productosAPI } from "/admin-resources/scripts/apis/productosManager.js";
import { promocionesAPI } from "/admin-resources/scripts/apis/promocionesManager.js";

/* =============== Helpers =============== */
function logPaso(boton, api, respuesta) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  if (respuesta !== undefined) console.log("respuesta :", respuesta);
}
function logError(boton, api, error) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  console.error("respuesta :", error?.message || error);
}
const money = (n) => (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const dateISO = (d) => {
  if (!d) return "";
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return "";
  const mm = `${x.getMonth() + 1}`.padStart(2, "0");
  const dd = `${x.getDate()}`.padStart(2, "0");
  return `${x.getFullYear()}-${mm}-${dd}`;
};
function precioPromo(precioOriginal, tipo, valor) {
  const p = Number(precioOriginal) || 0;
  const v = Number(valor) || 0;
  if (String(tipo).includes("porc")) return Math.max(0, p * (1 - v / 100));
  return Math.max(0, p - v);
}
function showAlert(kind, msg) {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.className = `alert alert-${kind}`;
  box.textContent = msg;
  box.classList.remove("d-none");
  setTimeout(() => box.classList.add("d-none"), 2500);
}

/* =============== DOM refs =============== */
const alertBox         = document.getElementById("alertBox");
const alcanceProducto  = document.getElementById("alcanceProducto");
const alcanceCategoria = document.getElementById("alcanceCategoria");
const grupoProducto    = document.getElementById("grupoProducto");
const grupoCategoria   = document.getElementById("grupoCategoria");

const selProducto      = document.getElementById("producto");
const selCategoria     = document.getElementById("categoria");

const promoNombre      = document.getElementById("promoNombre");
const tipo             = document.getElementById("tipo");
const valor            = document.getElementById("valor");
const fechaInicio      = document.getElementById("fechaInicio");
const fechaFin         = document.getElementById("fechaFin");
const descripcion      = document.getElementById("descripcion");

const btnPrevisualizar = document.getElementById("btnPrevisualizar");
const btnLimpiar       = document.getElementById("btnLimpiar");

/* =============== Alcance UI =============== */
function toggleAlcance() {
  const prod = alcanceProducto.checked;
  grupoProducto.classList.toggle("d-none", !prod);
  grupoCategoria.classList.toggle("d-none", prod);
  selProducto.required = prod;
  // Nota: crear en backend solo con categoría; aquí solo controlamos visibilidad/validación del form.
}
[alcanceProducto, alcanceCategoria].forEach((el) => el?.addEventListener("change", toggleAlcance));

/* =============== DataTable Preview =============== */
let dtPreview = null;
function initOrUpdatePreview(rows) {
  const data = Array.isArray(rows) ? rows : [];
  if (dtPreview) {
    dtPreview.clear().rows.add(data).draw();
    return dtPreview;
  }
  dtPreview = $("#tablaPreview").DataTable({
    data,
    columns: [
      { data: "producto_id", title: "Producto" },
      { data: "nombre", title: "Nombre" },
      { data: "precio_original", title: "Precio original", render: (v) => money(v) },
      { data: "tipo", title: "Tipo", render: (v) => (String(v).includes("porc") ? "Porcentaje" : "Monto") },
      { data: "valor", title: "Valor", render: (v, _t, row) => String(row.tipo).includes("porc") ? `${Number(v)}%` : money(v) },
      { data: "precio_promo", title: "Precio promo", render: (v) => money(v) },
      { data: "fecha_inicio", title: "Inicio" },
      { data: "fecha_fin", title: "Fin" }
    ],
    pageLength: 10,
    order: [[0, "asc"]],
    responsive: true
  });
  return dtPreview;
}

/* =============== Cargar selects =============== */
async function cargarProductos() {
  try {
    const resp = await productosAPI.getList();
    const list = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
    selProducto.innerHTML = `<option value="">Selecciona…</option>` + list.map(p =>
      `<option value="${p.producto_id}">${p.producto_id} — ${p.nombre_producto}</option>`
    ).join("");
    logPaso("(auto) cargar productos", "/productos/get_list", resp);
  } catch (err) {
    logError("(auto) cargar productos", "/productos/get_list", err);
  }
}
async function cargarCategorias() {
  try {
    const resp = await categoriasAPI.getList();
    const list = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
    selCategoria.innerHTML = `<option value="">Selecciona…</option>` + list.map(c =>
      `<option value="${c.categoria_id}">${c.categoria_id} — ${c.nombre_categoria}</option>`
    ).join("");
    logPaso("(auto) cargar categorías", "/categorias/get_list", resp);
  } catch (err) {
    logError("(auto) cargar categorías", "/categorias/get_list", err);
  }
}

/* =============== Previsualización =============== */
async function previsualizar() {
  const esProducto = alcanceProducto.checked;
  const vNombre = promoNombre.value.trim();
  const vTipo   = tipo.value;
  const vValor  = Number(valor.value);
  const vIni    = fechaInicio.value;
  const vFin    = fechaFin.value || "";

  if (!vNombre || !vIni || !(vValor > 0)) {
    showAlert("warning", "Completa nombre, tipo/valor (>0) y fecha inicio.");
    return;
  }
  if (vTipo === "porcentaje" && !(vValor > 0 && vValor < 100)) {
    showAlert("warning", "Porcentaje inválido (0 < % < 100).");
    return;
  }

  try {
    let rows = [];
    if (esProducto) {
      const pid = selProducto.value;
      if (!pid) return showAlert("warning", "Selecciona un producto.");
      const r1 = await productosAPI.getOne(pid);
      const p  = (r1?.data && (Array.isArray(r1.data) ? r1.data[0] : r1.data)) || r1 || null;
      if (!p) throw new Error("Producto no encontrado");
      rows.push({
        producto_id: p.producto_id ?? pid,
        nombre: p.nombre_producto ?? "",
        precio_original: Number(p.precio_unitario ?? 0),
        tipo: vTipo,
        valor: vValor,
        precio_promo: precioPromo(p.precio_unitario, vTipo, vValor),
        fecha_inicio: vIni,
        fecha_fin: vFin
      });
      logPaso("Previsualizar", `/productos/by_id/${pid}`, r1);
    } else {
      const cid = selCategoria.value;
      if (!cid) return showAlert("warning", "Selecciona una categoría.");
      const r2 = await productosAPI.getByCategoria(cid);
      const list = Array.isArray(r2?.data) ? r2.data : Array.isArray(r2) ? r2 : [];
      rows = list.map(p => ({
        producto_id: p.producto_id,
        nombre: p.nombre_producto,
        precio_original: Number(p.precio_unitario ?? 0),
        tipo: vTipo,
        valor: vValor,
        precio_promo: precioPromo(p.precio_unitario, vTipo, vValor),
        fecha_inicio: vIni,
        fecha_fin: vFin
      }));
      logPaso("Previsualizar", `/productos/by_categoria/${cid}`, r2);
    }
    initOrUpdatePreview(rows);
    showAlert("info", `Previsualización generada (${rows.length} producto(s)).`);
  } catch (err) {
    logError("Previsualizar", "(productos)", err);
    initOrUpdatePreview([]);
    showAlert("danger", err?.message || "No se pudo previsualizar");
  }
}

/* =============== Crear promoción (solo categoría) =============== */
async function crearPromocion(e) {
  e.preventDefault();
  const form = document.getElementById("formPromo");
  form.classList.add("was-validated");
  if (!form.checkValidity()) return;

  // El backend actual SOLO soporta crear/aplicar por CATEGORÍA
  if (!alcanceCategoria.checked || !selCategoria.value) {
    showAlert("warning", "Por ahora el backend solo aplica promociones por categoría. Selecciona una categoría.");
    return;
  }

  const vTipo  = tipo.value;
  const vValor = Number(valor.value);
  if (!(vValor > 0)) {
    showAlert("warning", "El valor del descuento debe ser mayor a 0.");
    return;
  }
  if (vTipo === "porcentaje" && !(vValor > 0 && vValor < 100)) {
    showAlert("warning", "Porcentaje inválido (0 < % < 100).");
    return;
  }

  const payload = {
    promo_nombre: promoNombre.value.trim(), // se guarda en logs/tabla audit si el backend lo maneja
    descripcion: (descripcion.value || "").trim() || null,
    tipo_descuento: vTipo, // 'porcentaje' | 'monto'
    valor_descuento: vValor,
    fecha_inicio: fechaInicio.value,
    fecha_fin: fechaFin.value || null,
    categoria_id: Number(selCategoria.value),
    // Nota: producto_id no se envía porque el backend aplica por categoría
    solo_activos: 1
  };

  try {
    const resp = await promocionesAPI.insert(payload);
    logPaso("Crear promoción", "/promociones/insert", resp);
    showAlert("success", resp?.message || "Promoción aplicada.");
  } catch (err) {
    logError("Crear promoción", "/promociones/insert", err);
    showAlert("danger", err?.message || "No se pudo crear la promoción");
  }
}

/* =============== Limpieza =============== */
function limpiar() {
  document.getElementById("formPromo").reset();
  alcanceProducto.checked = true;
  toggleAlcance();
  initOrUpdatePreview([]);
  showAlert("info", "Formulario limpio.");
  logPaso("Limpiar", "(UI)", { ok: true });
}

/* =============== Boot =============== */
document.addEventListener("DOMContentLoaded", async () => {
  toggleAlcance();
  // Fecha inicio por defecto: hoy
  fechaInicio.value = dateISO(new Date());

  await Promise.all([cargarProductos(), cargarCategorias()]);

  // Eventos
  btnPrevisualizar?.addEventListener("click", previsualizar);
  btnLimpiar?.addEventListener("click", limpiar);
  document.getElementById("formPromo")?.addEventListener("submit", crearPromocion);

  // Inicializa tabla vacía
  initOrUpdatePreview([]);
});
