// /admin-resources/scripts/forms/imagenes.js
import { categoriasAPI } from "/admin-resources/scripts/apis/categoriasManager.js"; // :contentReference[oaicite:2]{index=2}
import { productosAPI } from "/admin-resources/scripts/apis/productosManager.js";   // :contentReference[oaicite:3]{index=3}
import { imagenesAPI } from "/admin-resources/scripts/apis/imagenesManager.js";

/* ========== Helpers ========== */
function logPaso(boton, api, respuesta) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  if (respuesta !== undefined) console.log("respuesta :", respuesta);
}
function logError(boton, api, error) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  console.error("respuesta :", error?.message || error);
}
function showAlert(kind, msg) {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.className = `alert alert-${kind}`;
  box.textContent = msg;
  box.classList.remove("d-none");
  setTimeout(() => box.classList.add("d-none"), 2500);
}
const MAX_BYTES = 10 * 1024 * 1024;
const validExt = /\.(jpe?g|png|gif)$/i;

/* ========== DOM refs ========== */
const selProducto   = document.getElementById("selProducto");
const selCategoria  = document.getElementById("selCategoria");

const btnAbrirProd  = document.getElementById("btnAbrirModalProd");
const btnAbrirCat   = document.getElementById("btnAbrirModalCat");
const btnCargarProd = document.getElementById("btnCargarProd");
const btnCargarCat  = document.getElementById("btnCargarCat");

const modalProdEl   = document.getElementById("modalProd");
const modalCatEl    = document.getElementById("modalCat");
const bsModalProd   = () => bootstrap.Modal.getOrCreateInstance(modalProdEl);
const bsModalCat    = () => bootstrap.Modal.getOrCreateInstance(modalCatEl);

const formProd      = document.getElementById("formProd");
const formCat       = document.getElementById("formCat");
const prodId        = document.getElementById("prodId");
const catId         = document.getElementById("catId");
const prodFile      = document.getElementById("prodFile");
const catFile       = document.getElementById("catFile");
const prodPreview   = document.getElementById("prodPreview");
const prodPreviewWrap = document.getElementById("prodPreviewWrap");
const catPreview    = document.getElementById("catPreview");
const catPreviewWrap  = document.getElementById("catPreviewWrap");

/* ========== DataTables ========== */
let dtProd = null, dtCat = null;
function renderTablaProd(rows) {
  const data = Array.isArray(rows) ? rows : [];
  if (dtProd) { dtProd.clear().rows.add(data).draw(); return; }
  dtProd = $("#tablaProd").DataTable({
    data,
    columns: [
      { data: "image_path", title: "Vista previa", render: (p) => p ? `<img src="${p}" class="thumb" alt="">` : "" },
      { data: "image_path", title: "Ruta" },
      {
        data: null, title: "Acciones", orderable: false, className: "text-end",
        render: (r) => `<button class="btn btn-sm btn-outline-danger btn-del-prod" data-id="${r.id || r.imagen_id || r.image_id}"><i class="fa-solid fa-trash"></i></button>`
      }
    ],
    pageLength: 10,
    order: [[1, "asc"]],
    responsive: true
  });
}
function renderTablaCat(rows) {
  const data = Array.isArray(rows) ? rows : [];
  if (dtCat) { dtCat.clear().rows.add(data).draw(); return; }
  dtCat = $("#tablaCat").DataTable({
    data,
    columns: [
      { data: "image_path", title: "Vista previa", render: (p) => p ? `<img src="${p}" class="thumb" alt="">` : "" },
      { data: "image_path", title: "Ruta" },
      {
        data: null, title: "Acciones", orderable: false, className: "text-end",
        render: (r) => `<button class="btn btn-sm btn-outline-danger btn-del-cat" data-id="${r.id || r.imagen_id || r.image_id}"><i class="fa-solid fa-trash"></i></button>`
      }
    ],
    pageLength: 10,
    order: [[1, "asc"]],
    responsive: true
  });
}

/* ========== Cargar selects IDs (get_list) ========== */
async function cargarSelectProductos() {
  try {
    const resp = await productosAPI.getList(); // usa /productos/get_list
    const list = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
    selProducto.innerHTML = `<option value="">Selecciona…</option>` + list.map(p =>
      `<option value="${p.producto_id}">${p.producto_id} — ${p.nombre_producto}</option>`
    ).join("");
    logPaso("(auto) cargar productos", "/productos/get_list", resp);
  } catch (err) {
    logError("(auto) cargar productos", "/productos/get_list", err);
    showAlert("danger", err.message);
  }
}
async function cargarSelectCategorias() {
  try {
    const resp = await categoriasAPI.getList(); // usa /categorias/get_list
    const list = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
    selCategoria.innerHTML = `<option value="">Selecciona…</option>` + list.map(c =>
      `<option value="${c.categoria_id}">${c.categoria_id} — ${c.nombre_categoria}</option>`
    ).join("");
    logPaso("(auto) cargar categorías", "/categorias/get_list", resp);
  } catch (err) {
    logError("(auto) cargar categorías", "/categorias/get_list", err);
    showAlert("danger", err.message);
  }
}

/* ========== Listar imágenes (server) ========== */
async function listarProd() {
  const pid = selProducto.value;
  if (!pid) return showAlert("warning", "Selecciona un producto.");
  try {
    const resp = await imagenesAPI.getByProducto(pid);
    const rows = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
    renderTablaProd(rows);
    logPaso("Cargar imágenes producto", `/imagenes/productos/${pid}`, resp);
  } catch (err) {
    renderTablaProd([]);
    logError("Cargar imágenes producto", `/imagenes/productos/${pid}`, err);
    showAlert("danger", err.message);
  }
}
async function listarCat() {
  const cid = selCategoria.value;
  if (!cid) return showAlert("warning", "Selecciona una categoría.");
  try {
    const resp = await imagenesAPI.getByCategoria(cid);
    const rows = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
    renderTablaCat(rows);
    logPaso("Cargar imágenes categoría", `/imagenes/categorias/${cid}`, resp);
  } catch (err) {
    renderTablaCat([]);
    logError("Cargar imágenes categoría", `/imagenes/categorias/${cid}`, err);
    showAlert("danger", err.message);
  }
}

/* ========== Abrir modales ========== */
btnAbrirProd?.addEventListener("click", () => {
  const pid = selProducto.value;
  if (!pid) return showAlert("warning", "Selecciona un producto primero.");
  prodId.value = pid;
  prodFile.value = "";
  prodPreviewWrap.classList.add("d-none");
  prodPreview.src = "";
  bsModalProd().show();
  logPaso("Abrir modal producto", "(UI)", { producto_id: pid });
});
btnAbrirCat?.addEventListener("click", () => {
  const cid = selCategoria.value;
  if (!cid) return showAlert("warning", "Selecciona una categoría primero.");
  catId.value = cid;
  catFile.value = "";
  catPreviewWrap.classList.add("d-none");
  catPreview.src = "";
  bsModalCat().show();
  logPaso("Abrir modal categoría", "(UI)", { categoria_id: cid });
});

/* ========== Previews locales ========== */
function previewFile(input, imgEl, wrapEl) {
  const f = input.files?.[0];
  if (!f) { wrapEl.classList.add("d-none"); return; }
  if (!validExt.test(f.name) || f.size > MAX_BYTES) {
    input.value = ""; wrapEl.classList.add("d-none");
    return showAlert("warning", "Archivo inválido (jpg/png/gif ≤ 10MB).");
  }
  const url = URL.createObjectURL(f);
  imgEl.src = url;
  wrapEl.classList.remove("d-none");
}
prodFile?.addEventListener("change", () => previewFile(prodFile, prodPreview, prodPreviewWrap));
catFile?.addEventListener("change",  () => previewFile(catFile,  catPreview,  catPreviewWrap));

/* ========== Subir (sender de cliente) ========== */
formProd?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!prodFile.files?.[0]) return showAlert("warning", "Selecciona una imagen.");
  const f = prodFile.files[0];
  if (!validExt.test(f.name) || f.size > MAX_BYTES) return showAlert("warning", "Archivo inválido (jpg/png/gif ≤ 10MB).");

  try {
    const resp = await imagenesAPI.uploadProducto(prodId.value, f);
    logPaso("Subir imagen producto", "/imagenes/productos/upload", resp);
    showAlert("success", resp?.message || "Imagen subida.");
    bsModalProd().hide();
    await listarProd();
  } catch (err) {
    logError("Subir imagen producto", "/imagenes/productos/upload", err);
    showAlert("danger", err.message);
  }
});

formCat?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!catFile.files?.[0]) return showAlert("warning", "Selecciona una imagen.");
  const f = catFile.files[0];
  if (!validExt.test(f.name) || f.size > MAX_BYTES) return showAlert("warning", "Archivo inválido (jpg/png/gif ≤ 10MB).");

  try {
    const resp = await imagenesAPI.uploadCategoria(catId.value, f);
    logPaso("Subir imagen categoría", "/imagenes/categorias/upload", resp);
    showAlert("success", resp?.message || "Imagen subida.");
    bsModalCat().hide();
    await listarCat();
  } catch (err) {
    logError("Subir imagen categoría", "/imagenes/categorias/upload", err);
    showAlert("danger", err.message);
  }
});

/* ========== Eliminar filas ========== */
$("#tablaProd tbody").on("click", "button.btn-del-prod", async function () {
  const id = this.dataset.id;
  if (!id) return;
  if (!confirm(`¿Eliminar imagen #${id}?`)) return;
  try {
    const resp = await imagenesAPI.deleteProducto(id);
    logPaso("Eliminar imagen producto", `/imagenes/productos/${id}`, resp);
    await listarProd();
  } catch (err) {
    logError("Eliminar imagen producto", `/imagenes/productos/${id}`, err);
    showAlert("danger", err.message);
  }
});
$("#tablaCat tbody").on("click", "button.btn-del-cat", async function () {
  const id = this.dataset.id;
  if (!id) return;
  if (!confirm(`¿Eliminar imagen #${id}?`)) return;
  try {
    const resp = await imagenesAPI.deleteCategoria(id);
    logPaso("Eliminar imagen categoría", `/imagenes/categorias/${id}`, resp);
    await listarCat();
  } catch (err) {
    logError("Eliminar imagen categoría", `/imagenes/categorias/${id}`, err);
    showAlert("danger", err.message);
  }
});

/* ========== Cargar listas por selección ========== */
btnCargarProd?.addEventListener("click", listarProd);
btnCargarCat?.addEventListener("click", listarCat);

/* ========== Boot ========== */
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([cargarSelectProductos(), cargarSelectCategorias()]);
  // Arranca tablas vacías
  renderTablaProd([]);
  renderTablaCat([]);
});
