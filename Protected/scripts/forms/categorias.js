// UI Panel de Categorías
import { categoriasAPI } from '/admin-resources/scripts/apis/categoriasManager.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const alertBox = $('#alertBox');

function showAlert(type, msg, autoHideMs = 4000) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
  if (autoHideMs) setTimeout(() => alertBox.classList.add('d-none'), autoHideMs);
}

const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleString('es-MX') : (v || '—');
};

// ===== DataTable =====
let dt;
function initTabla() {
  dt = $('#tablaCategorias').DataTable({
    data: [],
    columns: [
      { data: 'categoria_id', render: v => v ?? '—' },
      { data: 'nombre_categoria', render: v => v ?? '—' },
      { data: 'descripcion', render: v => v ?? '' },
      { data: 'fecha_creacion', render: v => fmtDate(v) },
      {
        data: null, orderable: false, searchable: false, className: 'text-end',
        render: (row) => {
          const id = row.categoria_id ?? '';
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-editar" data-id="${id}" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" data-nombre="${row.nombre_categoria||''}" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>`;
        }
      }
    ],
    order: [[3, 'desc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  // Delegación de acciones
  $('#tablaCategorias tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.classList.contains('btn-editar')) abrirModalEditar(id);
    else if (btn.classList.contains('btn-eliminar')) abrirConfirmEliminar(id, btn.dataset.nombre || '');
  });
}

// ===== Carga =====
async function recargar() {
  try {
    const out = await categoriasAPI.getAll();
    const rows = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
    dt.clear().rows.add(rows).draw();
    showAlert('success', `Se cargaron ${rows.length} categoría(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible cargar categorías');
  }
}

// ===== Filtros =====
$('#btnBuscar').addEventListener('click', () => {
  const term = $('#filtroNombre').value.trim();
  dt.search(term).draw();
});
$('#btnListarTodo').addEventListener('click', recargar);
$('#btnLimpiar').addEventListener('click', () => {
  $('#filtroNombre').value = '';
  dt.search('').draw();
});

// ===== Modal Crear/Editar =====
const modalCat = new bootstrap.Modal('#modalCategoria');

function limpiarForm() {
  $('#categoria_id').value = '';
  $('#nombre_categoria').value = '';
  $('#descripcion').value = '';
  $$('#formCategoria .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

$('#btnNuevo').addEventListener('click', () => {
  limpiarForm();
  $('#modalTitulo').textContent = 'Nueva categoría';
  $('#btnGuardar').textContent = 'Guardar';
  modalCat.show();
  setTimeout(() => $('#nombre_categoria')?.focus(), 200);
});

async function abrirModalEditar(categoria_id) {
  try {
    limpiarForm();
    $('#modalTitulo').textContent = 'Editar categoría';
    $('#btnGuardar').textContent = 'Actualizar';

    // De la tabla o de la API
    const tableRow = dt.rows().data().toArray().find(r => String(r.categoria_id) === String(categoria_id));
    const row = tableRow ?? (await categoriasAPI.getOne(categoria_id));
    const data = row?.data ?? row;
    if (!data) throw new Error('No se pudo cargar la categoría');

    $('#categoria_id').value = data.categoria_id ?? '';
    $('#nombre_categoria').value = data.nombre_categoria ?? '';
    $('#descripcion').value = data.descripcion ?? '';

    modalCat.show();
    setTimeout(() => $('#nombre_categoria')?.focus(), 200);
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible abrir el formulario');
  }
}

function validarForm() {
  let ok = true;
  const nombre = $('#nombre_categoria');
  const desc = $('#descripcion');
  [nombre, desc].forEach(el => el.classList.remove('is-invalid'));

  const n = nombre.value.trim();
  if (!n || n.length > 50) { nombre.classList.add('is-invalid'); ok = false; }
  if ((desc.value || '').length > 255) { desc.classList.add('is-invalid'); ok = false; }
  return ok;
}

$('#formCategoria').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validarForm()) return;

  const id = $('#categoria_id').value.trim();
  const payload = {
    nombre_categoria: $('#nombre_categoria').value.trim(),
    descripcion: $('#descripcion').value.trim() || null
  };

  try {
    if (id) {
      await categoriasAPI.update({ categoria_id: Number(id), ...payload });
      showAlert('success', 'Categoría actualizada.');
    } else {
      await categoriasAPI.insert(payload);
      showAlert('success', 'Categoría creada.');
    }
    modalCat.hide();
    recargar();
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible guardar');
  }
});

// ===== Confirmación eliminar =====
const modalConfirm = new bootstrap.Modal('#modalConfirm');

function abrirConfirmEliminar(categoria_id, nombre='') {
  $('#confirmAccion').value = 'eliminar';
  $('#confirmId').value = String(categoria_id);
  $('#confirmTitulo').textContent = 'Eliminar categoría';
  $('#confirmMsg').textContent = `¿Eliminar la categoría "${nombre || categoria_id}"? Esta acción no se puede deshacer.`;
  modalConfirm.show();
}

$('#btnConfirmarAccion').addEventListener('click', async () => {
  const id = Number($('#confirmId').value);
  try {
    await categoriasAPI.remove(id);
    modalConfirm.hide();
    showAlert('success', 'Categoría eliminada.');
    recargar();
  } catch (err) {
    modalConfirm.hide();
    showAlert('danger', err.message || 'No fue posible eliminar');
  }
});

// ===== Boot =====
(async function boot() {
  try {
    initTabla();
    await recargar();
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
