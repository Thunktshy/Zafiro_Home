// categorias-panel.js
// Controla tablas (placeholders + DataTables), modal accesible y llamadas al servicio

import { categoriasAPI } from '/admin-resources/scripts/apis/categorias-service.js';

// Idioma DataTables en-línea (evita CORS y 404 de CDN)
const DT_LANG = {
  decimal: ",",
  thousands: ".",
  processing: "Procesando...",
  search: "Buscar:",
  lengthMenu: "Mostrar _MENU_ registros",
  info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
  infoEmpty: "Mostrando 0 a 0 de 0 registros",
  infoFiltered: "(filtrado de _MAX_ registros totales)",
  infoPostFix: "",
  loadingRecords: "Cargando...",
  zeroRecords: "No se encontraron resultados",
  emptyTable: "No hay datos disponibles en la tabla",
  paginate: { first: "Primero", previous: "Anterior", next: "Siguiente", last: "Último" },
  aria: { sortAscending: ": activar para ordenar la columna ascendente", sortDescending: ": activar para ordenar la columna descendente" }
};


// Helpers DOM
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

// DataTables refs
let dtListado = null;
let dtBusqueda = null;
let dtCRUD = null;

// ---- Utilidades UI ----
const fmtText = (v) => (v == null || String(v).trim() === '')
  ? '<em class="text-muted">— sin descripción —</em>'
  : String(v);

function ensureDataTable(tableSel, columns, opts={}){
  // Crea/retorna una instancia DataTable jQuery base (1.13.x)
  const $table = window.jQuery(tableSel);
  if (!$table.length) return null;
  try { $table.DataTable().destroy(); } catch(_) {}
  return $table.DataTable(Object.assign({
    data: [],
    columns,
    pagingType: 'simple_numbers',
    lengthMenu: [8,14,20],
    language: DT_LANG,
    order: [[0,'asc']]
  }, opts));
}

function initTables(){
  // Tabla 1: Listado
  dtListado = ensureDataTable('#tablaCategorias', [
    { data:'categoria_id', title:'ID' },
    { data:'nombre_categoria', title:'Nombre' },
    { data:'descripcion', title:'Descripción', render:(v)=>fmtText(v) }
  ]);

  // Tabla 2: Búsqueda por ID
  dtBusqueda = ensureDataTable('#tablaBusqueda', [
    { data:'categoria_id', title:'ID' },
    { data:'nombre_categoria', title:'Nombre' },
    { data:'descripcion', title:'Descripción', render:(v)=>fmtText(v) }
  ], { searching:false, paging:false, info:false, ordering:false });

  // Tabla 3: CRUD
  dtCRUD = ensureDataTable('#tablaCRUD', [
    { data:'categoria_id', title:'ID' },
    { data:'nombre_categoria', title:'Nombre', render:(v)=>`<span class="link-edit" style="cursor:pointer" title="Editar">${v}</span>` },
    { data:'descripcion', title:'Descripción', render:(v)=>fmtText(v) },
    { data:null, title:'Eliminar', orderable:false, searchable:false,
      render:()=>`
        <div class="d-flex" style="gap:.35rem">
          <button class="btn btn-ghost btn-edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-outline btn-danger btn-delete" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>`
    }
  ]);
}

// ---- Carga de datos ----
async function cargarListado(){
  if (!dtListado) return;
  try {
    const data = await categoriasAPI.getAll();
    dtListado.clear().rows.add(data).draw();
  } catch (e) { alert('Error al cargar categorías: ' + e.message); }
}

async function cargarCRUD(){
  if (!dtCRUD) return;
  try {
    const data = await categoriasAPI.getAll();
    dtCRUD.clear().rows.add(data).draw();
  } catch (e) { alert('Error al cargar CRUD: ' + e.message); }
}

async function buscarPorId(){
  if (!dtBusqueda) return;
  const id = $('#buscarId').value.trim();
  if (!id) { alert('Ingresa un ID'); return; }
  try{
    const item = await categoriasAPI.getOne(id);
    const rows = Array.isArray(item) ? item : [item];
    dtBusqueda.clear().rows.add(rows).draw();
  }catch(e){
    dtBusqueda.clear().draw();
    alert('No se encontró el ID: ' + e.message);
  }
}

async function cargarDropdown(){
  const sel = $('#selectCategorias');
  if (!sel) return;
  sel.innerHTML = '<option>Cargando…</option>';
  try{
    const list = await categoriasAPI.getList();
    sel.innerHTML = '<option value="">— selecciona —</option>' + list.map(c =>
      `<option value="${c.categoria_id}">${c.nombre_categoria}</option>`
    ).join('');
  }catch(e){
    sel.innerHTML = '<option value="">(error)</option>';
    alert('No se pudo cargar el dropbox: ' + e.message);
  }
}

// ---- Modal accesible ----
const modal = $('#modalCategoria');
const main  = document.querySelector('main');
const form  = $('#categoriaForm');
const title = $('#modalCategoriaTitle');
const inputId = $('#categoria_id');
const inputNombre = $('#nombre_categoria');
const inputDesc = $('#descripcion');
let lastFocusEl = null;

function setInert(on){
  if (!main) return;
  if (on) main.setAttribute('inert', '');
  else main.removeAttribute('inert');
}

function openModal(modalTitle, data={}){
  lastFocusEl = document.activeElement;
  title.textContent = modalTitle || 'Nueva Categoría';
  inputId.value = data.categoria_id ?? '';
  inputNombre.value = data.nombre_categoria ?? '';
  inputDesc.value = data.descripcion ?? '';

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  modal.setAttribute('aria-modal', 'true');
  setInert(true);
  setTimeout(()=> inputNombre.focus(), 0);
}

function closeModal(){
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  modal.removeAttribute('aria-modal');
  setInert(false);
  if (lastFocusEl && lastFocusEl.focus) lastFocusEl.focus();
}

// Cerrar con overlay click o Esc
modal.addEventListener('click', (e)=>{
  if (e.target === modal) closeModal();
});
window.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
});

// ---- Eventos ----
function wireEvents(){
  $('#btnProbarDropdown')?.addEventListener('click', cargarDropdown);
  $('#btnCargarTodas')?.addEventListener('click', cargarListado);
  $('#btnBuscar')?.addEventListener('click', buscarPorId);
  $('#btnRefrescarCrud')?.addEventListener('click', cargarCRUD);
  $('#btnAbrirAgregar')?.addEventListener('click', ()=> openModal('Nueva Categoría'));
  $('#btnAbrirEditar')?.addEventListener('click', ()=>{
    const tr = document.querySelector('#tablaCRUD tbody tr.selected') || document.querySelector('#tablaCRUD tbody tr');
    if (!tr || !dtCRUD) return alert('Selecciona una fila en el CRUD.');
    const row = dtCRUD.row(tr).data();
    if (!row) return alert('No se pudo leer la fila.');
    openModal('Editar Categoría', row);
  });
  $('#closeModalBtn')?.addEventListener('click', closeModal);
  $('#cancelModalBtn')?.addEventListener('click', closeModal);

  // Delegación edición/eliminación dentro de la tabla
  document.addEventListener('click', async (ev)=>{
    const t = ev.target.closest?.('.btn-edit, .link-edit, .btn-delete');
    if (!t || !dtCRUD) return;
    const tr = t.closest('tr');
    const row = dtCRUD.row(tr).data();
    if (!row) return;

    if (t.classList.contains('btn-delete')){
      if (!confirm(`¿Eliminar la categoría "${row.nombre_categoria}"?`)) return;
      try{ await categoriasAPI.remove(row.categoria_id); await cargarCRUD(); }
      catch(e){ alert('No se pudo eliminar: ' + e.message); }
      return;
    }
    // editar
    openModal('Editar Categoría', row);
  });

  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const categoria_id = inputId.value ? parseInt(inputId.value, 10) : null;
    const payload = {
      nombre_categoria: inputNombre.value.trim(),
      descripcion: inputDesc.value.trim() || null
    };
    if (!payload.nombre_categoria){ inputNombre.focus(); return alert('El nombre es obligatorio.'); }

    try{
      if (categoria_id) await categoriasAPI.update({ categoria_id, ...payload });
      else await categoriasAPI.insert(payload);
      closeModal();
      await Promise.all([cargarListado(), cargarCRUD()]);
    }catch(e2){ alert('Error al guardar/actualizar: ' + e2.message); }
  });
}

// ---- Inicio ----
window.addEventListener('DOMContentLoaded', async ()=>{
  // Evita errores si DataTables no está listo
  if (!window.jQuery || !jQuery.fn || !jQuery.fn.DataTable){
    console.error('DataTables (jQuery) no cargó. Verifica el orden de scripts.');
    return;
  }
  initTables();
  wireEvents();
  // Carga visual inicial
  await Promise.all([cargarListado(), cargarCRUD()]);
});

// Debug global opcional
window.AdminCategorias = { cargarListado, cargarCRUD, buscarPorId };