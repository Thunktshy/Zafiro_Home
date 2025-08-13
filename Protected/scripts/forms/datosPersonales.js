// scripts/forms/datos_personales.js
// UI de administración para Datos Personales (DataTable + crear/editar/eliminar)
// Requiere: datosPersonalesAPI

import { datosPersonalesAPI } from '/admin-resources/scripts/apis/datosPersonalesManager.js';

const $ = (sel, ctx=document) => ctx.querySelector(sel);

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
let accionConfirm = null; // { type:'delete', datos_id, cliente_id }

const COL_INDEX = { datos_id:0, cliente_id:1, nombre:2, apellidos:3, telefono:4, direccion:5, ciudad:6, codigo_postal:7, pais:8 };

function configurarTabla(){
  if (tabla){ tabla.destroy(); $('#tablaDP tbody').innerHTML=''; }
  tabla = new DataTable('#tablaDP', {
    paging:true,
    pageLength:10,
    lengthChange:false,
    ordering:true,
    order:[[COL_INDEX.cliente_id,'asc']],
    searching:true,
    language:{ url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columns:[
      { data:'datos_id' },
      { data:'cliente_id' },
      { data:'nombre' },
      { data:'apellidos' },
      { data:'telefono', defaultContent:'' },
      { data:'direccion', defaultContent:'' },
      { data:'ciudad', defaultContent:'' },
      { data:'codigo_postal', defaultContent:'' },
      { data:'pais', defaultContent:'' },
      { data:null, orderable:false, searchable:false, className:'text-end', render:(_v,_t,row)=>
        `<button class="btn btn-sm btn-primary me-1" data-action="edit" data-id="${row.datos_id}"><i class="bi bi-pencil-square"></i> Editar</button>
         <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${row.datos_id}"><i class="bi bi-trash"></i> Eliminar</button>`
      }
    ]
  });

  $('#tablaDP tbody').addEventListener('click', onRowAction);
}

function onRowAction(ev){
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.getAttribute('data-id'));
  const action = btn.getAttribute('data-action');
  if (action==='edit') return abrirEditar(id);
  if (action==='del')  return prepararConfirm('delete', id);
}

async function cargarTodos(){
  try{
    const rows = unpack(await datosPersonalesAPI.getAll());
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('success','Registros cargados');
  }catch(err){
    console.error('cargarTodos',err);
    showAlert('danger', `Error al listar: ${err.message}`);
  }
}

async function cargarPorCliente(){
  const id = $('#filtroCliente').value.trim();
  if (!id) return showAlert('warning','Proporciona un ID de cliente');
  try{
    const rows = unpack(await datosPersonalesAPI.getByCliente(id));
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('info', rows.length ? `Registro para <strong>${id}</strong>` : `Sin registro para <strong>${id}</strong>`);
  }catch(err){
    console.error('cargarPorCliente',err);
    showAlert('danger', `Error al consultar: ${err.message}`);
  }
}

function ordenarTabla(){
  const v = $('#ordenarPor').value;
  const idx = COL_INDEX[v] ?? COL_INDEX.cliente_id;
  const dir = (v==='cliente_id') ? 'asc' : 'asc';
  tabla.order([idx, dir]).draw();
}

function limpiar(){
  $('#filtroCliente').value='';
  $('#ordenarPor').value='cliente_id';
  tabla.clear().draw();
}

// Validaciones básicas (alineadas con longitudes de la BD)
function validarCrear(){
  const c = $('#c_cliente_id').value.trim();
  const n = $('#c_nombre').value.trim();
  const a = $('#c_apellidos').value.trim();
  const tel = $('#c_telefono').value.trim();
  const cp  = $('#c_cp').value.trim();
  if (!c) return false;
  if (!n || n.length>50) return false;
  if (!a || a.length>100) return false;
  if (tel && tel.length>20) return false;
  if (cp && cp.length>10) return false; // (MX: 5 dígitos; se admite genérico ≤10)
  return true;
}

async function crear(ev){
  ev.preventDefault();
  if (!validarCrear()){ $('#formCrear').classList.add('was-validated'); return; }
  const payload = {
    cliente_id:    $('#c_cliente_id').value.trim(),
    nombre:        $('#c_nombre').value.trim(),
    apellidos:     $('#c_apellidos').value.trim(),
    telefono:      $('#c_telefono').value.trim() || null,
    direccion:     $('#c_direccion').value.trim() || null,
    ciudad:        $('#c_ciudad').value.trim() || null,
    codigo_postal: $('#c_cp').value.trim() || null,
    pais:          $('#c_pais').value.trim() || null
  };
  try{
    await datosPersonalesAPI.insert(payload);
    showAlert('success','Datos personales creados');
    modalCrear.hide();
    $('#filtroCliente').value = payload.cliente_id;
    await cargarPorCliente();
  }catch(err){
    console.error('crear',err);
    showAlert('danger', `No se pudo crear: ${err.message}`);
  }
}

function validarEditar(){
  const n = $('#e_nombre').value.trim();
  const a = $('#e_apellidos').value.trim();
  const tel = $('#e_telefono').value.trim();
  const cp  = $('#e_cp').value.trim();
  if (!n || n.length>50) return false;
  if (!a || a.length>100) return false;
  if (tel && tel.length>20) return false;
  if (cp && cp.length>10) return false;
  return true;
}

async function abrirEditar(datos_id){
  try{
    const row = (await datosPersonalesAPI.getById(datos_id))?.data || null;
    if (!row) throw new Error('No encontrado');
    $('#e_datos_id').value = row.datos_id;
    $('#e_cliente_id').value = row.cliente_id;
    $('#e_nombre').value = row.nombre || '';
    $('#e_apellidos').value = row.apellidos || '';
    $('#e_telefono').value = row.telefono || '';
    $('#e_direccion').value = row.direccion || '';
    $('#e_ciudad').value = row.ciudad || '';
    $('#e_cp').value = row.codigo_postal || '';
    $('#e_pais').value = row.pais || '';
    $('#formEditar').classList.remove('was-validated');
    modalEditar.show();
  }catch(err){
    console.error('abrirEditar',err);
    showAlert('danger', `No se pudo cargar: ${err.message}`);
  }
}

async function guardar(ev){
  ev.preventDefault();
  if (!validarEditar()){ $('#formEditar').classList.add('was-validated'); return; }
  const payload = {
    cliente_id:    $('#e_cliente_id').value.trim(), // requerido por /update
    nombre:        $('#e_nombre').value.trim(),
    apellidos:     $('#e_apellidos').value.trim(),
    telefono:      $('#e_telefono').value.trim() || null,
    direccion:     $('#e_direccion').value.trim() || null,
    ciudad:        $('#e_ciudad').value.trim() || null,
    codigo_postal: $('#e_cp').value.trim() || null,
    pais:          $('#e_pais').value.trim() || null
  };
  try{
    await datosPersonalesAPI.update(payload);
    showAlert('success','Actualizado correctamente');
    modalEditar.hide();
    const cli = $('#filtroCliente').value.trim();
    if (cli) await cargarPorCliente(); else await cargarTodos();
  }catch(err){
    console.error('guardar',err);
    showAlert('danger', `No se pudo actualizar: ${err.message}`);
  }
}

function prepararConfirm(type, datos_id){
  accionConfirm = { type, datos_id };
  $('#confirmMsg').innerHTML = `¿Eliminar el registro #<strong>${datos_id}</strong>?`;
  modalConfirm.show();
}

async function ejecutarConfirm(){
  if (!accionConfirm) return;
  const { datos_id } = accionConfirm;
  try{
    // Necesitamos cliente_id para /delete
    const row = (await datosPersonalesAPI.getById(datos_id))?.data;
    if (!row) throw new Error('Registro no encontrado');
    await datosPersonalesAPI.remove(row.cliente_id);
    showAlert('success','Eliminado correctamente');
    modalConfirm.hide();
    const cli = $('#filtroCliente').value.trim();
    if (cli) await cargarPorCliente(); else await cargarTodos();
  }catch(err){
    console.error('ejecutarConfirm',err);
    showAlert('danger', `Acción fallida: ${err.message}`);
  }finally{
    accionConfirm = null;
  }
}

async function init(){
  modalCrear  = new bootstrap.Modal('#modalCrear');
  modalEditar = new bootstrap.Modal('#modalEditar');
  modalConfirm= new bootstrap.Modal('#modalConfirm');

  configurarTabla();
  // Por seguridad, este módulo arranca vacío; listamos todo sólo a petición

  // Filtros/acciones
  $('#btnBuscarCliente').addEventListener('click', cargarPorCliente);
  $('#ordenarPor').addEventListener('change', ordenarTabla);
  $('#btnLimpiar').addEventListener('click', limpiar);
  $('#btnListarTodos').addEventListener('click', cargarTodos);
  $('#btnNuevo').addEventListener('click', ()=>{ $('#formCrear').reset(); $('#formCrear').classList.remove('was-validated'); modalCrear.show(); });
  $('#btnConfirmarAccion').addEventListener('click', ejecutarConfirm);

  // Formularios
  $('#formCrear').addEventListener('submit', crear);
  $('#formEditar').addEventListener('submit', guardar);
}

window.addEventListener('DOMContentLoaded', init);