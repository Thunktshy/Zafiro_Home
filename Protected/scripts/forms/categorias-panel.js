// Panel de administración: Categorías (layout 2025)
// Controla: dropdown, 3 tablas (simple, búsqueda, CRUD) y modal reutilizable (agregar/editar)
// Requiere: jQuery, DataTables base, FontAwesome, y categoriasAPI

import { categoriasAPI } from "/admin-resources/scripts/apis/categoriasManager.js";

/* =========================
   Utilidades de datos y logs
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

function mapCategorias(listish) {
  return toArrayData(listish).map(normalizeCategoria).filter(Boolean);
}

function logPaso(boton, api, respuesta) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  if (respuesta !== undefined) console.log("respuesta :", respuesta);
}
function logError(boton, api, error) {
  console.log(`se preciono el boton "${boton}" y se llamo a la api "${api}"`);
  console.error("respuesta :", error?.message || error);
}

/* =========================
   DataTables (crear o recrear)
   ========================= */
function renderDataTable(selector, data, columns) {
  if ($.fn.DataTable.isDataTable(selector)) {
    $(selector).DataTable().clear().destroy();
  }
  return $(selector).DataTable({
    data,
    columns,
    pageLength: 10,
    autoWidth: false
  });
}

/* =========================
   Referencias DOM (nuevo layout 2025)
   ========================= */
const btnCargarTodas    = document.getElementById("btnCargarTodas");
const btnProbarDropdown = document.getElementById("btnProbarDropdown");
const btnRefrescarCrud  = document.getElementById("btnRefrescarCrud");
const btnAbrirAgregar   = document.getElementById("btnAbrirAgregar");
const btnAbrirEditar    = document.getElementById("btnAbrirEditar");

const btnBuscar     = document.getElementById("btnBuscar");
const inputBuscarId = document.getElementById("buscarId");

const selectCategorias = document.getElementById("selectCategorias");

const mainEl = document.querySelector("main");

// Modal reutilizable
const modalEl   = document.getElementById("modalCategoria");
const modalTit  = document.getElementById("modalCategoriaTitle");
const formEl    = document.getElementById("categoriaForm");
const hidId     = document.getElementById("categoria_id");
const inpNombre = document.getElementById("nombre_categoria");
const txtDesc   = document.getElementById("descripcion");
const btnClose  = document.getElementById("closeModalBtn");
const btnCancel = document.getElementById("cancelModalBtn");
const btnSave   = document.getElementById("saveCategoriaBtn");

/* =========================
   Modal accesible (sin Bootstrap)
   ========================= */
let currentMode /** @type {"create"|"edit"} */ = "create";

function openModal(mode = "create", data = null) {
  currentMode = mode;
  modalTit.textContent = mode === "create" ? "Nueva Categoría" : "Editar Categoría";

  if (mode === "create") {
    hidId.value = "";
    formEl.reset();
  } else if (data) {
    hidId.value = data.categoria_id ?? "";
    inpNombre.value = data.nombre_categoria ?? "";
    txtDesc.value   = data.descripcion ?? "";
  }

  modalEl.classList.add("show");
  modalEl.setAttribute("aria-hidden", "false");
  mainEl?.setAttribute("inert", "");
  // Foco inicial
  setTimeout(() => inpNombre?.focus(), 0);
}

function closeModal() {
  modalEl.classList.remove("show");
  modalEl.setAttribute("aria-hidden", "true");
  mainEl?.removeAttribute("inert");
}

modalEl?.addEventListener("click", (e) => {
  if (e.target === modalEl) closeModal();
});
btnClose?.addEventListener("click", closeModal);
btnCancel?.addEventListener("click", closeModal);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalEl.classList.contains("show")) {
    closeModal();
  }
});

/* =========================
   Columnas para tablas
   ========================= */
const colsBase = [
  { data: "categoria_id", title: "ID" },
  { data: "nombre_categoria", title: "Nombre",
    render: (d, t, row) =>
      `<button class="btn btn-ghost js-edit" data-id="${row.categoria_id}">${d}</button>` },
  { data: "descripcion", title: "Descripción" }
];

/* =========================
   1) Listado simple (get_all)
   ========================= */
async function cargarListadoSimple() {
  try {
    const boton = "Cargar Todas", api = "/get_all";
    const resp = assertOk(await categoriasAPI.getAll());
    const data = mapCategorias(resp);
    renderDataTable("#tablaCategorias", data, colsBase);
    logPaso(boton, api, resp);
  } catch (err) {
    logError("Cargar Todas", "/get_all", err);
    renderDataTable("#tablaCategorias", [], colsBase);
  }
}
btnCargarTodas?.addEventListener("click", cargarListadoSimple);

/* =========================
   2) Dropdown (get_list)
   ========================= */
btnProbarDropdown?.addEventListener("click", async () => {
  try {
    const boton = "Probar Dropbox", api = "/get_list";
    const resp  = assertOk(await categoriasAPI.getList());
    const list  = mapCategorias(resp);

    // Limpia y arma opciones
    selectCategorias.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = list.length ? "— seleccionar —" : "— sin datos —";
    selectCategorias.appendChild(placeholder);

    for (const item of list) {
      const opt = document.createElement("option");
      opt.value = String(item.categoria_id);
      opt.textContent = `${item.categoria_id} — ${item.nombre_categoria}`;
      selectCategorias.appendChild(opt);
    }

    logPaso(boton, api, resp);
    console.log(`Dropbox: ${list.length} opciones cargadas`);
  } catch (err) {
    logError("Probar Dropbox", "/get_list", err);
  }
});

selectCategorias?.addEventListener("change", (e) => {
  const id = e.currentTarget.value;
  if (id) console.log(`se selecciono la categoria con id ${id}`);
});

/* =========================
   3) Búsqueda por ID (/by_id/:id)
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
   4) CRUD (tabla + eliminar)
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
          `<button class="btn btn-ghost btn-eliminar" data-id="${row.categoria_id}" data-nombre="${row.nombre_categoria}">
             <i class="fa-solid fa-trash"></i>
           </button>`
      }
    ]);

    logPaso(boton, api, resp);
  } catch (err) {
    logError("Refrescar CRUD", "/get_all", err);
    renderDataTable("#tablaCRUD", [], colsBase);
  }
}
btnRefrescarCrud?.addEventListener("click", cargarTablaCRUD);
document.addEventListener("DOMContentLoaded", cargarTablaCRUD);

// Delegación: eliminar
$(document).on("click", "#tablaCRUD tbody .btn-eliminar", async function() {
  const id = Number(this.dataset.id);
  const nombre = this.dataset.nombre || "";
  if (!id) return;
  const ok = window.confirm(`¿Eliminar categoría "${nombre}" (ID ${id})?`);
  if (!ok) return;
  try {
    const boton = "Confirmar eliminar", api = "/delete";
    const resp  = assertOk(await categoriasAPI.remove(id));
    logPaso(boton, api, resp);
    await cargarTablaCRUD();
  } catch (err) {
    logError("Confirmar eliminar", "/delete", err);
  }
});

// Delegación: click en nombre para editar (tabla simple y CRUD)
$(document).on("click", "#tablaCategorias tbody .js-edit, #tablaCRUD tbody .js-edit", async function() {
  const id = Number(this.dataset.id);
  if (!id) return;
  try {
    const resp = assertOk(await categoriasAPI.getOne(id));
    const item = mapCategorias(resp)[0] || null;
    openModal("edit", item);
  } catch (err) {
    logError("Editar (click nombre)", `/by_id/${id}` , err);
  }
});

/* =========================
   5) Botones de abrir modal (agregar/editar)
   ========================= */
btnAbrirAgregar?.addEventListener("click", () => openModal("create"));

btnAbrirEditar?.addEventListener("click", async () => {
  // Preferencia: usar selección del dropdown si existe; si no, pedir ID.
  const fromSelect = selectCategorias?.value?.trim();
  const id = fromSelect || window.prompt("Ingresa el ID de la categoría a editar:")?.trim();
  if (!id) return;
  try {
    const resp = assertOk(await categoriasAPI.getOne(id));
    const item = mapCategorias(resp)[0] || null;
    if (!item) return;
    openModal("edit", item);
  } catch (err) {
    logError("Abrir Editar", `/by_id/${id}`, err);
  }
});

/* =========================
   6) Envío del formulario (crear/editar)
   ========================= */
formEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    categoria_id: hidId.value ? Number(hidId.value) : undefined,
    nombre_categoria: inpNombre.value.trim(),
    descripcion: (txtDesc.value || "").trim() || null
  };

  try {
    if (currentMode === "edit" && payload.categoria_id) {
      const boton = "Modificar categoría", api = "/update";
      const resp  = assertOk(await categoriasAPI.update(payload));
      logPaso(boton, api, resp);
    } else {
      const boton = "Agregar categoría", api = "/insert";
      const { categoria_id, ...createData } = payload; // quita id para insert
      const resp  = assertOk(await categoriasAPI.insert(createData));
      logPaso(boton, api, resp);
    }
    closeModal();
    formEl.reset();
    await Promise.all([
      cargarTablaCRUD(),
      cargarListadoSimple()
    ]);
  } catch (err) {
    logError(currentMode === "edit" ? "Modificar categoría" : "Agregar categoría", currentMode === "edit" ? "/update" : "/insert", err);
  }
});

/* =========================
   7) Scroll reveal (coincide con admin.css)
   ========================= */
(function initScrollReveal(){
  const els = document.querySelectorAll('.scroll-reveal');
  if (!('IntersectionObserver' in window) || !els.length) {
    els.forEach(el => el.classList.add('active'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('active');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.15 });
  els.forEach(el => io.observe(el));
})();

/* =========================
   8) Inicialización ligera
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  // Crea tablas vacías con cabeceras para evitar warnings de DataTables
  renderDataTable("#tablaCategorias", [], colsBase);
  renderDataTable("#tablaBusqueda", [], colsBase);
});
