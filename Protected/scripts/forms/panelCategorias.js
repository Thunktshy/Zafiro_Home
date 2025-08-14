// Panel de pruebas de Categorías
// Requiere: /admin-resources/scripts/apis/categoriasManager.js (categoriasAPI)
import { categoriasAPI } from "/admin-resources/scripts/apis/categoriasManager.js";

/* =========================
   Normalización de respuestas y filas
   ========================= */
// Valida success y retorna el cuerpo completo (para log)
function assertOk(resp) {
  if (resp && typeof resp === "object" && "success" in resp) {
    if (!resp.success) throw new Error(resp.message || "Operación no exitosa");
  }
  return resp;
}

// Devuelve array siempre (acepta {data:[...]}, {data:{…}}, [...], {…} o null)
function toArrayData(resp) {
  const r = resp && typeof resp === "object" && "data" in resp ? resp.data : resp;
  if (Array.isArray(r)) return r;
  if (!r) return [];
  return [r];
}

// Asegura el shape {categoria_id, nombre_categoria, descripcion}
function normalizeCategoria(row) {
  if (!row || typeof row !== "object") return null;
  const id  = row.categoria_id ?? row.id ?? row.categoriaId ?? row.CategoriaID;
  const nom = row.nombre_categoria ?? row.nombre ?? row.name ?? row.Nombre;
  const des = row.descripcion ?? row.desc ?? row.Descripcion ?? "";
  if (id == null || nom == null) return null;
  return {
    categoria_id: Number(id),
    nombre_categoria: String(nom),
    descripcion: String(des || "")
  };
}

// Mapea y filtra nulos
function mapCategorias(listish) {
  return toArrayData(listish).map(normalizeCategoria).filter(Boolean);
}

/* =========================
   Utilidad: (re)inicializar DataTable
   ========================= */
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

/* =========================
   Consola formateada (estilo solicitado)
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
   Referencias DOM
   ========================= */
const btnCargarTodas    = document.getElementById("btnCargarTodas");
const btnProbarDropdown = document.getElementById("btnProbarDropdown");
const btnRefrescarCrud  = document.getElementById("btnRefrescarCrud");
const btnBuscar         = document.getElementById("btnBuscar");
const inputBuscarId     = document.getElementById("buscarId");
const selectCategorias  = document.getElementById("selectCategorias");

// Modales y formularios
const formAgregar           = document.getElementById("formAgregar");
const formEditar            = document.getElementById("formEditar");
const btnCargarEditar       = document.getElementById("btnCargarEditar");
const modalEliminarEl       = document.getElementById("modalEliminar");
const delIdSpan             = document.getElementById("delId");
const delNombreStrong       = document.getElementById("delNombre");
const btnConfirmarEliminar  = document.getElementById("btnConfirmarEliminar");

// Helpers Bootstrap Modals
const bsModalAgregar  = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("modalAgregar"));
const bsModalEditar   = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("modalEditar"));
const bsModalEliminar = () => bootstrap.Modal.getOrCreateInstance(modalEliminarEl);

// Columnas base DataTables
const colsBase = [
  { data: "categoria_id", title: "ID" },
  { data: "nombre_categoria", title: "Nombre" },
  { data: "descripcion", title: "Descripción" }
];

/* =========================
   1) Cargar Todas -> #tablaCategorias
   ========================= */
btnCargarTodas?.addEventListener("click", async () => {
  try {
    const boton = "Cargar Todas", api = "/get_all";
    const resp = assertOk(await categoriasAPI.getAll());
    const data = mapCategorias(resp);
    renderDataTable("#tablaCategorias", data, colsBase);
    logPaso(boton, api, resp);
  } catch (err) {
    logError("Cargar Todas", "/get_all", err);
  }
});

/* =========================
   2) Probar Dropbox -> selectCategorias (usa /get_list)
   ========================= */
btnProbarDropdown?.addEventListener("click", async () => {
  try {
    const boton = "Probar Dropbox", api = "/get_list";
    const resp  = assertOk(await categoriasAPI.getList());
    const list  = mapCategorias(resp);

    // Rellena select con fragment para rendimiento
    while (selectCategorias.firstChild) selectCategorias.removeChild(selectCategorias.firstChild);
    const frag = document.createDocumentFragment();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = list.length ? "— seleccionar —" : "— sin datos —";
    frag.appendChild(placeholder);

    list.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = String(item.categoria_id);
      opt.textContent = `${item.categoria_id} — ${item.nombre_categoria}`;
      frag.appendChild(opt);
    });

    selectCategorias.appendChild(frag);

    logPaso(boton, api, resp);
    console.log(`Dropbox: ${list.length} opciones cargadas`);
  } catch (err) {
    logError("Probar Dropbox", "/get_list", err);
  }
});

// Log al seleccionar opción del dropdown
selectCategorias?.addEventListener("change", (e) => {
  const id = e.target.value;
  if (id) console.log(`se selecciono la categoria con id ${id}`);
});

/* =========================
   3) Buscar por ID -> #tablaBusqueda (usa /by_id/:id)
   ========================= */
async function buscarPorId() {
  const id = inputBuscarId.value.trim();
  if (!id) return;
  try {
    const boton = "Buscar", api = `/by_id/${id}`;
    const resp  = assertOk(await categoriasAPI.getOne(id));
    const item  = mapCategorias(resp)[0] || null;
    renderDataTable("#tablaBusqueda", item ? [item] : [], colsBase);
    logPaso(boton, api, resp);
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

/* =========================
   4) CRUD -> #tablaCRUD (get_all + columna Eliminar)
   ========================= */
async function cargarTablaCRUD() {
  try {
    const boton = "Refrescar CRUD", api = "/get_all";
    const resp = assertOk(await categoriasAPI.getAll());
    const data = mapCategorias(resp);

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

    logPaso(boton, api, resp);
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
    const boton = "Confirmar eliminar", api = "/delete";
    const resp  = assertOk(await categoriasAPI.remove(id));
    logPaso(boton, api, resp);
    bsModalEliminar().hide();
    await cargarTablaCRUD();
  } catch (err) {
    logError("Confirmar eliminar", "/delete", err);
  }
});

/* =========================
   5) Formularios Agregar / Editar (insert / update)
   ========================= */
formAgregar?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(formAgregar);
  const payload = {
    nombre_categoria: fd.get("nombre_categoria")?.toString().trim(),
    descripcion: fd.get("descripcion")?.toString().trim() || null
  };
  try {
    const boton = "Agregar categoría", api = "/insert";
    const resp  = assertOk(await categoriasAPI.insert(payload));
    logPaso(boton, api, resp);
    formAgregar.reset();
    bsModalAgregar().hide();
    await cargarTablaCRUD();
  } catch (err) {
    logError("Agregar categoría", "/insert", err);
  }
});

// Cargar datos en modal Editar
btnCargarEditar?.addEventListener("click", async () => {
  const fd = new FormData(formEditar);
  const id = fd.get("categoria_id");
  if (!id) return;
  try {
    const boton = "Cargar datos (editar)", api = `/by_id/${id}`;
    const resp  = assertOk(await categoriasAPI.getOne(id));
    const item  = mapCategorias(resp)[0] || null;
    formEditar.elements["nombre_categoria"].value = item?.nombre_categoria || "";
    formEditar.elements["descripcion"].value      = item?.descripcion || "";
    logPaso(boton, api, resp);
  } catch (err) {
    logError("Cargar datos (editar)", `/by_id/${id}`, err);
  }
});

// Enviar actualización
formEditar?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(formEditar);
  const payload = {
    categoria_id: Number(fd.get("categoria_id")),
    nombre_categoria: fd.get("nombre_categoria")?.toString().trim(),
    descripcion: fd.get("descripcion")?.toString().trim() || null
  };
  try {
    const boton = "Modificar categoría", api = "/update";
    const resp  = assertOk(await categoriasAPI.update(payload));
    logPaso(boton, api, resp);
    bsModalEditar().hide();
    await cargarTablaCRUD();
  } catch (err) {
    logError("Modificar categoría", "/update", err);
  }
});
