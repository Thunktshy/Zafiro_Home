// scripts/forms/datos_facturacion.js
// UI de administración para Datos de Facturación (DataTable + crear/editar/eliminar)
// Requiere: datosFacturacionAPI

import { datosFacturacionAPI } from '/admin-resources/scripts/apis/datosFacturacionManager.js';

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

// RFC MX: moral (3 letras) o física (4 letras) + YYMMDD + 3 alfanum
const RFC_MORAL  = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/i;
const RFC_FISICA = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/i;
function normalizaRFC(rfc){
  return String(rfc||'').toUpperCase().replace(/\s|-/g,'');
}
function isRFC(val){
  const v = normalizaRFC(val);
  return RFC_MORAL.test(v) || RFC_FISICA.test(v);
}

let tabla, modalCrear, modalEditar, modalConfirm;
let accionConfirm = null; // { type:'delete', id }

const COL_INDEX = { datos_facturacion_id:0, cliente_id:1, rfc:2, razon_social:3, direccion_fiscal:4 };

function configurarTabla(){
  if (tabla){ tabla.destroy(); $('#tablaDF tbody').innerHTML=''; }
  tabla = new DataTable('#tablaDF', {
    paging:true,
    pageLength:10,
    lengthChange:false,
    ordering:true,
    order:[[COL_INDEX.cliente_id,'asc']],
    searching:true,
    language:{ url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columns:[
      { data:'datos_facturacion_id' },
      { data:'cliente_id' },
      { data:'rfc' },
      { data:'razon_social' },
      { data:'direccion_fiscal', defaultContent:'' },
      { data:null, orderable:false, searchable:false, className:'text-end', render:(_v,_t,row)=>
        `<button class="btn btn-sm btn-primary me-1" data-action="edit" data-id="${row.datos_facturacion_id}"><i class="bi bi-pencil-square"></i> Editar</button>
         <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${row.datos_facturacion_id}"><i class="bi bi-trash"></i> Eliminar</button>`
      }
    ]
  });

  $('#tablaDF tbody').addEventListener('click', onRowAction);
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
    const rows = unpack(await datosFacturacionAPI.getAll());
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
    const rows = unpack(await datosFacturacionAPI.getByCliente(id));
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('info', rows.length ? `Registro para <strong>${id}</strong>` : `Sin datos de facturación para <strong>${id}</strong>`);
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

// Validaciones (alineadas con reglas del backend)
function validarCrear(){
  const cli = $('#c_cliente_id').value.trim();
  const rfc = $('#c_rfc').value.trim();
  const rz  = $('#c_razon').value.trim();
  const dir = $('#c_direccion').value.trim();
  if (!cli) return false;
  if (!rz || rz.length>100) return false;
  if (!isRFC(rfc)) return false;
  if (dir && dir.length>200) return false;
  return true;
}

async function crear(ev){
  ev.preventDefault();
  if (!validarCrear()){ $('#formCrear').classList.add('was-validated'); return; }
  const payload = {
    cliente_id: $('#c_cliente_id').value.trim(),
    rfc: normalizaRFC($('#c_rfc').value),
    razon_social: $('#c_razon').value.trim(),
    direccion_fiscal: $('#c_direccion').value.trim() || null
  };
  try{
    await datosFacturacionAPI.insert(payload);
    showAlert('success','Datos de facturación creados');
    modalCrear.hide();
    $('#filtroCliente').value = payload.cliente_id;
    await cargarPorCliente();
  }catch(err){
    console.error('crear',err);
    showAlert('danger', `No se pudo crear: ${err.message}`);
  }
}

function validarEditar(){
  const rfc = $('#e_rfc').value.trim();
  const rz  = $('#e_razon').value.trim();
  const dir = $('#e_direccion').value.trim();
  if (!isRFC(rfc)) return false;
  if (!rz || rz.length>100) return false;
  if (dir && dir.length>200) return false;
  return true;
}

async function abrirEditar(id){
  try{
    const row = (await datosFacturacionAPI.getById(id))?.data || null;
    if (!row) throw new Error('No encontrado');
    $('#e_id').value = row.datos_facturacion_id;
    $('#e_cliente_id').value = row.cliente_id;
    $('#e_rfc').value = row.rfc || '';
    $('#e_razon').value = row.razon_social || '';
    $('#e_direccion').value = row.direccion_fiscal || '';
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
    cliente_id: $('#e_cliente_id').value.trim(), // requerido por /update
    rfc: normalizaRFC($('#e_rfc').value),
    razon_social: $('#e_razon').value.trim(),
    direccion_fiscal: $('#e_direccion').value.trim() || null
  };
  try{
    await datosFacturacionAPI.update(payload);
    showAlert('success','Actualizado correctamente');
    modalEditar.hide();
    const cli = $('#filtroCliente').value.trim();
    if (cli) await cargarPorCliente(); else await cargarTodos();
  }catch(err){
    console.error('guardar',err);
    showAlert('danger', `No se pudo actualizar: ${err.message}`);
  }
}

function prepararConfirm(type, id){
  accionConfirm = { type, id };
  $('#confirmMsg').innerHTML = `¿Eliminar los datos de facturación del registro #<strong>${id}</strong>?`;
  modalConfirm.show();
}

async function ejecutarConfirm(){
  if (!accionConfirm) return;
  const { id } = accionConfirm;
  try{
    // Necesitamos cliente_id para /delete
    const row = (await datosFacturacionAPI.getById(id))?.data;
    if (!row) throw new Error('Registro no encontrado');
    await datosFacturacionAPI.remove(row.cliente_id);
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
  // Arranca vacío por privacidad; listamos todo sólo a petición (admin)

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