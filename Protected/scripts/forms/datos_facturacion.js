// UI del Panel de Datos de facturación
import { datosFacturacionAPI } from '/admin-resources/scripts/apis/datosFacturacionManager.js';

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

// RFC MX básico (12 moral / 13 física)
const RFC_RE = /^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{2}[0-9A])$/i;

// ===== DataTable =====
let dt;
function initTabla() {
  dt = $('#tablaDatosFiscales').DataTable({
    data: [],
    columns: [
      { data: 'id', render: v => v ?? '—' },
      { data: 'cliente_id', render: v => v ?? '—' },
      { data: 'rfc', render: v => v ?? '—' },
      { data: 'razon_social', render: v => v ?? '—' },
      { data: 'direccion_fiscal', render: v => v ?? '' },
      { data: 'fecha_creacion', render: v => fmtDate(v) },
      {
        data: null, orderable: false, searchable: false, className: 'text-end',
        render: (row) => {
          const id = row.id ?? '';
          const cliente_id = row.cliente_id ?? '';
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-editar" data-id="${id}" data-cliente="${cliente_id}" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" data-cliente="${cliente_id}" data-rfc="${row.rfc||''}" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>`;
        }
      }
    ],
    order: [[5, 'desc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  // Delegación
  $('#tablaDatosFiscales tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const cliente = btn.dataset.cliente;
    if (btn.classList.contains('btn-editar')) abrirModalEditar(id, cliente);
    else if (btn.classList.contains('btn-eliminar')) abrirConfirmEliminar(id, cliente, btn.dataset.rfc || '');
  });
}

// ===== Carga de datos =====
async function listarTodos() {
  const out = await datosFacturacionAPI.getAll();
  return Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
}

async function listarPorCliente(cliente_id) {
  const out = await datosFacturacionAPI.getByCliente(cli(cliente_id));
  const data = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
  // algunos backends devuelven [] o [{...}] por cliente; lo normal es 1
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
    showAlert('danger', err.message || 'No se pudieron cargar los datos fiscales');
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
  $('#registro_id').value = '';
  $('#cliente_id').value = '';
  $('#rfc').value = '';
  $('#razon_social').value = '';
  $('#direccion_fiscal').value = '';
  $$('#formDatos .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

$('#btnNuevo').addEventListener('click', () => {
  limpiarForm();
  $('#modalTitulo').textContent = 'Nuevo registro';
  $('#btnGuardar').textContent = 'Guardar';
  modalDatos.show();
  setTimeout(() => $('#cliente_id')?.focus(), 200);
});

async function abrirModalEditar(id, cliente_id) {
  try {
    limpiarForm();
    $('#modalTitulo').textContent = 'Editar datos';
    $('#btnGuardar').textContent = 'Actualizar';

    // Cargar por ID si está disponible; fallback por cliente
    let row = null;
    if (id) row = (await datosFacturacionAPI.getById(id))?.data ?? null;
    if (!row && cliente_id) {
      const list = await listarPorCliente(cliente_id);
      row = list?.[0];
    }
    if (!row) throw new Error('No se pudo cargar el registro');

    $('#registro_id').value = row.id ?? '';
    $('#cliente_id').value = row.cliente_id ?? '';
    $('#rfc').value = row.rfc ?? '';
    $('#razon_social').value = row.razon_social ?? '';
    $('#direccion_fiscal').value = row.direccion_fiscal ?? '';

    modalDatos.show();
    setTimeout(() => $('#rfc')?.focus(), 200);
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible abrir el formulario');
  }
}

function validarForm() {
  let ok = true;
  const cliente = $('#cliente_id');
  const rfc = $('#rfc');
  const rz = $('#razon_social');

  [cliente, rfc, rz].forEach(el => el.classList.remove('is-invalid'));

  if (!cliente.value.trim()) { cliente.classList.add('is-invalid'); ok = false; }
  const rfcVal = $('#rfc').value.trim().toUpperCase();
  if (!RFC_RE.test(rfcVal) || !(rfcVal.length === 12 || rfcVal.length === 13)) {
    rfc.classList.add('is-invalid'); ok = false;
  }
  if (!rz.value.trim() || rz.value.trim().length > 100) {
    rz.classList.add('is-invalid'); ok = false;
  }
  return ok;
}

$('#formDatos').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validarForm()) return;

  const payload = {
    cliente_id: cli($('#cliente_id').value.trim()),
    rfc: $('#rfc').value.trim().toUpperCase(),
    razon_social: $('#razon_social').value.trim(),
    direccion_fiscal: $('#direccion_fiscal').value.trim() || null
  };

  try {
    // si existe registro_id asumimos UPDATE (aunque el endpoint usa cliente_id)
    if ($('#registro_id').value.trim()) {
      await datosFacturacionAPI.update(payload);
      showAlert('success', 'Datos fiscales actualizados.');
    } else {
      await datosFacturacionAPI.insert(payload);
      showAlert('success', 'Datos fiscales guardados.');
    }
    modalDatos.hide();
    // recargar según contexto: si filtro por cliente está lleno, conserva ese filtro
    const filtro = $('#filtroCliente').value.trim();
    await recargar(filtro ? 'cliente' : 'all');
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible guardar');
  }
});

// ===== Confirmación (Eliminar por cliente) =====
const modalConfirm = new bootstrap.Modal('#modalConfirm');

function abrirConfirmEliminar(id, cliente_id, rfc='') {
  $('#confirmAccion').value = 'eliminar';
  $('#confirmId').value = id || '';
  $('#confirmClienteId').value = cliente_id || '';
  $('#confirmTitulo').textContent = 'Eliminar datos de facturación';
  const c = cliente_id ? ` del cliente ${cliente_id}` : '';
  $('#confirmMsg').textContent = `¿Eliminar los datos fiscales${c}${rfc ? ` (RFC ${rfc})` : ''}? Esta acción no se puede deshacer.`;
  modalConfirm.show();
}

$('#btnConfirmarAccion').addEventListener('click', async () => {
  const accion = $('#confirmAccion').value;
  const cliente_id = $('#confirmClienteId').value || $('#cliente_id').value;
  try {
    if (accion === 'eliminar') {
      await datosFacturacionAPI.remove(cli(cliente_id));
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
