import { productosAPI } from '/admin-resources/scripts/apis/productsManager.js';
import { categoriasAPI } from '/admin-resources/scripts/apis/categoriesManager.js';

// ======= Helpers DOM =======
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const alertBox = $('#alertBox');
function showAlert(type, msg, autoHideMs = 4000) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.add('show');
  if (autoHideMs) setTimeout(() => alertBox.classList.remove('show'), autoHideMs);
}

// ======= Validaciones =======
const reNombre = /^[\p{L}\p{N}\s\-_.(),&/]{2,50}$/u; // 2..50, letras/números/espacios y símbolos comunes

function validarFormulario() {
  const nombre = $('#nombre_producto').value.trim();
  const desc   = $('#descripcion').value.trim();
  const precio = Number($('#precio_unitario').value);
  const stock  = Number($('#stock').value);
  const catId  = Number($('#categoria_id').value);
  const estado = ($('#estado_producto').value || '').trim();

  let ok = true;
  // limpiar estados
  for (const id of ['errNombre','errDesc','errPrecio','errStock','errCategoria','errEstado']) $(`#${id}`).textContent = '';
  for (const id of ['nombre_producto','descripcion','precio_unitario','stock','categoria_id','estado_producto']) $(`#${id}`).classList.remove('is-invalid');

  if (!nombre || !reNombre.test(nombre)) {
    $('#errNombre').textContent = 'Nombre requerido (máx 50; sin caracteres raros).';
    $('#nombre_producto').classList.add('is-invalid');
    ok = false;
  }
  if (desc.length > 150) {
    $('#errDesc').textContent = 'La descripción no puede exceder 150 caracteres.';
    $('#descripcion').classList.add('is-invalid');
    ok = false;
  }
  if (!Number.isFinite(precio) || precio < 0) {
    $('#errPrecio').textContent = 'Precio inválido.';
    $('#precio_unitario').classList.add('is-invalid');
    ok = false;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    $('#errStock').textContent = 'Stock inválido (entero ≥ 0).';
    $('#stock').classList.add('is-invalid');
    ok = false;
  }
  if (!Number.isInteger(catId) || catId <= 0) {
    $('#errCategoria').textContent = 'Selecciona una categoría.';
    $('#categoria_id').classList.add('is-invalid');
    ok = false;
  }
  if (!estado) {
    $('#errEstado').textContent = 'Selecciona el estado.';
    $('#estado_producto').classList.add('is-invalid');
    ok = false;
  }

  return ok;
}

// ======= DataTable =======
let dt;

function renderActions(row) {
  const id = row.producto_id;
  const name = row.nombre_producto ?? '';
  return `
    <div class="btn-group btn-group-sm" role="group">
      <button class="btn btn-outline-primary btn-editar" data-id="${id}" title="Modificar">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" data-name="${String(name).replaceAll('"','&quot;')}" title="Eliminar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`;
}

function fmtMoney(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '';
  // Ajusta a tu preferencia regional; puedes mostrar como simple número si lo prefieres
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

async function cargarProductos() {
  try {
    const res = await productosAPI.getAll();
    const rows = Array.isArray(res?.data) ? res.data : [];

    if (!dt) {
      dt = new DataTable('#tabla-productos', {
        data: rows,
        columns: [
          { data: 'producto_id' },
          { data: 'nombre_producto' },
          { data: 'descripcion' },
          { data: 'precio_unitario', render: (v) => fmtMoney(v) },
          { data: 'stock' },
          { data: 'categoria_id' },
          { data: 'estado_producto' },
          { data: null, orderable: false, searchable: false, render: renderActions }
        ],
        order: [[1, 'asc']],
        language: { url: 'https://cdn.datatables.net/plug-ins/2.0.3/i18n/es-ES.json' }
      });

      $('#tabla-productos tbody').addEventListener('click', onTablaClick);
    } else {
      dt.clear();
      dt.rows.add(rows).draw();
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

  if (btn.classList.contains('btn-editar')) {
    abrirModalEditar(id);
  } else if (btn.classList.contains('btn-eliminar')) {
    abrirModalEliminar(id, btn.dataset.name || '');
  }
}

// ======= Modales =======
const modalProd = new bootstrap.Modal('#modalProducto');
const modalDel  = new bootstrap.Modal('#modalEliminar');

function limpiarFormulario() {
  $('#producto_id').value = '';
  $('#nombre_producto').value = '';
  $('#descripcion').value = '';
  $('#precio_unitario').value = '';
  $('#stock').value = '';
  $('#categoria_id').value = '';
  $('#estado_producto').value = 'activo';
  for (const id of ['nombre_producto','descripcion','precio_unitario','stock','categoria_id','estado_producto']) $(`#${id}`).classList.remove('is-invalid');
  for (const id of ['errNombre','errDesc','errPrecio','errStock','errCategoria','errEstado']) $(`#${id}`).textContent = '';
}

async function cargarCategoriasEnSelect(selectedId) {
  const sel = $('#categoria_id');
  sel.innerHTML = '<option value="">Selecciona una categoría…</option>';
  try {
    const r = await categoriasAPI.getAll();
    const cats = Array.isArray(r?.data) ? r.data : [];
    for (const c of cats) {
      const opt = document.createElement('option');
      opt.value = String(c.categoria_id);
      opt.textContent = `${c.categoria_id} — ${c.nombre_categoria}`;
      sel.appendChild(opt);
    }
    if (selectedId) sel.value = String(selectedId);
  } catch (err) {
    showAlert('warning', 'No fue posible cargar categorías.');
  }
}

function abrirModalNueva() {
  limpiarFormulario();
  $('#modalProductoTitulo').textContent = 'Añadir producto';
  $('#btnGuardar').textContent = 'Guardar';
  cargarCategoriasEnSelect();
  modalProd.show();
  setTimeout(() => $('#nombre_producto')?.focus(), 250);
}

async function abrirModalEditar(id) {
  limpiarFormulario();
  $('#modalProductoTitulo').textContent = 'Modificar producto';
  $('#btnGuardar').textContent = 'Actualizar';

  let fila;
  try {
    const r = await productosAPI.getOne(id);
    fila = Array.isArray(r?.data) ? r.data[0] : (r?.data || r);
  } catch { /* fallback */ }

  if (!fila && dt) {
    fila = dt.rows().data().toArray().find(x => String(x.producto_id) === String(id));
  }
  if (!fila) { showAlert('danger', 'No se encontró el producto a editar.'); return; }

  await cargarCategoriasEnSelect(fila.categoria_id);

  $('#producto_id').value       = fila.producto_id ?? '';
  $('#nombre_producto').value   = (fila.nombre_producto ?? '').trim();
  $('#descripcion').value       = (fila.descripcion ?? '').trim();
  $('#precio_unitario').value   = String(fila.precio_unitario ?? '');
  $('#stock').value             = String(fila.stock ?? '');
  $('#estado_producto').value   = (fila.estado_producto ?? 'activo');

  modalProd.show();
  setTimeout(() => $('#nombre_producto')?.focus(), 250);
}

function abrirModalEliminar(id, nombre) {
  $('#delId').value = id;
  $('#delNombre').textContent = nombre || `ID ${id}`;
  modalDel.show();
}

// ======= Guardar (insert/update) =======
$('#formProducto').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validarFormulario()) return;

  const payload = {
    producto_id: $('#producto_id').value ? String($('#producto_id').value) : undefined,
    nombre_producto: $('#nombre_producto').value.trim(),
    descripcion: $('#descripcion').value.trim() || null,
    precio_unitario: Number($('#precio_unitario').value),
    stock: Number($('#stock').value),
    categoria_id: Number($('#categoria_id').value),
    estado_producto: $('#estado_producto').value
  };

  const esEdicion = !!payload.producto_id;

  try {
    const res = esEdicion
      ? await productosAPI.update(payload)
      : await productosAPI.insert(payload);

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

// ======= Confirmar eliminar =======
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

// ======= Botones superiores =======
$('#btnConsultar').addEventListener('click', cargarProductos);
$('#btnAbrirModalNuevo').addEventListener('click', abrirModalNueva);

// Carga inicial
cargarProductos();