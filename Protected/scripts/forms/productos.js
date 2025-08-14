// /admin-resources/scripts/forms/productos.js
// Panel de administración de Productos
// Usa: productosAPI y categoriasAPI
import { productosAPI } from "/admin-resources/scripts/apis/productosManager.js";
import { categoriasAPI } from "/admin-resources/scripts/apis/categoriasManager.js";

/* ------------------------------
   Normalización y utilidades
--------------------------------*/
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
function normalizeProducto(row) {
  if (!row || typeof row !== "object") return null;
  const p = {
    producto_id: row.producto_id ?? row.id ?? row.productoId ?? row.ProductoID,
    nombre_producto: row.nombre_producto ?? row.nombre ?? row.name ?? row.Nombre,
    descripcion: row.descripcion ?? row.desc ?? row.Descripcion ?? "",
    precio_unitario: row.precio_unitario ?? row.precio ?? row.Precio ?? 0,
    stock: row.stock ?? row.Stock ?? 0,
    categoria_id: row.categoria_id ?? row.categoria ?? row.CategoriaID ?? null,
    estado_producto: row.estado_producto ?? row.estado ?? "activo",
    fecha_creacion: row.fecha_creacion ?? row.created_at ?? row.fecha ?? null
  };
  if (p.producto_id == null || p.nombre_producto == null) return null;
  p.producto_id = String(p.producto_id);
  p.nombre_producto = String(p.nombre_producto);
  p.descripcion = String(p.descripcion ?? "");
  p.precio_unitario = Number(p.precio_unitario) || 0;
  p.stock = Number(p.stock) || 0;
  p.categoria_id = p.categoria_id != null ? Number(p.categoria_id) : null;
  p.estado_producto = String(p.estado_producto || "activo");
  p.fecha_creacion = p.fecha_creacion ? String(p.fecha_creacion) : "";
  return p;
}
function mapProductos(resp) {
  return toArrayData(resp).map(normalizeProducto).filter(Boolean);
}
const money = (n) =>
  (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

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

/* ------------------------------
   Referencias DOM
--------------------------------*/
const filtroNombre   = document.getElementById("filtroNombre");
const btnBuscarNombre= document.getElementById("btnBuscarNombre");
const filtroCategoria= document.getElementById("filtroCategoria");
const ordenarPor     = document.getElementById("ordenarPor");
const btnLimpiar     = document.getElementById("btnLimpiar");
const btnNuevo       = document.getElementById("btnNuevo");

// Modal crear/editar
const modalProductoEl   = document.getElementById("modalProducto");
const formProducto      = document.getElementById("formProducto");
const modalTitulo       = document.getElementById("modalProductoTitulo");
const f_id              = document.getElementById("producto_id");
const f_nombre          = document.getElementById("nombre_producto");
const f_precio          = document.getElementById("precio_unitario");
const f_stock           = document.getElementById("stock");
const f_categoria       = document.getElementById("categoria_id");
const f_desc            = document.getElementById("descripcion");
const f_estado          = document.getElementById("estado_producto");

// Modal confirmar
const modalConfirmEl    = document.getElementById("modalConfirm");
const confirmMsg        = document.getElementById("confirmMsg");
const confirmId         = document.getElementById("confirmId");
const btnConfirmarAccion= document.getElementById("btnConfirmarAccion");

// Helpers bootstrap
const bsModalProducto = () => bootstrap.Modal.getOrCreateInstance(modalProductoEl);
const bsModalConfirm  = () => bootstrap.Modal.getOrCreateInstance(modalConfirmEl);

/* ------------------------------
   DataTable
--------------------------------*/
let dt; // instancia DataTable

const COLMAP = {
  // mapea select "ordenarPor" -> índice de columna DataTable
  nombre_producto: 1,
  precio_unitario: 3,
  stock: 4,
  categoria_id: 5,
  estado_producto: 6
};

function initOrUpdateTable(rows) {
  const data = Array.isArray(rows) ? rows : [];
  if (dt) {
    dt.clear().rows.add(data).draw();
    return dt;
  }
  dt = $("#tablaProductos").DataTable({
    data,
    columns: [
      { data: "producto_id", title: "ID" },
      { data: "nombre_producto", title: "Nombre" },
      { data: "descripcion", title: "Descripción" },
      { data: "precio_unitario", title: "Precio", render: (v) => money(v) },
      { data: "stock", title: "Stock" },
      { data: "categoria_id", title: "Categoría" },
      { data: "estado_producto", title: "Estado" },
      { data: "fecha_creacion", title: "Fecha" },
      {
        data: null,
        title: "Acciones",
        className: "text-end",
        orderable: false,
        render: (row) => `
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary btn-editar" data-id="${row.producto_id}">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-outline-danger btn-eliminar" data-id="${row.producto_id}" data-name="${row.nombre_producto}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`
      }
    ],
    responsive: true,
    pageLength: 10,
    order: [[0, "desc"]]
  });
  return dt;
}

/* ------------------------------
   Cargas iniciales
--------------------------------*/
async function cargarCategoriasEnSelects() {
  try {
    const resp = assertOk(await categoriasAPI.getList());
    const list = toArrayData(resp)
      .map((r) => ({ id: r.categoria_id ?? r.id, nombre: r.nombre_categoria ?? r.nombre }))
      .filter((x) => x.id != null && x.nombre != null);

    // Filtro (arriba)
    while (filtroCategoria.firstChild) filtroCategoria.removeChild(filtroCategoria.firstChild);
    const optTodas = document.createElement("option");
    optTodas.value = "";
    optTodas.textContent = "(Todas)";
    filtroCategoria.appendChild(optTodas);
    list.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = `${c.id} — ${c.nombre}`;
      filtroCategoria.appendChild(o);
    });

    // Select del formulario (modal)
    while (f_categoria.firstChild) f_categoria.removeChild(f_categoria.firstChild);
    const optSel = document.createElement("option");
    optSel.value = "";
    optSel.textContent = "Selecciona…";
    f_categoria.appendChild(optSel);
    list.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = `${c.id} — ${c.nombre}`;
      f_categoria.appendChild(o);
    });

    console.log("se preciono el boton \"(auto) cargar categorias\" y se llamo a la api \"/categorias/get_list\" respuesta :", resp);
  } catch (err) {
    console.error("Error cargando categorías:", err?.message || err);
  }
}

async function cargarTodo() {
  try {
    const boton = "(auto) cargar todo", api = "/get_all";
    const resp = assertOk(await productosAPI.getAll());
    const data = mapProductos(resp);
    initOrUpdateTable(data);
    logPaso(boton, api, resp);
  } catch (err) {
    logError("(auto) cargar todo", "/get_all", err);
    initOrUpdateTable([]);
  }
}

/* ------------------------------
   Filtros y acciones (encabezado)
--------------------------------*/
btnBuscarNombre?.addEventListener("click", async () => {
  const nombre = String(filtroNombre.value || "").trim();
  if (!nombre) return;
  try {
    const boton = "Buscar por nombre", api = `/by_name?nombre=${nombre}`;
    const resp = assertOk(await productosAPI.getByName(nombre));
    const data = mapProductos(resp);
    initOrUpdateTable(data);
    logPaso(boton, api, resp);
  } catch (err) {
    logError("Buscar por nombre", `/by_name?nombre=${filtroNombre.value}`, err);
  }
});

filtroCategoria?.addEventListener("change", async () => {
  const cat = filtroCategoria.value;
  try {
    if (!cat) {
      const boton = "Filtrar por categoría (todas)", api = "/get_all";
      const resp = assertOk(await productosAPI.getAll());
      initOrUpdateTable(mapProductos(resp));
      logPaso(boton, api, resp);
      return;
    }
    const boton = "Filtrar por categoría", api = `/by_categoria/${cat}`;
    const resp = assertOk(await productosAPI.getByCategoria(cat));
    initOrUpdateTable(mapProductos(resp));
    logPaso(boton, api, resp);
  } catch (err) {
    logError("Filtrar por categoría", `/by_categoria/${cat || ""}`, err);
  }
});

ordenarPor?.addEventListener("change", () => {
  const col = COLMAP[ordenarPor.value] ?? 0;
  dt?.order([col, "asc"]).draw();
});

btnLimpiar?.addEventListener("click", async () => {
  filtroNombre.value = "";
  filtroCategoria.value = "";
  ordenarPor.value = "nombre_producto";
  try {
    const boton = "Limpiar filtros", api = "/get_all";
    const resp = assertOk(await productosAPI.getAll());
    initOrUpdateTable(mapProductos(resp));
    logPaso(boton, api, resp);
  } catch (err) {
    logError("Limpiar filtros", "/get_all", err);
  }
});

/* ------------------------------
   Crear / Editar
--------------------------------*/
btnNuevo?.addEventListener("click", () => {
  modalTitulo.textContent = "Nuevo producto";
  f_id.value = "";
  formProducto.reset();
  f_estado.value = "activo";
  bsModalProducto().show();
  logPaso("Nuevo producto", "(abrir modal)", { ok: true });
});

// Delegación: editar / eliminar
$("#tablaProductos tbody").on("click", "button.btn-editar", async function () {
  const id = this.dataset.id;
  try {
    const boton = "Editar (cargar por id)", api = `/by_id/${id}`;
    const resp = assertOk(await productosAPI.getOne(id));
    const p = mapProductos(resp)[0];
    if (!p) throw new Error("Producto no encontrado");

    modalTitulo.textContent = "Editar producto";
    f_id.value = p.producto_id;
    f_nombre.value = p.nombre_producto;
    f_precio.value = p.precio_unitario;
    f_stock.value = p.stock;
    f_categoria.value = p.categoria_id ?? "";
    f_desc.value = p.descripcion || "";
    f_estado.value = p.estado_producto || "activo";
    bsModalProducto().show();
    logPaso(boton, api, resp);
  } catch (err) {
    logError("Editar (cargar por id)", `/by_id/${id}`, err);
  }
});

$("#tablaProductos tbody").on("click", "button.btn-eliminar", function () {
  const id = this.dataset.id;
  const name = this.dataset.name || id;
  confirmId.value = id;
  confirmMsg.textContent = `¿Seguro que deseas eliminar el producto "${name}" (ID ${id})?`;
  bsModalConfirm().show();
  logPaso("Eliminar (abrir confirmación)", "(modal)", { id, name });
});

// Guardar (crear/actualizar)
formProducto?.addEventListener("submit", async (e) => {
  e.preventDefault();
  formProducto.classList.add("was-validated");
  if (!formProducto.checkValidity()) return;

  const payload = {
    producto_id: f_id.value || undefined,
    nombre_producto: f_nombre.value.trim(),
    descripcion: f_desc.value.trim() || null,
    precio_unitario: Number(f_precio.value),
    stock: Number(f_stock.value),
    categoria_id: Number(f_categoria.value),
    estado_producto: f_estado.value
  };

  try {
    if (payload.producto_id) {
      const boton = "Guardar edición", api = "/update";
      const resp = assertOk(await productosAPI.update(payload));
      logPaso(boton, api, resp);
      showAlert("success", "Producto actualizado");
    } else {
      const boton = "Guardar nuevo", api = "/insert";
      const resp = assertOk(await productosAPI.insert(payload));
      logPaso(boton, api, resp);
      showAlert("success", "Producto creado");
    }
    bsModalProducto().hide();
    await recargarSegunFiltroActual();
  } catch (err) {
    showAlert("danger", err?.message || "Error al guardar");
    logError(payload.producto_id ? "Guardar edición" : "Guardar nuevo", payload.producto_id ? "/update" : "/insert", err);
  }
});

// Confirmar eliminación
btnConfirmarAccion?.addEventListener("click", async () => {
  const id = confirmId.value;
  if (!id) return;
  try {
    const boton = "Confirmar eliminar", api = "/delete";
    const resp = assertOk(await productosAPI.remove(id));
    logPaso(boton, api, resp);
    showAlert("success", "Producto eliminado");
    bsModalConfirm().hide();
    await recargarSegunFiltroActual();
  } catch (err) {
    showAlert("danger", err?.message || "Error al eliminar");
    logError("Confirmar eliminar", "/delete", err);
  }
});

/* ------------------------------
   Recarga según filtros activos
--------------------------------*/
async function recargarSegunFiltroActual() {
  const nombre = String(filtroNombre.value || "").trim();
  const cat    = String(filtroCategoria.value || "");
  try {
    if (nombre) {
      const resp = assertOk(await productosAPI.getByName(nombre));
      return initOrUpdateTable(mapProductos(resp));
    }
    if (cat) {
      const resp = assertOk(await productosAPI.getByCategoria(cat));
      return initOrUpdateTable(mapProductos(resp));
    }
    const resp = assertOk(await productosAPI.getAll());
    return initOrUpdateTable(mapProductos(resp));
  } catch (err) {
    logError("recargarSegunFiltroActual", "(según filtro)", err);
    initOrUpdateTable([]);
  }
}

/* ------------------------------
   Boot
--------------------------------*/
document.addEventListener("DOMContentLoaded", async () => {
  await cargarCategoriasEnSelects();
  await cargarTodo();
});
