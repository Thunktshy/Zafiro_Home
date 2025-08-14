// UI del Panel de Empleados
import { empleadosAPI } from '/admin-resources/scripts/apis/empleadosManager.js';

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
  dt = $('#tablaEmpleados').DataTable({
    data: [],
    columns: [
      { data: 'empleado_id', render: v => v ?? '—' },
      { data: 'cuenta', render: v => v ?? '—' },
      { data: 'email', render: v => v ?? '—' },
      { data: 'puesto', render: v => v ?? '—' },
      { data: 'estado', render: v => (v == null ? '—' : (Number(v) ? 'activo' : 'inactivo')) },
      { data: 'ultimo_acceso', render: v => fmtDate(v) },
      { data: 'fecha_creacion', render: v => fmtDate(v) },
      {
        data: null, orderable: false, searchable: false, className: 'text-end',
        render: (row) => {
          const id = row.empleado_id;
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
    order: [[6, 'desc']], // por fecha_creacion
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  // Delegación de eventos
  $('#tablaEmpleados tbody').addEventListener('click', (ev) => {
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
async function recargarEmpleados(origen='search') {
  try {
    let rows = [];
    if (origen === 'byId') {
      const id = $('#filtroId').value.trim();
      if (!id) return showAlert('warning', 'Indica un ID.');
      const out = await empleadosAPI.getOne(Number(id));
      const r = out?.data ?? out;
      rows = r ? [r] : [];
    } else if (origen === 'all') {
      const out = await empleadosAPI.getAll();
      rows = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
    } else {
      const term = $('#filtroTerm').value.trim();
      const solo_activos = $('#soloActivos').checked ? 1 : 0;
      const out = await empleadosAPI.search({ term, solo_activos });
      rows = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
    }

    dt.clear().rows.add(rows).draw();
    showAlert('success', `Se cargaron ${rows.length} empleado(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron cargar los empleados');
  }
}

// ===== Filtros =====
$('#btnBuscar').addEventListener('click', () => recargarEmpleados('search'));
$('#btnBuscarId').addEventListener('click', () => recargarEmpleados('byId'));
$('#btnListarTodo').addEventListener('click', () => recargarEmpleados('all'));
$('#btnLimpiar').addEventListener('click', () => {
  $('#filtroTerm').value = '';
  $('#filtroId').value = '';
  $('#soloActivos').checked = true;
  recargarEmpleados('search');
});

// ===== Modal Crear/Editar =====
const modalEmp = new bootstrap.Modal('#modalEmpleado');

function limpiarForm() {
  $('#empleado_id').value = '';
  $('#cuenta').value = '';
  $('#email').value = '';
  $('#contrasena').value = '';
  $('#puesto').value = 'Administrador';
  $$('#formEmpleado .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

$('#btnNuevo').addEventListener('click', () => {
  limpiarForm();
  $('#modalEmpleadoTitulo').textContent = 'Nuevo empleado';
  $('#grupoContrasena').classList.remove('d-none'); // en alta se pide contraseña
  $('#contrasena').required = true;
  $('#btnGuardar').textContent = 'Guardar';
  modalEmp.show();
  setTimeout(() => $('#cuenta')?.focus(), 200);
});

async function abrirModalEditar(empleado_id) {
  limpiarForm();
  $('#modalEmpleadoTitulo').textContent = 'Editar empleado';
  $('#btnGuardar').textContent = 'Actualizar';
  $('#grupoContrasena').classList.add('d-none'); // no se cambia aquí
  $('#contrasena').required = false;

  try {
    // toma de la tabla o de la API
    const tableRow = dt.rows().data().toArray().find(r => String(r.empleado_id) === String(empleado_id));
    const row = tableRow ?? (await empleadosAPI.getOne(Number(empleado_id)))?.data;
    if (!row) throw new Error('No se pudo cargar el empleado');

    $('#empleado_id').value = row.empleado_id || '';
    $('#cuenta').value = row.cuenta || '';
    $('#email').value = row.email || '';
    $('#puesto').value = row.puesto || 'Administrador';

    modalEmp.show();
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
  const puesto = $('#puesto');
  [cuenta, email, pass, puesto].forEach(el => el.classList.remove('is-invalid'));

  if (!cuenta.value.trim() || cuenta.value.trim().length > 20) { cuenta.classList.add('is-invalid'); ok = false; }
  const emailVal = email.value.trim();
  if (!emailVal || emailVal.length > 150 || !/\S+@\S+\.\S+/.test(emailVal)) { email.classList.add('is-invalid'); ok = false; }
  if (esAlta && !pass.value.trim()) { pass.classList.add('is-invalid'); ok = false; }
  if (!puesto.value.trim()) { puesto.classList.add('is-invalid'); ok = false; }

  return ok;
}

$('#formEmpleado').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const esAlta = !$('#empleado_id').value.trim();
  if (!validarForm(esAlta)) return;

  try {
    if (esAlta) {
      await empleadosAPI.insert({
        cuenta: $('#cuenta').value.trim(),
        email: $('#email').value.trim(),
        contrasena: $('#contrasena').value.trim()
      });
      showAlert('success', 'Empleado creado correctamente.');
    } else {
      await empleadosAPI.update({
        empleado_id: Number($('#empleado_id').value.trim()),
        cuenta: $('#cuenta').value.trim(),
        email: $('#email').value.trim(),
        puesto: $('#puesto').value.trim()
      });
      showAlert('success', 'Empleado actualizado.');
    }
    modalEmp.hide();
    recargarEmpleados('search');
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible guardar');
  }
});

// ===== Confirmaciones: desactivar / reactivar / eliminar =====
const modalConfirm = new bootstrap.Modal('#modalConfirm');

function abrirConfirm(accion, empleado_id, cuenta = '') {
  $('#confirmAccion').value = accion;
  $('#confirmId').value = String(empleado_id);

  let titulo = 'Confirmar';
  let msg = '¿Seguro que deseas continuar?';
  if (accion === 'desactivar') { titulo = 'Desactivar empleado'; msg = `¿Desactivar a "${cuenta}" (ID ${empleado_id})?`; }
  if (accion === 'reactivar')  { titulo = 'Reactivar empleado';  msg = `¿Reactivar a "${cuenta}" (ID ${empleado_id})?`; }
  if (accion === 'eliminar')   { titulo = 'Eliminar empleado';   msg = `¿Eliminar definitivamente a "${cuenta}" (ID ${empleado_id})? Esta acción no se puede deshacer.`; }

  $('#confirmTitulo').textContent = titulo;
  $('#confirmMsg').textContent = msg;
  modalConfirm.show();
}

$('#btnConfirmarAccion').addEventListener('click', async () => {
  const accion = $('#confirmAccion').value;
  const id = Number($('#confirmId').value);
  try {
    if (accion === 'desactivar') await empleadosAPI.softDelete(id);
    else if (accion === 'reactivar') await empleadosAPI.reactivate(id);
    else if (accion === 'eliminar') await empleadosAPI.remove(id);

    modalConfirm.hide();
    showAlert('success', 'Operación realizada.');
    recargarEmpleados('search');
  } catch (err) {
    modalConfirm.hide();
    showAlert('danger', err.message || 'No fue posible completar la acción');
  }
});

// ===== Boot =====
(async function boot() {
  try {
    initTabla();
    // primera carga: activos por defecto (search con term vacío + solo_activos=1)
    await recargarEmpleados('search');
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
