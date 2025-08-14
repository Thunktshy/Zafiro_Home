// Panel de pruebas de Categorías
// Requiere: /admin-resources/scripts/apis/categoriasManager.js (categoriasAPI)
import { categoriasAPI } from "/admin-resources/scripts/apis/categoriasManager.js";

/* ------------------------- Helpers de datos / logs ------------------------- */
const asArray = (resp) => {
  // Acepta: { data: [...] }  o  [...] (tolerancia)
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.data)) return resp.data;
  if (resp?.data == null) return [];
  return Array.isArray(resp.data) ? resp.data : [resp.data];
};

const firstOrNull = (resp) => {
  const arr = asArray(resp);
  return arr.length ? arr[0] : null;
};

// Consolas en el formato solicitado
function logAccion(boton, api, respuesta) {
  console.log(`se preciono el boton "${boton}"`);
  if (api) console.log(`se llamo a la api "${api}"`);
  if (respuesta !== undefined) console.log("respuesta :", respuesta);
}
function logError(boton, api, error) {
  console.log(`se preciono el boton "${boton}"`);
  if (api) console.log(`se llamo a la api "${api}"`);
  console.error("respuesta :", error?.message || error);
}

/* ------------------------------- DataTables ------------------------------- */
function renderDataTable(selector, data, columns) {
  if ($.fn.DataTable.isDataTable(selector)) {
    $(selector).DataTable().clear().destroy();
  }
  return $(selector).DataTable({
    data,
    columns,
    pageLength: 10,
    responsive: true,
    autoWidth: false
  });
}

/* --------------------------------- DOM ----------------------------------- */
const btnCargarTodas   = document.getElementById("btnCargarTodas");
const btnProbarDropdown= document.getElementById("btnProbarDropdown");
const btnRefrescarCrud = document.getElementById("btnRefrescarCrud");
const btnBuscar        = document.getElementById("btnBuscar");
const inputBuscarId    = document.getElementById("buscarId");
const selectCategorias = document.getElementById("selectCategorias");

// Modales y formularios
const formAgregar      = document.getElementById("formAgregar");
const formEditar       = document.getElementById("formEditar");
const btnCargarEditar  = document.getElementById("btnCargarEditar");
const modalEliminarEl  = document.getElementById("modalEliminar");
const delIdSpan        = document.getElementById("delId");
const delNombreStrong  = document.getElementById("delNombre");
const btnConfirmarEliminar = document.getElementById("btnConfirmarEliminar");

// Helpers Bootstrap Modals
const bsModalAgregar = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAgregar"));
const bsModalEditar  = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditar"));
const bsModalEliminar= () => bootstrap.Modal.getOrCreateInstance(modalEliminarEl);

/* ------------------------------ Columnas base ----------------------------- */
const colsBase = [
  { data: "categoria_id", title: "ID" },
  { data: "nombre_categoria", title: "Nombre" },
  { data: "descripcion", title: "Descripción" }
];

/* ------------------------ Botón: Cargar Todas (tabla) --------------------- */
btnCargarTodas?.addEventListener("click", async () => {
  try {
    logAccion("Cargar Todas", "/get_all");
    const resp = await categoriasAPI.getAll();
    const data = asArray(resp);
    renderDataTable("#tablaCategorias", data, colsBase);
    logAccion("Cargar Todas", "/get_all", resp);
  } catch (err) {
    logError("Cargar Todas", "/get_all", err);
  }
});

/* ------------------------- Botón: Probar Dropbox -------------------------- */
btnProbarDropdown?.addEventListener("click", async () => {
  try {
    logAccion("Probar Dropbox", "/get_list");
    const resp = await categoriasAPI.getList();
    const list = asArray(resp);
    // llenar select
    selectCategorias.innerHTML = `<option value="">— seleccionar —</option>`;
    list.forEach(({ categoria_id, nombre_categoria }) => {
      const opt = document.createElement("option");
      opt.value = String(categoria_id);
      opt.textContent = `${categoria_id} — ${nombre_categoria}`;
      selectCategorias.appendChild(opt);
    });
    logAccion("Probar Dropbox", "/get_list", resp);
  } catch (err) {
    logError("Probar Dropbox", "/get_list", err);
  }
});

// Log al seleccionar opción del dropdown
selectCategorias?.addEventListener("change", (e) => {
  const id = e.target.value;
  if (id) console.log(`se selecciono la categoria con id ${id}`);
});

/* ----------------------- Búsqueda por ID -> #tablaBusqueda ---------------- */
async function buscarPorId() {
  const id = inputBuscarId.value.trim();
  if (!id) return;
  try {
    logAccion("Buscar", `/by_id/${id}`);
    const resp = await categoriasAPI.getOne(id);
    const rows = asArray(resp); // debe ser un arreglo (0 o 1 elemento)
    renderDataTable("#tablaBusqueda", rows, colsBase);
    logAccion("Buscar", `/by_id/${id}`, resp);
  } catch (err) {
    renderDataTable("#tablaBusqueda", [], colsBase);
    logError("Buscar", `/by_id/${id}`, err);
  }
}
btnBuscar?.addEventListener("click", buscarPorId);
inputBuscarId?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    buscarPorId();
  }
});

/* -------------------- Tabla CRUD (get_all + columna Eliminar) ------------- */
async function cargarTablaCRUD() {
  try {
    logAccion("Refrescar CRUD", "/get_all");
    const resp = await categoriasAPI.getAll();
    const data = asArray(resp);
    renderDataTable("#tablaCRUD", data, [
      ...colsBase,
      {
        data: null,
        title: "Eliminar",
        orderable: false,
        render: (row) =>
          `<button class="btn btn-sm btn-danger btn-eliminar" 
                   data-id="${row.categoria_id}" 
                   data-nombre="${row.nombre_categoria}">
              <i class="fa-solid fa-trash"></i>
           </button>`
      }
    ]);
    logAccion("Refrescar CRUD", "/get_all", resp);
  } catch (err) {
    logError("Refrescar CRUD", "/get_all", err);
  }
}
btnRefrescarCrud?.addEventListener("click", cargarTablaCRUD);
document.addEventListener("DOMContentLoaded", cargarTablaCRUD);

// Delegación: click en botones Eliminar dentro de la tabla CRUD
$("#tablaCRUD tbody").on("click", "button.btn-eliminar", function () {
  const id = this.dataset.id;
  const nombre = this.dataset.nombre || "";
  delIdSpan.textContent = id;
  delNombreStrong.textContent = nombre;
  bsModalEliminar().show();
});

// Confirmar eliminación
btnConfirmarEliminar?.addEventListener("click", async () => {
  const id = Number(delIdSpan.textContent);
  try {
    logAccion("Confirmar eliminar", "/delete");
    const resp = await categoriasAPI.remove(id);
    logAccion("Confirmar eliminar", "/delete", resp);
    bsModalEliminar().hide();
    await cargarTablaCRUD();
  } catch (err) {
    logError("Confirmar eliminar", "/delete", err);
  }
});

/* ------------------------- Formulario: Agregar ---------------------------- */
formAgregar?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(formAgregar);
  const payload = {
    nombre_categoria: fd.get("nombre_categoria")?.toString().trim(),
    descripcion: fd.get("descripcion")?.toString().trim() || null
  };
  try {
    logAccion("Agregar categoría", "/insert", payload);
    const resp = await categoriasAPI.insert(payload);
    logAccion("Agregar categoría", "/insert", resp);
    formAgregar.reset();
    bsModalAgregar().hide();
    await cargarTablaCRUD();
  } catch (err) {
    logError("Agregar categoría", "/insert", err);
  }
});

/* -------------------------- Modal Editar: Cargar -------------------------- */
btnCargarEditar?.addEventListener("click", async () => {
  const fd = new FormData(formEditar);
  const id = fd.get("categoria_id");
  if (!id) return;
  try {
    logAccion("Cargar datos (editar)", `/by_id/${id}`);
    const resp = await categoriasAPI.getOne(id);
    const item = firstOrNull(resp);
    formEditar.elements["nombre_categoria"].value = item?.nombre_categoria || "";
    formEditar.elements["descripcion"].value = item?.descripcion || "";
    logAccion("Cargar datos (editar)", `/by_id/${id}`, resp);
  } catch (err) {
    logError("Cargar datos (editar)", `/by_id/${id}`, err);
  }
});

/* ----------------------------- Form: Editar ------------------------------- */
formEditar?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(formEditar);
  const payload = {
    categoria_id: Number(fd.get("categoria_id")),
    nombre_categoria: fd.get("nombre_categoria")?.toString().trim(),
    descripcion: fd.get("descripcion")?.toString().trim() || null
  };
  try {
    logAccion("Modificar categoría", "/update", payload);
    const resp = await categoriasAPI.update(payload);
    logAccion("Modificar categoría", "/update", resp);
    bsModalEditar().hide();
    await cargarTablaCRUD();
  } catch (err) {
    logError("Modificar categoría", "/update", err);
  }
});
