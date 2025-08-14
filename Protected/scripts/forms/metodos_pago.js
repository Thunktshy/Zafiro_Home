// UI del Panel de Métodos de pago
import { metodosPagoAPI } from '/admin-resources/scripts/apis/metodosPagoManager.js';

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
  dt = $('#tablaMetodos').DataTable({
    data: [],
    columns: [
      { data: 'metodo_id', render: v => v ?? '—' },
      { data: 'cliente_id', render: v => v ?? '—' },
      { data: 'tipo', render: v => v ?? '—' },
      { data: 'es_principal', render: v => Number(v) ? 'Sí' : 'No' },
      { data: 'direccion', render: v => v ?? '' },
      { data: 'ciudad', render: v => v ?? '' },
      { data: 'codigo_postal', render: v => v ?? '' },
      { data: 'pais', render: v => v ?? '' },
      { data: 'fecha_creacion', render: v => fmtDate(v) },
      {
        data: null, orderable: false, searchable: false, className: 'text-end',
        render: (row) => {
          const id = row.metodo_id;
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-editar" data-id="${id}" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-outline-secondary btn-principal" data-id="${id}" title="Marcar como principal">
                <i class="fa-solid fa-star"></i>
              </button>
              <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" title="Eliminar">
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
  $('#tablaMetodos tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('btn-editar')) abrirModalEditar(id);
    else if (btn.classList.contains('btn-eliminar')) abrirConfirmEliminar(id);
    else if (btn.classList.contains('btn-principal')) marcarPrincipalRapido(id);
  });
}

// ===== Carga =====
async function listarTodos() {
  const out = await metodosPagoAPI.getAll();
  return Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
}

async function listarPorCliente(cliente_id) {
  const out = await metodosPagoAPI.getByCliente(cli(cliente_id));
  const data = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
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
    showAlert('success', `Se cargaron ${rows.length} método(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron cargar los métodos de pago');
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
const modalMet = new bootstrap.Modal('#modalMetodo');

function limpiarForm() {
  $('#metodo_id').value = '';
  $('#cliente_id').value = '';
  $('#tipo').value = '';
  $('#es_principal').checked = false;
  $('#datos').value = '';
  $('#direccion').value = '';
  $('#ciudad').value = '';
  $('#codigo_postal').value = '';
  $('#pais').value = '';
  $$('#formMetodo .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

function toggleOrigen() {
  const isPersonales = $('#origenPersonales').checked;
  $('#grupoCamposManual').classList.toggle('d-none', isPersonales);
  $('#btnFormatearJSON').disabled = isPersonales;
}
$$('input[name="origen"]').forEach(r => r.addEventListener('change', toggleOrigen));

$('#btnNuevo').addEventListener('click', () => {
  limpiarForm();
  $('#modalTitulo').textContent = 'Nuevo método';
  $('#btnGuardar').textContent = 'Guardar';
  $('#origenManual').checked = true;
  toggleOrigen();
  modalMet.show();
  setTimeout(() => $('#cliente_id')?.focus(), 200);
});

async function abrirModalEditar(metodo_id) {
  try {
    limpiarForm();
    $('#modalTitulo').textContent = 'Editar método';
    $('#btnGuardar').textContent = 'Actualizar';

    const row = (await metodosPagoAPI.getById(Number(metodo_id)))?.data;
    if (!row) throw new Error('No se pudo cargar el método');

    $('#metodo_id').value = row.metodo_id ?? '';
    $('#cliente_id').value = row.cliente_id ?? '';
    $('#tipo').value = row.tipo ?? '';
    $('#es_principal').checked = Number(row.es_principal) === 1;
    $('#datos').value = (typeof row.datos === 'string') ? row.datos : JSON.stringify(row.datos ?? {}, null, 2);
    $('#direccion').value = row.direccion ?? '';
    $('#ciudad').value = row.ciudad ?? '';
    $('#codigo_postal').value = row.codigo_postal ?? '';
    $('#pais').value = row.pais ?? '';

    // edición siempre en modo "manual" para poder actualizar campos
    $('#origenManual').checked = true;
    toggleOrigen();

    modalMet.show();
    setTimeout(() => $('#tipo')?.focus(), 200);
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible abrir el formulario');
  }
}

// ===== Validación simple =====
function validarForm() {
  let ok = true;
  const cliente = $('#cliente_id');
  const tipo = $('#tipo');
  [cliente, tipo].forEach(el => el.classList.remove('is-invalid'));

  if (!cliente.value.trim()) { cliente.classList.add('is-invalid'); ok = false; }
  if (!tipo.value.trim()) { tipo.classList.add('is-invalid'); ok = false; }

  return ok;
}

// ===== Helpers JSON =====
$('#btnFormatearJSON').addEventListener('click', () => {
  const txt = $('#datos').value.trim();
  if (!txt) return;
  try {
    const obj = JSON.parse(txt);
    $('#datos').value = JSON.stringify(obj, null, 2);
    showAlert('success', 'JSON formateado.');
  } catch {
    showAlert('warning', 'No es JSON válido; se enviará como texto.');
  }
});

function obtenerDatosNormalizados() {
  const raw = $('#datos').value.trim();
  if (!raw) return '';
  try { return JSON.parse(raw); } catch { return raw; } // el manager lo normaliza a JSON string
}

// ===== Guardar (insert/update | manual o desde personales) =====
$('#formMetodo').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validarForm()) return;

  const payloadBase = {
    cliente_id: cli($('#cliente_id').value.trim()),
    tipo: $('#tipo').value.trim(),
    es_principal: $('#es_principal').checked
  };

  try {
    const esEdicion = !!$('#metodo_id').value.trim();
    const origen = $('#origenPersonales').checked ? 'personales' : 'manual';

    if (esEdicion) {
      // UPDATE siempre manual (hay que enviar tipo+datos)
      await metodosPagoAPI.update({
        metodo_id: Number($('#metodo_id').value.trim()),
        tipo: payloadBase.tipo,
        datos: obtenerDatosNormalizados(),
        direccion: $('#direccion').value.trim() || null,
        ciudad: $('#ciudad').value.trim() || null,
        codigo_postal: $('#codigo_postal').value.trim() || null,
        pais: $('#pais').value.trim() || null,
        es_principal: payloadBase.es_principal // null mantendría, pero aquí respetamos el check
      });
      showAlert('success', 'Método actualizado.');
    } else {
      if (origen === 'personales') {
        await metodosPagoAPI.insertFromPersonales({
          cliente_id: payloadBase.cliente_id,
          tipo: payloadBase.tipo,
          es_principal: payloadBase.es_principal
        });
      } else {
        await metodosPagoAPI.insert({
          ...payloadBase,
          datos: obtenerDatosNormalizados(),
          direccion: $('#direccion').value.trim() || null,
          ciudad: $('#ciudad').value.trim() || null,
          codigo_postal: $('#codigo_postal').value.trim() || null,
          pais: $('#pais').value.trim() || null
        });
      }
      showAlert('success', 'Método guardado.');
    }

    modalMet.hide();
    const filtro = $('#filtroCliente').value.trim();
    await recargar(filtro ? 'cliente' : 'all');
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible guardar');
  }
});

// ===== Marcar principal rápido =====
// Carga el método, reenvía los mismos campos con es_principal=1
async function marcarPrincipalRapido(metodo_id) {
  try {
    const row = (await metodosPagoAPI.getById(Number(metodo_id)))?.data;
    if (!row) throw new Error('No se encontró el método.');

    await metodosPagoAPI.update({
      metodo_id: Number(metodo_id),
      tipo: row.tipo,
      datos: row.datos, // el manager normaliza
      direccion: row.direccion ?? null,
      ciudad: row.ciudad ?? null,
      codigo_postal: row.codigo_postal ?? null,
      pais: row.pais ?? null,
      es_principal: 1
    });

    showAlert('success', 'Marcado como principal.');
    const filtro = $('#filtroCliente').value.trim();
    await recargar(filtro ? 'cliente' : 'all');
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible marcar como principal');
  }
}

// ===== Confirmación eliminar =====
const modalConfirm = new bootstrap.Modal('#modalConfirm');

function abrirConfirmEliminar(metodo_id) {
  $('#confirmAccion').value = 'eliminar';
  $('#confirmId').value = String(metodo_id);
  $('#confirmTitulo').textContent = 'Eliminar método';
  $('#confirmMsg').textContent = `¿Eliminar el método ID ${metodo_id}? Esta acción no se puede deshacer.`;
  modalConfirm.show();
}

$('#btnConfirmarAccion').addEventListener('click', async () => {
  const accion = $('#confirmAccion').value;
  const id = Number($('#confirmId').value);
  try {
    if (accion === 'eliminar') await metodosPagoAPI.remove(id);
    modalConfirm.hide();
    showAlert('success', 'Método eliminado.');
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
    // si llegas con ?cl=... precarga por cliente
    const url = new URL(location.href);
    const q = url.searchParams.get('cl');
    if (q) {
      $('#filtroCliente').value = q;
      await recargar('cliente');
    } else {
      await recargar('all');
    }
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
