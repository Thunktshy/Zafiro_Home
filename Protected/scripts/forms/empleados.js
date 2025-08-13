import { empleadosAPI } from '/admin-resources/scripts/apis/empleadosManager.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const alertBox = $('#alertBox');
function showAlert(type, msg, hideMs = 4200) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.add('show');
  if (hideMs) setTimeout(() => alertBox.classList.remove('show'), hideMs);
}

const DT_I18N = 'https://cdn.datatables.net/plug-ins/2.0.3/i18n/es-ES.json';
let dt;

function fmtEstado(v){ return Number(v) === 1 ? 'activo' : 'inactivo'; }
function fmtFecha(s){
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d) ? String(s) : d.toLocaleString('es-MX');
}

function renderActions(row) {
  const id = row.empleado_id;
  const activo = Number(row.estado) === 1;
  return `
    <div class="btn-group btn-group-sm" role="group">
      <button class="btn btn-outline-primary btn-editar" data-id="${id}" title="Editar">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="btn btn-outline-${activo ? 'warning' : 'success'} btn-toggle" data-id="${id}" title="${activo?'Desactivar':'Reactivar'}">
        <i class="fa-solid fa-${activo?'user-slash':'user-check'}"></i>
      </button>
      <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" title="Eliminar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`;
}

// ================== CARGA / BUSQUEDA ==================
async function buscarYRender() {
  const term = $('#txtBuscar').value.trim();
  const soloActivos = $('#chkSoloActivos').checked ? 1 : 0;
  try {
    const res = await empleadosAPI.search(term, soloActivos);
    const rows = Array.isArray(res?.data) ? res.data : [];
    if (!dt) {
      dt = new DataTable('#tabla-empleados', {
        data: rows,
        columns: [
          { data: 'empleado_id' },
          { data: 'cuenta' },
          { data: 'email' },
          { data: 'puesto' },
          { data: 'estado', render: fmtEstado },
          { data: 'fecha_registro', render: fmtFecha },
          { data: 'ultimo_login',   render: fmtFecha },
          { data: null, orderable: false, searchable: false, render: renderActions }
        ],
        order: [[1,'asc']],
        language: { url: DT_I18N }
      });
      $('#tabla-empleados tbody').addEventListener('click', onTablaClick);
    } else {
      dt.clear(); dt.rows.add(rows).draw();
    }
    showAlert('success', `Se encontraron ${rows.length} empleado(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'Error al buscar empleados');
  }
}

$('#btnBuscar').addEventListener('click', buscarYRender);
$('#txtBuscar').addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarYRender(); });
$('#chkSoloActivos').addEventListener('change', buscarYRender);

// ================== NUEVO / EDITAR ==================
const modalEmpleado = new bootstrap.Modal('#modalEmpleado');
const modalConfirm  = new bootstrap.Modal('#modalConfirm');

function limpiarForm() {
  $('#empleado_id').value = '';
  $('#cuenta').value = '';
  $('#email').value = '';
  $('#contrasena').value = '';
  $('#puesto').value = '';
  $$('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  ['errCuenta','errEmail','errPass','errPuesto'].forEach(id => $('#'+id).textContent='');
}

function validarForm(esNuevo) {
  let ok = true;
  const cuenta = $('#cuenta').value.trim();
  const email  = $('#email').value.trim();
  const pass   = $('#contrasena').value;
  const puesto = $('#puesto').value;

  const reCuenta = /^[\p{L}\p{N}_\-\.]{3,20}$/u;
  const reEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const setErr = (id, msg) => { $('#'+id).textContent = msg; const ctl = $('#'+id.replace('err','')); ctl?.classList.add('is-invalid'); ok = false; };
  $$('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  ['errCuenta','errEmail','errPass','errPuesto'].forEach(id => $('#'+id).textContent='');

  if (!reCuenta.test(cuenta)) setErr('errCuenta', 'Cuenta 3–20, sin espacios.');
  if (!reEmail.test(email))  setErr('errEmail',  'Email inválido.');
  if (!puesto)               setErr('errPuesto', 'Seleccione un puesto.');
  if (esNuevo) {
    if (!pass || pass.length < 6) setErr('errPass', 'Mínimo 6 caracteres.');
  }
  return ok;
}

function abrirNuevo() {
  limpiarForm();
  $('#modalEmpleadoTitulo').textContent = 'Nuevo empleado';
  $('#btnGuardar').textContent = 'Crear';
  $('#grpPass').classList.remove('d-none'); // insert requiere contraseña
  modalEmpleado.show();
  setTimeout(() => $('#cuenta')?.focus(), 200);
}

async function abrirEditar(id) {
  limpiarForm();
  $('#modalEmpleadoTitulo').textContent = 'Editar empleado';
  $('#btnGuardar').textContent = 'Actualizar';
  $('#grpPass').classList.add('d-none'); // en update NO se cambia contraseña

  try {
    // /por_id devuelve datos visibles (no contraseña)
    const r = await empleadosAPI.getById(id);
    const row = r?.data || r;
    $('#empleado_id').value = row.empleado_id || id;
    $('#cuenta').value      = row.cuenta || '';
    $('#email').value       = row.email || '';
    $('#puesto').value      = row.puesto || '';
    modalEmpleado.show();
    setTimeout(() => $('#cuenta')?.focus(), 200);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudo obtener el empleado');
  }
}

$('#btnNuevo').addEventListener('click', abrirNuevo);

$('#formEmpleado').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const esNuevo = !$('#empleado_id').value;

  if (!validarForm(esNuevo)) return;

  try {
    if (esNuevo) {
      const res = await empleadosAPI.insert({
        cuenta: $('#cuenta').value.trim(),
        email: $('#email').value.trim(),
        contrasena: $('#contrasena').value,
        puesto: $('#puesto').value
      });
      modalEmpleado.hide();
      showAlert('success', res?.message || 'Empleado creado');
    } else {
      const res = await empleadosAPI.update({
        empleado_id: Number($('#empleado_id').value),
        cuenta: $('#cuenta').value.trim(),
        email: $('#email').value.trim(),
        puesto: $('#puesto').value
      });
      modalEmpleado.hide();
      showAlert('success', res?.message || 'Empleado actualizado');
    }
    await buscarYRender();
  } catch (err) {
    if (err.status === 400) {
      showAlert('warning', err.message || 'Validación rechazada por el servidor.');
    } else if (err?.data?.errors) {
      showAlert('warning', 'Errores de validación.');
    } else {
      showAlert('danger', err.message || 'Error al guardar');
    }
  }
});

// ================== ACCIONES: desactivar / reactivar / eliminar ==================
function confirmarAccion(id, accion, msg) {
  $('#confirmId').value = id;
  $('#confirmAction').value = accion;
  $('#confirmTitle').textContent = accion === 'soft' ? 'Desactivar empleado' :
                                   accion === 'react' ? 'Reactivar empleado' :
                                   'Eliminar empleado';
  $('#confirmMsg').textContent = msg;
  modalConfirm.show();
}

async function ejecutarConfirmacion() {
  const id = Number($('#confirmId').value);
  const accion = $('#confirmAction').value;
  try {
    let res;
    if (accion === 'soft')      res = await empleadosAPI.softDelete(id);
    else if (accion === 'react')res = await empleadosAPI.reactivate(id);
    else if (accion === 'hard') res = await empleadosAPI.remove(id);

    modalConfirm.hide();
    showAlert('success', res?.message || 'Acción completada');
    await buscarYRender();
  } catch (err) {
    showAlert('danger', err.message || 'No se pudo completar la acción');
  }
}
$('#btnConfirmar').addEventListener('click', ejecutarConfirmacion);

function onTablaClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.classList.contains('btn-editar')) {
    abrirEditar(id);
  } else if (btn.classList.contains('btn-toggle')) {
    const row = dt.row(btn.closest('tr')).data();
    const activo = Number(row?.estado) === 1;
    confirmarAccion(id, activo ? 'soft' : 'react',
      activo ? `¿Desactivar al empleado ${row?.cuenta || id}?` :
               `¿Reactivar al empleado ${row?.cuenta || id}?`);
  } else if (btn.classList.contains('btn-eliminar')) {
    confirmarAccion(id, 'hard', `¿Eliminar definitivamente al empleado ${id}? Esta acción no se puede deshacer.`);
  }
}

// Arranque
buscarYRender();
