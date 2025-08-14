// UI del Panel de Datos personales
import { datosPersonalesAPI } from '/admin-resources/scripts/apis/datosPersonalesManager.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const alertBox = $('#alertBox');

function showAlert(type, msg, autoHideMs = 4000) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
  if (autoHideMs) setTimeout(() => alertBox.classList.add('d-none'), autoHideMs);
}

const ensurePrefix = (v, prefix) => {
  const s = String(v ?? '').trim();
  return s && !s.startsWith(prefix) ? `${prefix}${s}` : s;
};
const cli = (id) => ensurePrefix(id, 'cl-');
const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleString('es-MX') : (v || '—');
};

// ===== DataTable =====
let dt;
function initTabla() {
  dt = $('#tablaDatosPersonales').DataTable({
    data: [],
    columns: [
      { data: 'datos_id', render: v => v ?? '—' },
      { data: 'cliente_id', render: v => v ?? '—' },
      { data: 'nombre', render: v => v ?? '—' },
      { data: 'apellidos', render: v => v ?? '—' },
      { data: 'telefono', render: v => v ?? '' },
      { data: 'ciudad', render: v => v ?? '' },
      { data: 'codigo_postal', render: v => v ?? '' },
      { data: 'pais', render: v => v ?? '' },
      { data: 'fecha_creacion', render: v => fmtDate(v) },
      {
        data: null, orderable: false, searchable: false, className: 'text-end',
        render: (row) => {
          const id = row.datos_id ?? '';
          const cliente = row.cliente_id ?? '';
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-editar" data-id="${id}" data-cliente="${cliente}" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-outline-danger btn-eliminar" data-cliente="${cliente}" data-nombre="${row.nombre||''}" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>`;
        }
      }
    ],
    order: [[8, 'desc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  // Delegación
  $('#tablaDatosPersonales tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('btn-editar')) abrirModalEditar(btn.dataset.id, btn.dataset.cliente);
    else if (btn.classList.contains('btn-eliminar')) abrirConfirmEliminar(btn.dataset.cliente, btn.dataset.nombre || '');
  });
}

// ===== Carga de datos =====
async function listarTodos() {
  const out = await datosPersonalesAPI.getAll();
  return Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
}

async function listarPorCliente(cliente_id) {
  const out = await datosPersonalesAPI.getByCliente(cli(cliente_id));
  const data = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
  // algunos backends devuelven [] o [{...}] por cliente; normalmente 1
  return data;
}

async function recargar(escenario = 'all') {
  try {
    let rows = [];
    if (escenario === 'cliente') {
      const id = $('#filtroCliente').value.trim();
      if (!id) return showAlert('warning', 'Indica un cliente.');
      rows = await listarPorCliente(id);
    } else {
      rows = await listarTodos();
    }
    dt.clear().rows.add(rows).draw();
    showAlert('success', `Se cargaron ${rows.length} registro(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron cargar los datos personales');
  }
}

// ===== Filtros =====
$('#btnBuscarCliente').addEventListener('click', () => recargar('cliente'));
$('#btnListarTodo').addEventListener('click', () => recargar('all'));
$('#btnLimpiar').addEventListener('click', () => {
  $('#filtroCliente').value = '';
  recargar('all');
});

// ===== Modal Crear/Editar =====
const modalDatos = new bootstrap.Modal('#modalDatos');

function limpiarForm() {
  $('#datos_id').value = '';
  $('#cliente_id').value = '';
  $('#nombre').value = '';
  $('#apellidos').value = '';
  $('#telefono').value = '';
  $('#direccion').value = '';
  $('#ciudad').value = '';
  $('#codigo_postal').value = '';
  $('#pais').value = '';
  $$('#formDatos .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

$('#btnNuevo').addEventListener('click', () => {
  limpiarForm();
  $('#modalTitulo').textContent = 'Nuevo registro';
  $('#btnGuardar').textContent = 'Guardar';
  modalDatos.show();
  setTimeout(() => $('#cliente_id')?.focus(), 200);
});

async function abrirModalEditar(datos_id, cliente_id) {
  try {
    limpiarForm();
    $('#modalTitulo').textContent = 'Editar datos';
    $('#btnGuardar').textContent = 'Actualizar';

    let row = null;
    if (datos_id) row = (await datosPersonalesAPI.getById(datos_id))?.data ?? null;
    if (!row && cliente_id) {
      const list = await listarPorCliente(cliente_id);
      row = list?.[0];
    }
    if (!row) throw new Error('No se pudo cargar el registro');

    $('#datos_id').value = row.datos_id ?? '';
    $('#cliente_id').value = row.cliente_id ?? '';
    $('#nombre').value = row.nombre ?? '';
    $('#apellidos').value = row.apellidos ?? '';
    $('#telefono').value = row.telefono ?? '';
    $('#direccion').value = row.direccion ?? '';
    $('#ciudad').value = row.ciudad ?? '';
    $('#codigo_postal').value = row.codigo_postal ?? '';
    $('#pais').value = row.pais ?? '';

    modalDatos.show();
    setTimeout(() => $('#nombre')?.focus(), 200);
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible abrir el formulario');
  }
}

// ===== Validación =====
function validarForm() {
  let ok = true;
  const reqs = [
    ['cliente_id', v => !!v.trim()],
    ['nombre', v => !!v.trim() && v.trim().length <= 50],
    ['apellidos', v => !!v.trim() && v.trim().length <= 100]
  ];
  reqs.forEach(([id, test]) => {
    const el = document.getElementById(id);
    el.classList.remove('is-invalid');
    if (!test(el.value || '')) { el.classList.add('is-invalid'); ok = false; }
  });
  // Longitudes opcionales
  [['telefono', 20], ['direccion', 200], ['ciudad', 50], ['codigo_postal', 10], ['pais', 50]].forEach(([id, max]) => {
    const el = document.getElementById(id);
    if ((el.value || '').length > max) { el.classList.add('is-invalid'); ok = false; }
  });
  return ok;
}

// ===== Guardar (insert/update por cliente_id) =====
$('#formDatos').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validarForm()) return;

  const payload = {
    cliente_id: cli($('#cliente_id').value.trim()),
    nombre: $('#nombre').value.trim(),
    apellidos: $('#apellidos').value.trim(),
    telefono: $('#telefono').value.trim() || null,
    direccion: $('#direccion').value.trim() || null,
    ciudad: $('#ciudad').value.trim() || null,
    codigo_postal: $('#codigo_postal').value.trim() || null,
    pais: $('#pais').value.trim() || null
  };

  try {
    if ($('#datos_id').value.trim()) {
      await datosPersonalesAPI.update(payload);
      showAlert('success', 'Datos personales actualizados.');
    } else {
      await datosPersonalesAPI.insert(payload);
      showAlert('success', 'Datos personales guardados.');
    }
    modalDatos.hide();
    const filtro = $('#filtroCliente').value.trim();
    await recargar(filtro ? 'cliente' : 'all');
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible guardar');
  }
});

// ===== Confirmación (Eliminar por cliente) =====
const modalConfirm = new bootstrap.Modal('#modalConfirm');

function abrirConfirmEliminar(cliente_id, nombre='') {
  $('#confirmAccion').value = 'eliminar';
  $('#confirmClienteId').value = cliente_id || '';
  $('#confirmTitulo').textContent = 'Eliminar datos personales';
  $('#confirmMsg').textContent = `¿Eliminar los datos personales del cliente ${cliente_id}${nombre ? ` (${nombre})` : ''}? Esta acción no se puede deshacer.`;
  modalConfirm.show();
}

$('#btnConfirmarAccion').addEventListener('click', async () => {
  const accion = $('#confirmAccion').value;
  const cliente_id = $('#confirmClienteId').value || $('#cliente_id').value;
  try {
    if (accion === 'eliminar') {
      await datosPersonalesAPI.remove(cli(cliente_id));
    }
    modalConfirm.hide();
    showAlert('success', 'Registro eliminado.');
    const filtro = $('#filtroCliente').value.trim();
    await recargar(filtro ? 'cliente' : 'all');
  } catch (err) {
    modalConfirm.hide();
    showAlert('danger', err.message || 'No fue posible eliminar');
  }
});

// ===== Boot =====
(async function boot() {
  try {
    initTabla();
    await recargar('all');
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
