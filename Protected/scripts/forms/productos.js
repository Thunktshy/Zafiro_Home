// scripts/forms/productos.js
// UI de administración para Productos (DataTable + modales + CRUD)
// Requiere: productosAPI (productosManager.js) y categoriasAPI (categoriesManager.js)

import { productosAPI } from '/admin-resources/scripts/apis/productosManager.js';
import { categoriasAPI } from '/admin-resources/scripts/apis/categoriesManager.js';

// Utilidades UI
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const money = (n) => (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

function showAlert(kind, msg) {
  const box = $('#alertBox');
  box.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-info', 'alert-warning');
  box.classList.add(`alert-${kind}`);
  box.textContent = msg;
  // auto-hide
  setTimeout(() => { box.classList.add('d-none'); }, 4000);
}

function unpack(response) {
  // Soporta { success, data } o respuesta directa (Array)
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (typeof response === 'object' && Array.isArray(response.data)) return response.data;
  return [];
}

function stateBadge(estado) {
  const e = String(estado || '').toLowerCase();
  const cls = e === 'activo' ? 'bg-success' : 'bg-secondary';
  return `<span class="badge ${cls}">${e || 'N/D'}</span>`;
}

let tabla; // instancia DataTable
let modalProducto, modalConfirm; // bootstrap modals
let accionConfirm = null; // { type: 'soft'|'restore'|'hard', id }

// Mapea campo → índice de columna en la tabla para ordenar
const COL_INDEX = {
  producto_id: 0,
  nombre_producto: 1,
  descripcion: 2,
  precio_unitario: 3,
  stock: 4,
  categoria_id: 5,
  estado_producto: 6,
  fecha_creacion: 7
};

async function cargarCategorias() {
  try {
    const res = await categoriasAPI.getList();
    const items = unpack(res);

    const selFiltro = $('#filtroCategoria');
    const selModal = $('#categoria_id');

    // limpia
    selFiltro.innerHTML = '<option value="">(Todas)</option>';
    selModal.innerHTML = '<option value="">Selecciona…</option>';

    for (const it of items) {
      // categories.get_list suele exponer { categoria_id, nombre_categoria }
      const id = it.categoria_id ?? it.id ?? it.value;
      const name = it.nombre_categoria ?? it.nombre ?? it.text;
      selFiltro.insertAdjacentHTML('beforeend', `<option value="${id}">${name}</option>`);
      selModal.insertAdjacentHTML('beforeend', `<option value="${id}">${name}</option>`);
    }
  } catch (err) {
    console.error('cargarCategorias error:', err);
    showAlert('danger', `No se pudieron cargar categorías: ${err.message}`);
  }
}

function configurarTabla() {
  if (tabla) {
    tabla.destroy();
    $('#tablaProductos tbody').innerHTML = '';
  }
  tabla = new DataTable('#tablaProductos', {
    paging: true,
    pageLength: 10,
    lengthChange: false,
    ordering: true,
    order: [[COL_INDEX.nombre_producto, 'asc']],
    searching: true,
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json'
    },
    columns: [
      { data: 'producto_id' },
      { data: 'nombre_producto' },
      { data: 'descripcion', defaultContent: '' },
      { data: 'precio_unitario', render: (v) => money(v) },
      { data: 'stock' },
      { data: 'categoria_id' },
      { data: 'estado_producto', render: (v) => stateBadge(v) },
      { data: 'fecha_creacion', render: (v) => v ? new Date(v).toLocaleString('es-MX') : '' },
      {
        data: null,
        orderable: false,
        searchable: false,
        className: 'text-end',
        render: (_v, _t, row) => {
          const id = row.producto_id;
          const isInactive = String(row.estado_producto).toLowerCase() === 'inactivo';
          const softBtn = isInactive
            ? `<button class="btn btn-sm btn-outline-success me-1" data-action="restore" data-id="${id}"><i class="bi bi-arrow-counterclockwise"></i> Restaurar</button>`
            : `<button class="btn btn-sm btn-outline-warning me-1" data-action="soft" data-id="${id}"><i class="bi bi-slash-circle"></i> Desactivar</button>`;
          return `
            <button class="btn btn-sm btn-primary me-1" data-action="edit" data-id="${id}"><i class="bi bi-pencil-square"></i> Editar</button>
            ${softBtn}
            <button class="btn btn-sm btn-outline-danger" data-action="hard" data-id="${id}"><i class="bi bi-trash"></i> Eliminar</button>
          `;
        }
      }
    ]
  });

  // Delegación de eventos de acciones
  $('#tablaProductos tbody').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');

    if (action === 'edit') {
      abrirModalEditar(id);
    } else if (action === 'soft' || action === 'restore' || action === 'hard') {
      prepararConfirm(action, id);
    }
  });
}

async function cargarTodos() {
  try {
    const res = await productosAPI.getAll();
    const rows = unpack(res);
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('success', 'Productos cargados');
  } catch (err) {
    console.error('cargarTodos error:', err);
    showAlert('danger', `Error al cargar productos: ${err.message}`);
  }
}

async function buscarPorNombre() {
  const nombre = $('#filtroNombre').value.trim();
  if (!nombre) return showAlert('warning', 'Escribe un nombre para buscar.');
  try {
    const res = await productosAPI.getByName(nombre);
    const rows = unpack(res);
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('info', `Resultados para nombre = "${nombre}"`);
  } catch (err) {
    console.error('buscarPorNombre error:', err);
    showAlert('danger', `Error al buscar por nombre: ${err.message}`);
  }
}

async function filtrarPorCategoria() {
  const cid = $('#filtroCategoria').value;
  if (!cid) return cargarTodos();
  try {
    const res = await productosAPI.getByCategoria(cid);
    const rows = unpack(res);
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('info', `Resultados para categoría #${cid}`);
  } catch (err) {
    console.error('filtrarPorCategoria error:', err);
    showAlert('danger', `Error al filtrar por categoría: ${err.message}`);
  }
}

function ordenarTabla() {
  const value = $('#ordenarPor').value;
  const idx = COL_INDEX[value] ?? COL_INDEX.nombre_producto;
  tabla.order([idx, 'asc']).draw();
}

function limpiarFiltros() {
  $('#filtroNombre').value = '';
  $('#filtroCategoria').value = '';
  $('#ordenarPor').value = 'nombre_producto';
  cargarTodos();
}

function abrirModalNuevo() {
  $('#modalProductoTitulo').textContent = 'Nuevo producto';
  $('#producto_id').value = '';
  $('#nombre_producto').value = '';
  $('#descripcion').value = '';
  $('#precio_unitario').value = '';
  $('#stock').value = '';
  $('#estado_producto').value = 'activo';
  $('#categoria_id').value = '';

  $('#formProducto').classList.remove('was-validated');
  modalProducto.show();
}

async function abrirModalEditar(id) {
  try {
    const res = await productosAPI.getOne(id);
    const data = res?.data || res; // soporta { data: {...} }

    $('#modalProductoTitulo').textContent = `Editar · ${data.producto_id}`;
    $('#producto_id').value = data.producto_id;
    $('#nombre_producto').value = data.nombre_producto || '';
    $('#descripcion').value = data.descripcion || '';
    $('#precio_unitario').value = data.precio_unitario ?? '';
    $('#stock').value = data.stock ?? '';
    $('#estado_producto').value = (data.estado_producto || 'activo');
    $('#categoria_id').value = data.categoria_id ?? '';

    $('#formProducto').classList.remove('was-validated');
    modalProducto.show();
  } catch (err) {
    console.error('abrirModalEditar error:', err);
    showAlert('danger', `No se pudo cargar el producto: ${err.message}`);
  }
}

function prepararConfirm(type, id) {
  accionConfirm = { type, id };
  const msg = type === 'hard'
    ? `¿Eliminar definitivamente el producto <strong>${id}</strong>?`
    : type === 'soft'
      ? `¿Desactivar el producto <strong>${id}</strong>? Podrás restaurarlo luego.`
      : `¿Restaurar el producto <strong>${id}</strong>?`;
  $('#confirmMsg').innerHTML = msg;
  modalConfirm.show();
}

async function ejecutarConfirm() {
  if (!accionConfirm) return;
  const { type, id } = accionConfirm;
  try {
    if (type === 'hard') await productosAPI.remove(id);
    else if (type === 'soft') await productosAPI.softDelete(id);
    else if (type === 'restore') await productosAPI.restore(id);

    modalConfirm.hide();
    accionConfirm = null;
    await cargarTodos();
  } catch (err) {
    console.error('ejecutarConfirm error:', err);
    showAlert('danger', `Acción fallida: ${err.message}`);
  }
}

function validarFormulario() {
  const form = $('#formProducto');
  form.classList.add('was-validated');

  const nombre = $('#nombre_producto').value.trim();
  const precio = Number($('#precio_unitario').value);
  const stock = Number($('#stock').value);
  const cat = $('#categoria_id').value;

  if (!nombre || nombre.length > 50) return false;
  if (!Number.isFinite(precio) || precio < 0) return false;
  if (!Number.isInteger(stock) || stock < 0) return false;
  if (!cat) return false;
  return true;
}

async function guardarProducto(ev) {
  ev.preventDefault();
  if (!validarFormulario()) return;

  const payload = {
    producto_id: $('#producto_id').value.trim(),
    nombre_producto: $('#nombre_producto').value.trim(),
    descripcion: $('#descripcion').value.trim() || null,
    precio_unitario: Number($('#precio_unitario').value),
    stock: Number($('#stock').value),
    categoria_id: Number($('#categoria_id').value),
    estado_producto: $('#estado_producto').value
  };

  try {
    if (payload.producto_id) {
      await productosAPI.update(payload);
      showAlert('success', 'Producto actualizado correctamente');
    } else {
      // En insert, el backend genera producto_id con prefijo prd- y secuencia
      const { producto_id, ...body } = payload; // no enviar id
      await productosAPI.insert(body);
      showAlert('success', 'Producto creado correctamente');
    }
    modalProducto.hide();
    await cargarTodos();
  } catch (err) {
    console.error('guardarProducto error:', err);
    showAlert('danger', `No se pudo guardar: ${err.message}`);
  }
}

async function init() {
  // Instancia de modales
  modalProducto = new bootstrap.Modal('#modalProducto');
  modalConfirm  = new bootstrap.Modal('#modalConfirm');

  // DataTable + datos base
  configurarTabla();
  await cargarCategorias();
  await cargarTodos();

  // Eventos de filtros/acciones
  $('#btnBuscarNombre').addEventListener('click', buscarPorNombre);
  $('#filtroCategoria').addEventListener('change', filtrarPorCategoria);
  $('#ordenarPor').addEventListener('change', ordenarTabla);
  $('#btnLimpiar').addEventListener('click', limpiarFiltros);
  $('#btnNuevo').addEventListener('click', abrirModalNuevo);
  $('#btnConfirmarAccion').addEventListener('click', ejecutarConfirm);

  // Guardado del formulario (create/update)
  $('#formProducto').addEventListener('submit', guardarProducto);
}

// Espera a que carguen las dependencias (bootstrap/dataTables)
window.addEventListener('DOMContentLoaded', init);