// scripts/forms/empleados.js
// UI de administración para Empleados (DataTable + crear/editar + soft/reactivar/hard + registrar_login)
// Requiere: empleadosAPI

import { empleadosAPI } from '/admin-resources/scripts/apis/empleadosManager.js';

const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function showAlert(kind, html){
  const box = $('#alertBox');
  box.classList.remove('d-none','alert-success','alert-danger','alert-info','alert-warning');
  box.classList.add(`alert-${kind}`);
  box.innerHTML = html;
  setTimeout(()=>box.classList.add('d-none'), 4000);
}

function unpack(res){
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

let tabla, modalCrear, modalEditar, modalConfirm;
let accionConfirm = null; // { type:'soft'|'reactivar'|'hard'|'login', id }

const COL_INDEX = {
  empleado_id:0, cuenta:1, email:2, puesto:3, estado:4, ultimo_login:5, fecha_registro:6
};

function badgeEstado(row){
  const activo = (row.estado === 1) || (String(row.estado_descripcion||'').toLowerCase().includes('activo'));
  return `<span class="badge ${activo? 'bg-success' : 'bg-secondary'}">${activo? 'Activo':'Inactivo'}</span>`;
}

function configurarTabla(){
  if (tabla){ tabla.destroy(); $('#tablaEmpleados tbody').innerHTML=''; }
  tabla = new DataTable('#tablaEmpleados', {
    paging:true,
    pageLength:10,
    lengthChange:false,
    ordering:true,
    order:[[COL_INDEX.cuenta,'asc']],
    searching:true,
    language:{ url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columns:[
      { data:'empleado_id' },
      { data:'cuenta' },
      { data:'email' },
      { data:'puesto', defaultContent:'' },
      { data:null, render:(_v,_t,row)=>badgeEstado(row) },
      { data:'ultimo_login', render:v=> v? new Date(v).toLocaleString('es-MX'):'' },
      { data:'fecha_registro', render:v=> v? new Date(v).toLocaleString('es-MX'):'' },
      { data:null, orderable:false, searchable:false, className:'text-end', render:(_v,_t,row)=>{
          const activo = (row.estado === 1) || (String(row.estado_descripcion||'').toLowerCase().includes('activo'));
          const softBtn = activo
            ? `<button class="btn btn-sm btn-outline-warning me-1" data-action="soft" data-id="${row.empleado_id}"><i class="bi bi-slash-circle"></i> Desactivar</button>`
            : `<button class="btn btn-sm btn-outline-success me-1" data-action="reactivar" data-id="${row.empleado_id}"><i class="bi bi-arrow-counterclockwise"></i> Reactivar</button>`;
          return `
            <button class="btn btn-sm btn-primary me-1" data-action="edit" data-id="${row.empleado_id}"><i class="bi bi-pencil-square"></i> Editar</button>
            ${softBtn}
            <button class="btn btn-sm btn-outline-dark me-1" data-action="login" data-id="${row.empleado_id}"><i class="bi bi-clock-history"></i> Registrar login</button>
            <button class="btn btn-sm btn-outline-danger" data-action="hard" data-id="${row.empleado_id}"><i class="bi bi-trash"></i> Eliminar</button>`;
        }}
    ]
  });

  $('#tablaEmpleados tbody').addEventListener('click', onRowAction);
}

function onRowAction(ev){
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.getAttribute('data-id'));
  const action = btn.getAttribute('data-action');
  if (action==='edit') return abrirEditar(id);
  if (action==='soft') return prepararConfirm('soft', id);
  if (action==='reactivar') return prepararConfirm('reactivar', id);
  if (action==='hard') return prepararConfirm('hard', id);
  if (action==='login') return prepararConfirm('login', id);
}

async function cargarTodos(){
  try{
    const rows = unpack(await empleadosAPI.getAll());
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('success','Empleados cargados');
  }catch(err){
    console.error('cargarTodos',err);
    showAlert('danger', `Error al listar: ${err.message}`);
  }
}

async function buscar(){
  const term = $('#filtroTerm').value.trim();
  const solo_activos = $('#soloActivos').checked ? 1 : 0;
  if (!term){ return cargarTodos(); }
  try{
    const ids = unpack(await empleadosAPI.search({ term, solo_activos }))
      .map(r => r.empleado_id).filter(Boolean);
    if (!ids.length){ tabla.clear().draw(); return showAlert('info','Sin resultados'); }
    const results = await Promise.all(ids.map(id => empleadosAPI.getOne(id).then(r => r?.data)));
    const rows = results.filter(Boolean);
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('info', `Resultados para "${term}" (${rows.length})`);
  }catch(err){
    console.error('buscar',err);
    showAlert('danger', `Error en búsqueda: ${err.message}`);
  }
}

function ordenarTabla(){
  const v = $('#ordenarPor').value;
  const idx = COL_INDEX[v] ?? COL_INDEX.cuenta;
  const dir = (v==='fecha_registro' || v==='ultimo_login') ? 'desc' : (v==='estado' ? 'desc' : 'asc');
  tabla.order([idx, dir]).draw();
}

function limpiar(){
  $('#filtroTerm').value='';
  $('#soloActivos').checked=true;
  $('#ordenarPor').value='cuenta';
  cargarTodos();
}

function validarCrear(){
  const cta = $('#c_cuenta').value.trim();
  const em  = $('#c_email').value.trim();
  const pw  = $('#c_contrasena').value.trim();
  if (!cta || cta.length>20) return false;
  if (!em || em.length>150 || !em.includes('@')) return false;
  if (!pw || pw.length<8) return false;
  return true;
}

async function crear(ev){
  ev.preventDefault();
  if (!validarCrear()) { $('#formCrear').classList.add('was-validated'); return; }
  const cuenta = $('#c_cuenta').value.trim();
  const email  = $('#c_email').value.trim();
  const contrasena = $('#c_contrasena').value.trim();
  try{
    await empleadosAPI.insert({ cuenta, email, contrasena });
    showAlert('success','Empleado creado correctamente');
    modalCrear.hide();
    await cargarTodos();
  }catch(err){
    console.error('crear',err);
    showAlert('danger', `No se pudo crear: ${err.message}`);
  }
}

function validarEditar(){
  const cta = $('#e_cuenta').value.trim();
  const em  = $('#e_email').value.trim();
  if (!cta || cta.length>20) return false;
  if (!em || em.length>150 || !em.includes('@')) return false;
  return true;
}

async function abrirEditar(id){
  try{
    const row = (await empleadosAPI.getOne(id))?.data || null;
    if (!row) throw new Error('No encontrado');
    $('#e_empleado_id').value = row.empleado_id;
    $('#e_cuenta').value = row.cuenta;
    $('#e_email').value = row.email;
    $('#e_puesto').value = row.puesto || '';
    $('#formEditar').classList.remove('was-validated');
    modalEditar.show();
  }catch(err){
    console.error('abrirEditar',err);
    showAlert('danger', `No se pudo cargar: ${err.message}`);
  }
}

async function guardar(ev){
  ev.preventDefault();
  if (!validarEditar()) { $('#formEditar').classList.add('was-validated'); return; }
  const payload = {
    empleado_id: Number($('#e_empleado_id').value),
    cuenta: $('#e_cuenta').value.trim(),
    email:  $('#e_email').value.trim(),
    puesto: $('#e_puesto').value.trim() || 'Administrador'
  };
  try{
    await empleadosAPI.update(payload);
    showAlert('success','Actualizado correctamente');
    modalEditar.hide();
    const term = $('#filtroTerm').value.trim();
    if (term) await buscar(); else await cargarTodos();
  }catch(err){
    console.error('guardar',err);
    showAlert('danger', `No se pudo actualizar: ${err.message}`);
  }
}

function prepararConfirm(type, id){
  accionConfirm = { type, id };
  const msg = type==='soft' ? `¿Desactivar empleado #<strong>${id}</strong>?` :
              type==='reactivar' ? `¿Reactivar empleado #<strong>${id}</strong>?` :
              type==='hard' ? `¿Eliminar definitivamente al empleado #<strong>${id}</strong>?` :
              `¿Registrar último acceso para #<strong>${id}</strong>?`;
  $('#confirmMsg').innerHTML = msg;
  modalConfirm.show();
}

async function ejecutarConfirm(){
  if (!accionConfirm) return;
  const { type, id } = accionConfirm;
  try{
    if (type==='soft') await empleadosAPI.softDelete(id);
    else if (type==='reactivar') await empleadosAPI.reactivate(id);
    else if (type==='hard') await empleadosAPI.remove(id);
    else if (type==='login') await empleadosAPI.registrarLogin(id);

    modalConfirm.hide();
    accionConfirm = null;
    const term = $('#filtroTerm').value.trim();
    if (term) await buscar(); else await cargarTodos();
    showAlert('success','Acción ejecutada');
  }catch(err){
    console.error('ejecutarConfirm',err);
    showAlert('danger', `Acción fallida: ${err.message}`);
  }
}

async function init(){
  modalCrear   = new bootstrap.Modal('#modalCrear');
  modalEditar  = new bootstrap.Modal('#modalEditar');
  modalConfirm = new bootstrap.Modal('#modalConfirm');

  configurarTabla();
  await cargarTodos();

  // Filtros/acciones
  $('#btnBuscar').addEventListener('click', buscar);
  $('#soloActivos').addEventListener('change', buscar);
  $('#ordenarPor').addEventListener('change', ordenarTabla);
  $('#btnLimpiar').addEventListener('click', limpiar);
  $('#btnNuevo').addEventListener('click', ()=>{ $('#formCrear').reset(); $('#formCrear').classList.remove('was-validated'); modalCrear.show(); });
  $('#btnConfirmarAccion').addEventListener('click', ejecutarConfirm);

  // Formularios
  $('#formCrear').addEventListener('submit', crear);
  $('#formEditar').addEventListener('submit', guardar);
}

window.addEventListener('DOMContentLoaded', init);