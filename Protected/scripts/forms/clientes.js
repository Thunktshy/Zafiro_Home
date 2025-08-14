// UI del Panel de Clientes
import { clientsAPI } from '/admin-resources/scripts/apis/clientesManager.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const alertBox = $('#alertBox');

function showAlert(type, msg, autoHideMs = 4000) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
  if (autoHideMs) setTimeout(() => alertBox.classList.add('d-none'), autoHideMs);
}

// helpers
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
  dt = $('#tablaClientes').DataTable({
    data: [],
    columns: [
      { data: 'cliente_id', render: v => v ?? '—' },
      { data: 'cuenta', render: v => v ?? '—' },
      { data: 'email', render: v => v ?? '—' },
      { data: 'estado', render: v => (v == null ? '—' : (Number(v) ? 'activo' : 'inactivo')) },
      { data: 'ultimo_acceso', render: v => fmtDate(v) },
      { data: 'fecha_creacion', render: v => fmtDate(v) },
      {
        data: null, orderable: false, searchable: false, className: 'text-end',
        render: (row) => {
          const id = row.cliente_id;
          const activo = Number(row.estado) === 1;
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-editar" data-id="${id}" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
              ${activo
                ? `<button class="btn btn-outline-warning btn-desactivar" data-id="${id}" data-cuenta="${row.cuenta||''}" title="Desactivar">
                     <i class="fa-solid fa-user-slash"></i>
                   </button>`
                : `<button class="btn btn-outline-success btn-reactivar" data-id="${id}" data-cuenta="${row.cuenta||''}" title="Reactivar">
                     <i class="fa-solid fa-user-check"></i>
                   </button>`
              }
              <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" data-cuenta="${row.cuenta||''}" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>`;
        }
      }
    ],
    order: [[5, 'desc']], // por fecha_creacion
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  // delegación de eventos
  $('#tablaClientes tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('btn-editar')) abrirModalEditar(id);
    else if (btn.classList.contains('btn-desactivar')) abrirConfirm('desactivar', id, btn.dataset.cuenta);
    else if (btn.classList.contains('btn-reactivar')) abrirConfirm('reactivar', id, btn.dataset.cuenta);
    else if (btn.classList.contains('btn-eliminar')) abrirConfirm('eliminar', id, btn.dataset.cuenta);
  });
}

// ===== Carga de datos =====
async function recargarClientes(origen='search') {
  try {
    let rows = [];
    if (origen === 'byId') {
      const id = $('#filtroId').value.trim();
      if (!id) return showAlert('warning', 'Indica un ID.');
      const out = await clientsAPI.getOne(cli(id));
      const r = out?.data ?? out; // según backend
      rows = r ? [r] : [];
    } else {
      const term = $('#filtroTerm').value.trim();
      const solo_activos = $('#soloActivos').checked ? 1 : 0;
      const out = await clientsAPI.search({ term, solo_activos });
      rows = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
    }

    dt.clear().rows.add(rows).draw();
    showAlert('success', `Se cargaron ${rows.length} cliente(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron cargar los clientes');
  }
}

// ===== Filtros =====
$('#btnBuscar').addEventListener('click', () => recargarClientes('search'));
$('#btnBuscarId').addEventListener('click', () => recargarClientes('byId'));
$('#btnLimpiar').addEventListener('click', () => {
  $('#filtroTerm').value = '';
  $('#filtroId').value = '';
  $('#soloActivos').checked = true;
  recargarClientes('search');
});

// ===== Modal Crear/Editar =====
const modalCli = new bootstrap.Modal('#modalCliente');

function limpiarForm() {
  $('#cliente_id').value = '';
  $('#cuenta').value = '';
  $('#email').value = '';
  $('#contrasena').value = '';
  $$('#formCliente .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

$('#btnNuevo').addEventListener('click', () => {
  limpiarForm();
  $('#modalClienteTitulo').textContent = 'Nuevo cliente';
  $('#grupoContrasena').classList.remove('d-none'); // en alta se pide contraseña
  $('#contrasena').required = true;
  $('#btnGuardar').textContent = 'Guardar';
  modalCli.show();
  setTimeout(() => $('#cuenta')?.focus(), 200);
});

async function abrirModalEditar(cliente_id) {
  limpiarForm();
  $('#modalClienteTitulo').textContent = 'Editar cliente';
  $('#btnGuardar').textContent = 'Actualizar';
  $('#grupoContrasena').classList.add('d-none'); // no se cambia aquí
  $('#contrasena').required = false;

  try {
    // si el backend no expone getOne con todo, también vale tomar de la tabla:
    const tableRow = dt.rows().data().toArray().find(r => String(r.cliente_id) === String(cliente_id));
    const row = tableRow ?? (await clientsAPI.getOne(cliente_id))?.data;
    if (!row) throw new Error('No se pudo cargar el cliente');

    $('#cliente_id').value = row.cliente_id || '';
    $('#cuenta').value = row.cuenta || '';
    $('#email').value = row.email || '';

    modalCli.show();
    setTimeout(() => $('#cuenta')?.focus(), 200);
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible abrir el formulario');
  }
}

function validarForm(esAlta) {
  let ok = true;
  const cuenta = $('#cuenta');
  const email = $('#email');
  const pass = $('#contrasena');
  [cuenta, email, pass].forEach(el => el.classList.remove('is-invalid'));

  if (!cuenta.value.trim() || cuenta.value.trim().length > 20) { cuenta.classList.add('is-invalid'); ok = false; }
  const emailVal = email.value.trim();
  if (!emailVal || emailVal.length > 150 || !/\S+@\S+\.\S+/.test(emailVal)) { email.classList.add('is-invalid'); ok = false; }
  if (esAlta && !pass.value.trim()) { pass.classList.add('is-invalid'); ok = false; }

  return ok;
}

$('#formCliente').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const esAlta = !$('#cliente_id').value.trim();
  if (!validarForm(esAlta)) return;

  try {
    if (esAlta) {
      await clientsAPI.insert({
        cuenta: $('#cuenta').value.trim(),
        email: $('#email').value.trim(),
        contrasena: $('#contrasena').value.trim()
      });
      showAlert('success', 'Cliente creado correctamente.');
    } else {
      await clientsAPI.update({
        cliente_id: $('#cliente_id').value.trim(),
        cuenta: $('#cuenta').value.trim(),
        email: $('#email').value.trim()
      });
      showAlert('success', 'Cliente actualizado.');
    }
    modalCli.hide();
    recargarClientes('search');
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible guardar');
  }
});

// ===== Confirmaciones: desactivar / reactivar / eliminar =====
const modalConfirm = new bootstrap.Modal('#modalConfirm');

function abrirConfirm(accion, cliente_id, cuenta = '') {
  $('#confirmAccion').value = accion;
  $('#confirmId').value = cliente_id;

  let titulo = 'Confirmar';
  let msg = '¿Seguro que deseas continuar?';
  if (accion === 'desactivar') { titulo = 'Desactivar cliente'; msg = `¿Desactivar a "${cuenta}" (${cliente_id})?`; }
  if (accion === 'reactivar')  { titulo = 'Reactivar cliente';  msg = `¿Reactivar a "${cuenta}" (${cliente_id})?`; }
  if (accion === 'eliminar')   { titulo = 'Eliminar cliente';   msg = `¿Eliminar definitivamente a "${cuenta}" (${cliente_id})? Esta acción no se puede deshacer.`; }

  $('#confirmTitulo').textContent = titulo;
  $('#confirmMsg').textContent = msg;
  modalConfirm.show();
}

$('#btnConfirmarAccion').addEventListener('click', async () => {
  const accion = $('#confirmAccion').value;
  const id = $('#confirmId').value;
  try {
    if (accion === 'desactivar') await clientsAPI.softDelete(id);
    else if (accion === 'reactivar') await clientsAPI.reactivate(id);
    else if (accion === 'eliminar') await clientsAPI.remove(id);

    modalConfirm.hide();
    showAlert('success', 'Operación realizada.');
    recargarClientes('search');
  } catch (err) {
    modalConfirm.hide();
    showAlert('danger', err.message || 'No fue posible completar la acción');
  }
});

// ===== Boot =====
(async function boot() {
  try {
    initTabla();
    // primera carga: vacía o mostrando activos (según backend, search '' lista todo)
    await recargarClientes('search');
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
