// Controlador de UI: DataTable, modales y validaciones
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

// ======= Validaciones (alineadas con backend) =======
const reNombre = /^[\p{L}\p{N}\s\-_.(),&/]{2,50}$/u; // 2..50, letras/números/espacios y símbolos comunes

function validarFormulario() {
  const nombre = $('#nombre_categoria').value.trim();
  const desc   = $('#descripcion').value.trim();

  let ok = true;
  $('#errNombre').textContent = '';
  $('#errDesc').textContent   = '';
  $('#nombre_categoria').classList.remove('is-invalid');
  $('#descripcion').classList.remove('is-invalid');

  if (!nombre) {
    $('#errNombre').textContent = 'El nombre es obligatorio.';
    $('#nombre_categoria').classList.add('is-invalid');
    ok = false;
  } else if (!reNombre.test(nombre)) {
    $('#errNombre').textContent = 'Formato inválido. Máx 50, sin caracteres especiales raros.';
    $('#nombre_categoria').classList.add('is-invalid');
    ok = false;
  }

  if (desc.length > 255) {
    $('#errDesc').textContent = 'La descripción no puede exceder 255 caracteres.';
    $('#descripcion').classList.add('is-invalid');
    ok = false;
  }

  return ok;
}

// ======= DataTable =======
let dt;

function renderActions(row) {
  const id = row.categoria_id;
  const name = row.nombre_categoria ?? '';
  return `
    <div class="btn-group btn-group-sm" role="group">
      <button class="btn btn-outline-primary btn-editar" data-id="${id}" title="Modificar">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" data-name="${name.replaceAll('"','&quot;')}" title="Eliminar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`;
}

async function cargarCategorias() {
  try {
    const res = await categoriasAPI.getAll(); // { success, data:[...] }
    const rows = Array.isArray(res?.data) ? res.data : [];

    if (!dt) {
      dt = new DataTable('#tabla-categorias', {
        data: rows,
        columns: [
          { data: 'categoria_id' },
          { data: 'nombre_categoria' },
          { data: 'descripcion' },
          { data: null, orderable: false, searchable: false, render: renderActions }
        ],
        order: [[0, 'asc']],
        language: {
          url: 'https://cdn.datatables.net/plug-ins/2.0.3/i18n/es-ES.json'
        }
      });

      $('#tabla-categorias tbody').addEventListener('click', onTablaClick);
    } else {
      dt.clear();
      dt.rows.add(rows).draw();
    }
    showAlert('success', `Se cargaron ${rows.length} categoría(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron obtener las categorías');
  }
}

function onTablaClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = Number(btn.dataset.id);

  if (btn.classList.contains('btn-editar')) {
    abrirModalEditar(id);
  } else if (btn.classList.contains('btn-eliminar')) {
    abrirModalEliminar(id, btn.dataset.name || '');
  }
}

// ======= Modales =======
const modalCat = new bootstrap.Modal('#modalCategoria');
const modalDel = new bootstrap.Modal('#modalEliminar');

function limpiarFormulario() {
  $('#categoria_id').value = '';
  $('#nombre_categoria').value = '';
  $('#descripcion').value = '';
  $('#nombre_categoria').classList.remove('is-invalid');
  $('#descripcion').classList.remove('is-invalid');
  $('#errNombre').textContent = '';
  $('#errDesc').textContent = '';
}

function abrirModalNueva() {
  limpiarFormulario();
  $('#modalCategoriaTitulo').textContent = 'Añadir categoría';
  $('#btnGuardar').textContent = 'Guardar';
  modalCat.show();
  setTimeout(() => $('#nombre_categoria')?.focus(), 250);
}

async function abrirModalEditar(id) {
  limpiarFormulario();
  $('#modalCategoriaTitulo').textContent = 'Modificar categoría';
  $('#btnGuardar').textContent = 'Actualizar';

  let fila;
  try {
    const r = await categoriasAPI.getOne(id);
    fila = Array.isArray(r?.data) ? r.data[0] : (r?.data || r);
  } catch { /* fallback */ }

  if (!fila && dt) {
    fila = dt.rows().data().toArray().find(x => Number(x.categoria_id) === Number(id));
  }

  if (!fila) {
    showAlert('danger', 'No se encontró la categoría a editar.');
    return;
  }

  $('#categoria_id').value     = fila.categoria_id ?? '';
  $('#nombre_categoria').value = (fila.nombre_categoria ?? '').trim();
  $('#descripcion').value      = (fila.descripcion ?? '').trim();

  modalCat.show();
  setTimeout(() => $('#nombre_categoria')?.focus(), 250);
}

function abrirModalEliminar(id, nombre) {
  $('#delId').value = id;
  $('#delNombre').textContent = nombre || `ID ${id}`;
  modalDel.show();
}

// ======= Guardar (insert/update) =======
$('#formCategoria').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validarFormulario()) return;

  const payload = {
    categoria_id: $('#categoria_id').value ? Number($('#categoria_id').value) : undefined,
    nombre_categoria: $('#nombre_categoria').value.trim(),
    descripcion: $('#descripcion').value.trim() || null
  };

  const esEdicion = !!payload.categoria_id;

  try {
    const res = esEdicion
      ? await categoriasAPI.update(payload)
      : await categoriasAPI.insert(payload);

    if (res?.success) {
      modalCat.hide();
      showAlert('success', res.message || (esEdicion ? 'Categoría actualizada' : 'Categoría creada'));
      await cargarCategorias();
    } else {
      throw new Error(res?.message || 'Operación no completada');
    }
  } catch (err) {
    showAlert('danger', err.message || 'Error al guardar');
  }
});

// ======= Confirmar eliminar =======
$('#btnConfirmarEliminar').addEventListener('click', async () => {
  const id = Number($('#delId').value);
  if (!id) { modalDel.hide(); return; }
  try {
    const res = await categoriasAPI.remove(id);
    if (res?.success) {
      modalDel.hide();
      showAlert('success', res.message || 'Categoría eliminada');
      await cargarCategorias();
    } else {
      throw new Error(res?.message || 'No se pudo eliminar');
    }
  } catch (err) {
    showAlert('danger', err.message || 'Error al eliminar');
  }
});

// ======= Botones superiores =======
$('#btnConsultar').addEventListener('click', cargarCategorias);
$('#btnAbrirModalNueva').addEventListener('click', abrirModalNueva);


cargarCategorias();
