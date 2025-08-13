// scripts/forms/metodos_pago.js
// UI de administración para Métodos de Pago (DataTable + crear/editar/eliminar + principal)
// Requiere: metodosPagoAPI

import { metodosPagoAPI } from '/admin-resources/scripts/apis/metodosPagoManager.js';

const $ = (sel, ctx=document) => ctx.querySelector(sel);
const money = (n) => (Number(n)||0).toLocaleString('es-MX',{ style:'currency', currency:'MXN' });

function badge(bool) {
  return bool ? '<span class="badge bg-success">Sí</span>' : '<span class="badge bg-secondary">No</span>';
}

function showAlert(kind, html) {
  const box = $('#alertBox');
  box.classList.remove('d-none','alert-success','alert-danger','alert-info','alert-warning');
  box.classList.add(`alert-${kind}`);
  box.innerHTML = html;
  setTimeout(() => box.classList.add('d-none'), 4000);
}

function unpack(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

let tabla, modalCrear, modalEditar, modalConfirm;
let accionConfirm = null; // { type:'delete'|'principal', id, row }

const COL_INDEX = { metodo_id:0, cliente_id:1, tipo:2, direccion:3, ciudad:4, cp:5, pais:6, principal:7, fecha:8 };

function configurarTabla() {
  if (tabla) { tabla.destroy(); $('#tablaMP tbody').innerHTML=''; }
  tabla = new DataTable('#tablaMP', {
    paging:true,
    pageLength:10,
    lengthChange:false,
    ordering:true,
    order:[[COL_INDEX.fecha,'desc']],
    searching:true,
    language:{ url:'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columns:[
      { data:'metodo_id' },
      { data:'cliente_id' },
      { data:'tipo' },
      { data:'direccion', defaultContent:'' },
      { data:'ciudad', defaultContent:'' },
      { data:'codigo_postal', defaultContent:'' },
      { data:'pais', defaultContent:'' },
      { data:'es_principal', render:v => badge(!!v) },
      { data:'fecha_creacion', render:v => v? new Date(v).toLocaleString('es-MX'):'' },
      { data:null, orderable:false, searchable:false, className:'text-end', render:(_v,_t,row)=>{
          return `
            <button class="btn btn-sm btn-primary me-1" data-action="edit" data-id="${row.metodo_id}"><i class="bi bi-pencil-square"></i> Editar</button>
            <button class="btn btn-sm btn-outline-dark me-1" data-action="principal" data-id="${row.metodo_id}"><i class="bi bi-pin-angle"></i> Principal</button>
            <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${row.metodo_id}"><i class="bi bi-trash"></i> Eliminar</button>`;
        }
      }
    ]
  });

  $('#tablaMP tbody').addEventListener('click', onTablaAction);
}

function onTablaAction(ev) {
  const btn = ev.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.getAttribute('data-id'));
  const action = btn.getAttribute('data-action');
  if (action==='edit') return abrirEditar(id);
  if (action==='del')  return prepararConfirm('delete', id);
  if (action==='principal') return prepararConfirm('principal', id);
}

async function cargarAll() {
  try {
    const rows = unpack(await metodosPagoAPI.getAll());
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('success','Lista cargada');
  } catch (err) {
    console.error('cargarAll',err);
    showAlert('danger', `Error al listar: ${err.message}`);
  }
}

async function cargarPorCliente() {
  const id = $('#filtroCliente').value.trim();
  if (!id) return showAlert('warning','Proporciona un ID de cliente');
  try {
    let rows = unpack(await metodosPagoAPI.getByCliente(id));
    if ($('#soloPrincipal').checked) rows = rows.filter(r => !!r.es_principal);
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('info', `Métodos de pago del cliente <strong>${id}</strong>`);
  } catch (err) {
    console.error('cargarPorCliente',err);
    showAlert('danger', `Error al consultar por cliente: ${err.message}`);
  }
}

function ordenarTabla(){
  const v = $('#ordenarPor').value;
  const dir = v==='fecha_creacion' ? 'desc' : 'asc';
  const idx = COL_INDEX[v] ?? COL_INDEX.fecha;
  tabla.order([idx,dir]).draw();
}

function limpiar(){
  $('#filtroCliente').value='';
  $('#soloPrincipal').checked=false;
  $('#ordenarPor').value='fecha_creacion';
  tabla.clear().draw();
}

function validarCrear(){
  const c = $('#c_cliente_id').value.trim();
  const t = $('#c_tipo').value.trim();
  if (!c || !t) return false;
  return true;
}

async function crear(ev){
  ev.preventDefault();
  if (!validarCrear()) { $('#formCrear').classList.add('was-validated'); return; }
  const cliente_id = $('#c_cliente_id').value.trim();
  const tipo = $('#c_tipo').value.trim();
  const es_principal = $('#c_es_principal').checked ? 1 : 0;
  try {
    await metodosPagoAPI.insertFromPersonales({ cliente_id, tipo, es_principal });
    showAlert('success','Método de pago creado');
    modalCrear.hide();
    $('#filtroCliente').value = cliente_id;
    await cargarPorCliente();
  } catch (err) {
    console.error('crear',err);
    showAlert('danger', `No se pudo crear: ${err.message}`);
  }
}

async function abrirEditar(id){
  try {
    const row = (await metodosPagoAPI.getOne(id))?.data || null;
    if (!row) throw new Error('No encontrado');
    $('#e_metodo_id').value = row.metodo_id;
    $('#e_tipo').value = row.tipo;
    $('#e_direccion').value = row.direccion || '';
    $('#e_ciudad').value = row.ciudad || '';
    $('#e_cp').value = row.codigo_postal || '';
    $('#e_pais').value = row.pais || '';
    $('#e_es_principal').checked = !!row.es_principal;
    $('#formEditar').classList.remove('was-validated');
    modalEditar.show();
  } catch (err) {
    console.error('abrirEditar',err);
    showAlert('danger', `No se pudo cargar: ${err.message}`);
  }
}

function validarEditar(){
  const t = $('#e_tipo').value.trim();
  if (!t) return false;
  return true;
}

async function guardar(ev){
  ev.preventDefault();
  if (!validarEditar()) { $('#formEditar').classList.add('was-validated'); return; }
  const payload = {
    metodo_id: Number($('#e_metodo_id').value),
    tipo: $('#e_tipo').value.trim(),
    direccion: $('#e_direccion').value.trim() || null,
    ciudad: $('#e_ciudad').value.trim() || null,
    codigo_postal: $('#e_cp').value.trim() || null,
    pais: $('#e_pais').value.trim() || null,
    es_principal: $('#e_es_principal').checked ? 1 : undefined // undefined conserva valor si no se marca
  };
  try {
    await metodosPagoAPI.update(payload);
    showAlert('success','Actualizado correctamente');
    modalEditar.hide();
    // refresca según filtro
    const cli = $('#filtroCliente').value.trim();
    if (cli) await cargarPorCliente(); else await cargarAll();
  } catch (err) {
    console.error('guardar',err);
    showAlert('danger', `No se pudo actualizar: ${err.message}`);
  }
}

function prepararConfirm(type, id){
  accionConfirm = { type, id };
  const msg = type==='delete' ? `¿Eliminar el método #<strong>${id}</strong>?` : `¿Marcar #<strong>${id}</strong> como principal?`;
  $('#confirmMsg').innerHTML = msg;
  modalConfirm.show();
}

async function ejecutarConfirm(){
  if (!accionConfirm) return;
  const { type, id } = accionConfirm;
  try {
    if (type==='delete') {
      await metodosPagoAPI.remove(id);
      showAlert('success','Eliminado correctamente');
    } else if (type==='principal') {
      // Para marcar como principal debo enviar tipo y demás campos: rehidrato la fila actual
      const curr = (await metodosPagoAPI.getOne(id))?.data;
      await metodosPagoAPI.update({
        metodo_id: id,
        tipo: curr.tipo,
        direccion: curr.direccion,
        ciudad: curr.ciudad,
        codigo_postal: curr.codigo_postal,
        pais: curr.pais,
        es_principal: 1
      });
      showAlert('success','Marcado como principal');
    }
    modalConfirm.hide();
    const cli = $('#filtroCliente').value.trim();
    if (cli) await cargarPorCliente(); else await cargarAll();
  } catch (err) {
    console.error('ejecutarConfirm',err);
    showAlert('danger', `Acción fallida: ${err.message}`);
  } finally {
    accionConfirm = null;
  }
}

async function init(){
  modalCrear  = new bootstrap.Modal('#modalCrear');
  modalEditar = new bootstrap.Modal('#modalEditar');
  modalConfirm= new bootstrap.Modal('#modalConfirm');
  configurarTabla();
  await cargarAll();

  // Filtros/acciones
  $('#btnBuscarCliente').addEventListener('click', cargarPorCliente);
  $('#soloPrincipal').addEventListener('change', cargarPorCliente);
  $('#ordenarPor').addEventListener('change', ordenarTabla);
  $('#btnLimpiar').addEventListener('click', limpiar);
  $('#btnNuevo').addEventListener('click', () => { $('#formCrear').reset(); $('#formCrear').classList.remove('was-validated'); modalCrear.show(); });
  $('#btnConfirmarAccion').addEventListener('click', ejecutarConfirm);

  // Formularios
  $('#formCrear').addEventListener('submit', crear);
  $('#formEditar').addEventListener('submit', guardar);
}

window.addEventListener('DOMContentLoaded', init);