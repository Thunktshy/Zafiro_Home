// Controlador UI del panel de Productos (admin)
import { productosAPI, categoriasAPI } from '/admin-resources/scripts/apis/productosManager.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const alertBox = $('#alertBox');
function showAlert(type, msg, hideMs = 4000) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.add('show');
  if (hideMs) setTimeout(() => alertBox.classList.remove('show'), hideMs);
}

// ====== Catálogo de categorías en memoria (para mostrar nombre) ======
let CATS = new Map(); // categoria_id -> nombre_categoria
async function precargarCategorias() {
  try {
    const r = await categoriasAPI.getList();
    const list = Array.isArray(r?.data) ? r.data : [];
    CATS = new Map(list.map(c => [Number(c.categoria_id), c.nombre_categoria]));
  } catch { CATS = new Map(); }
}

// ====== Validaciones (todo obligatorio) ======
const reNombre = /^[\p{L}\p{N}\s\-_.(),&/]{2,50}$/u;
function validarFormulario() {
  const nombre  = $('#nombre_producto').value.trim();
  const desc    = $('#descripcion').value.trim();
  const precio  = Number($('#precio_unitario').value);
  const stock   = Number($('#stock').value);
  const catId   = Number($('#categoria_id').value);
  const estado  = String($('#estado_producto').value || '');

  let ok = true;
  const setErr = (id, msg) => { $('#'+id).textContent = msg; const ctl = $('#'+id.replace('err','') ); ctl?.classList.add('is-invalid'); ok = false; };
  $$('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  ['errNombre','errDesc','errPrecio','errStock','errCategoria','errEstado'].forEach(i => $('#'+i).textContent='');

  if (!nombre || !reNombre.test(nombre)) setErr('errNombre', 'Nombre inválido (2-50).');
  if (!desc) setErr('errDesc', 'Descripción requerida.');
  if (!(precio >= 0)) setErr('errPrecio', 'Precio inválido.');
  if (!(Number.isInteger(stock) && stock >= 0)) setErr('errStock', 'Stock inválido.');
  if (!Number.isInteger(catId)) setErr('errCategoria', 'Seleccione categoría.');
  if (!estado || (estado !== 'activo' && estado !== 'inactivo')) setErr('errEstado','Seleccione estado.');

  return ok;
}

// ====== DataTable ======
let dt;
function money(n) { return (Number(n)||0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }); }
function renderActions(row) {
  const id = row.producto_id;
  const name = row.nombre_producto ?? '';
  return `
    <div class="btn-group btn-group-sm" role="group">
      <button class="btn btn-outline-primary btn-editar" data-id="${id}" title="Modificar">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" data-name="${(name||'').replaceAll('"','&quot;')}" title="Eliminar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`;
}

async function cargarProductos() {
  try {
    await precargarCategorias();
    const res = await productosAPI.getAll();
    const rows = Array.isArray(res?.data) ? res.data : [];
    const withCatName = rows.map(r => ({
      ...r,
      _categoria_nombre: CATS.get(Number(r.categoria_id)) || r.categoria_id
    }));

    if (!dt) {
      dt = new DataTable('#tabla-productos', {
        data: withCatName,
        columns: [
          { data: 'producto_id' },
          { data: 'nombre_producto' },
          { data: 'descripcion' },
          { data: 'precio_unitario', render: v => money(v) },
          { data: 'stock' },
          { data: '_categoria_nombre' },
          { data: 'estado_producto' },
          { data: null, orderable: false, searchable: false, render: renderActions }
        ],
        order: [[1, 'asc']],
        language: { url: 'https://cdn.datatables.net/plug-ins/2.0.3/i18n/es-ES.json' }
      });
      $('#tabla-productos tbody').addEventListener('click', onTablaClick);
    } else {
      dt.clear(); dt.rows.add(withCatName).draw();
    }

    showAlert('success', `Se cargaron ${rows.length} producto(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron obtener los productos');
  }
}

function onTablaClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.classList.contains('btn-editar')) abrirModalEditar(id);
  else if (btn.classList.contains('btn-eliminar')) abrirModalEliminar(id, btn.dataset.name || '');
}

// ====== Modales ======
const modalProd = new bootstrap.Modal('#modalProducto');
const modalDel  = new bootstrap.Modal('#modalEliminar');

function limpiarFormulario() {
  $('#producto_id').value = '';
  $('#nombre_producto').value = '';
  $('#descripcion').value = '';
  $('#precio_unitario').value = '';
  $('#stock').value = '';
  $('#categoria_id').value = '';
  $('#estado_producto').value = '';
  $$('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  ['errNombre','errDesc','errPrecio','errStock','errCategoria','errEstado'].forEach(id => $('#'+id).textContent='');
}

async function llenarCategorias() {
  try {
    const r = await categoriasAPI.getList();
    const list = Array.isArray(r?.data) ? r.data : [];
    const sel = $('#categoria_id');
    sel.innerHTML = '<option value="" selected disabled>Seleccione...</option>';
    for (const c of list) {
      const opt = document.createElement('option');
      opt.value = c.categoria_id;
      opt.textContent = c.nombre_categoria;
      sel.appendChild(opt);
    }
  } catch { /* no bloquear UI */ }
}

function abrirModalNuevo() {
  limpiarFormulario();
  $('#modalProductoTitulo').textContent = 'Añadir producto';
  $('#btnGuardar').textContent = 'Guardar';
  llenarCategorias();
  modalProd.show();
  setTimeout(() => $('#nombre_producto')?.focus(), 250);
}

async function abrirModalEditar(id) {
  limpiarFormulario();
  $('#modalProductoTitulo').textContent = 'Modificar producto';
  $('#btnGuardar').textContent = 'Actualizar';
  await llenarCategorias();

  let fila;
  try {
    const r = await productosAPI.getOne(id);
    fila = Array.isArray(r?.data) ? r.data[0] : (r?.data || r);
  } catch {}
  if (!fila && dt) {
    fila = dt.rows().data().toArray().find(x => String(x.producto_id) === String(id));
  }
  if (!fila) { showAlert('danger', 'No se encontró el producto.'); return; }

  $('#producto_id').value     = fila.producto_id ?? '';
  $('#nombre_producto').value = (fila.nombre_producto ?? '').trim();
  $('#descripcion').value     = (fila.descripcion ?? '').trim();
  $('#precio_unitario').value = Number(fila.precio_unitario ?? 0);
  $('#stock').value           = Number(fila.stock ?? 0);
  $('#categoria_id').value    = Number(fila.categoria_id ?? '');
  $('#estado_producto').value = (fila.estado_producto ?? '').trim();

  modalProd.show();
  setTimeout(() => $('#nombre_producto')?.focus(), 250);
}

function abrirModalEliminar(id, nombre) {
  $('#delId').value = id;
  $('#delNombre').textContent = nombre || `ID ${id}`;
  modalDel.show();
}

// ====== Guardar (insert/update) ======
$('#formProducto').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validarFormulario()) return;

  const payload = {
    producto_id: $('#producto_id').value || undefined,      // no mandar en insert
    nombre_producto: $('#nombre_producto').value.trim(),
    descripcion: $('#descripcion').value.trim(),
    precio_unitario: Number($('#precio_unitario').value),
    stock: Number($('#stock').value),
    categoria_id: Number($('#categoria_id').value),
    estado_producto: String($('#estado_producto').value)
  };

  const esEdicion = !!payload.producto_id;
  try {
    const res = esEdicion ? await productosAPI.update(payload) : await productosAPI.insert(payload);
    if (res?.success) {
      modalProd.hide();
      showAlert('success', res.message || (esEdicion ? 'Producto actualizado' : 'Producto creado'));
      await cargarProductos();
    } else {
      throw new Error(res?.message || 'Operación no completada');
    }
  } catch (err) {
    showAlert('danger', err.message || 'Error al guardar');
  }
});

// ====== Confirmar eliminar ======
$('#btnConfirmarEliminar').addEventListener('click', async () => {
  const id = $('#delId').value;
  if (!id) { modalDel.hide(); return; }
  try {
    const res = await productosAPI.remove(id);
    if (res?.success) {
      modalDel.hide();
      showAlert('success', res.message || 'Producto eliminado');
      await cargarProductos();
    } else {
      throw new Error(res?.message || 'No se pudo eliminar');
    }
  } catch (err) {
    showAlert('danger', err.message || 'Error al eliminar');
  }
});

// ====== Botones ======
$('#btnConsultar').addEventListener('click', cargarProductos);
$('#btnAbrirModalNuevo').addEventListener('click', abrirModalNuevo);

// Primer load
cargarProductos();
