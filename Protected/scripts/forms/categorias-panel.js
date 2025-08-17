// /assets/js/admin-categorias.js
import { categoriasAPI } from '../apis/categorias-service.js';

(function(){
  // Helpers UI
  const $qs  = (s, r=document) => r.querySelector(s);
  const $$qs = (s, r=document) => Array.from(r.querySelectorAll(s));
  const fmtText = v => (v == null || String(v).trim() === '') ? '<em class="text-muted">— sin descripción —</em>' : String(v);
  const toLocalDT = ts => {
    if (!ts) return '<span class="text-muted">—</span>';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '<span class="text-muted">—</span>' : d.toLocaleString();
  };

  // Scroll reveal
  function revealOnScroll() {
    $$qs('.scroll-reveal').forEach(el=>{
      const r = el.getBoundingClientRect();
      if (r.top <= window.innerHeight - 80) el.classList.add('active');
    });
  }
  window.addEventListener('scroll', revealOnScroll);
  window.addEventListener('DOMContentLoaded', () => setTimeout(revealOnScroll, 24));

  // Dropdown demo
  async function cargarDropdown(){
    const sel = $qs('#selectCategorias');
    sel.innerHTML = `<option>Cargando…</option>`;
    try{
      const list = await categoriasAPI.getList(); // [{categoria_id, nombre_categoria}]
      sel.innerHTML = `<option value="">— selecciona —</option>` + list.map(c =>
        `<option value="${c.categoria_id}">${c.nombre_categoria}</option>`
      ).join('');
    }catch(e){
      sel.innerHTML = `<option value="">(error)</option>`;
      alert('No se pudo cargar el dropbox: ' + e.message);
    }
  }

  // Tabla 1: simple
  let dtSimple;
  async function cargarTablaSimple(){
    try{
      const data = await categoriasAPI.getAll();
      if (dtSimple) dtSimple.destroy();
      dtSimple = $('#tablaCategorias').DataTable({
        language:{ url:'https://cdn.datatables.net/plug-ins/1.13.4/i18n/Spanish.json' },
        data,
        columns:[
          { data:'categoria_id', title:'ID' },
          { data:'nombre_categoria', title:'Nombre' },
          { data:'descripcion', title:'Descripción',
            render: (v)=> fmtText(v)
          }
        ],
        pagingType:'simple_numbers', lengthMenu:[8,14,20],
        order:[[0,'asc']]
      });
    }catch(e){
      alert('Error al cargar categorías: ' + e.message);
    }
  }

  // Tabla 2: búsqueda por ID
  let dtBusqueda;
  async function buscarPorId(){
    const id = $qs('#buscarId').value.trim();
    if (!id) { alert('Ingresa un ID'); return; }
    try{
      const item = await categoriasAPI.getOne(id);
      const rows = Array.isArray(item) ? item : [item];
      if (dtBusqueda) dtBusqueda.destroy();
      dtBusqueda = $('#tablaBusqueda').DataTable({
        language:{ url:'https://cdn.datatables.net/plug-ins/1.13.4/i18n/Spanish.json' },
        data: rows,
        columns:[
          { data:'categoria_id', title:'ID' },
          { data:'nombre_categoria', title:'Nombre' },
          { data:'descripcion', title:'Descripción', render: (v)=> fmtText(v) }
        ],
        searching:false, paging:false, info:false, ordering:false
      });
    }catch(e){
      if (dtBusqueda) dtBusqueda.clear().draw();
      alert('No se encontró el ID: ' + e.message);
    }
  }

  // Tabla 3: CRUD
  let dtCRUD;
  function renderAcciones(){
    return `
      <div class="d-flex" style="gap:.35rem">
        <button class="btn btn-ghost btn-edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-outline btn-danger btn-delete" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  }

  async function cargarCRUD(){
    try{
      const data = await categoriasAPI.getAll();
      if (dtCRUD) dtCRUD.destroy();
      dtCRUD = $('#tablaCRUD').DataTable({
        language:{ url:'https://cdn.datatables.net/plug-ins/1.13.4/i18n/Spanish.json' },
        data,
        columns:[
          { data:'categoria_id', title:'ID' },
          { data:'nombre_categoria', title:'Nombre',
            render:(v, t, row)=> `<span class="link-edit" style="cursor:pointer" title="Editar">${v}</span>`
          },
          { data:'descripcion', title:'Descripción', render:(v)=> fmtText(v) },
          { data:null, title:'Eliminar', orderable:false, searchable:false, render:()=> renderAcciones() }
        ],
        pagingType:'simple_numbers', lengthMenu:[8,14,20],
        order:[[0,'asc']]
      });
    }catch(e){
      alert('Error al cargar CRUD: ' + e.message);
    }
  }

  // Modal (reutilizable)
  const modal = $qs('#modalCategoria');
  const form  = $qs('#categoriaForm');
  const title = $qs('#modalCategoriaTitle');
  const inputId = $qs('#categoria_id');
  const inputNombre = $qs('#nombre_categoria');
  const inputDesc = $qs('#descripcion');

  function abrirModal(t, data={}){
    title.textContent = t;
    inputId.value = data.categoria_id ?? '';
    inputNombre.value = data.nombre_categoria ?? '';
    inputDesc.value = data.descripcion ?? '';
    modal.classList.add('show');
    inputNombre.focus();
  }
  function cerrarModal(){ modal.classList.remove('show'); }

  // Eventos UI
  $qs('#btnProbarDropdown').addEventListener('click', cargarDropdown);
  $qs('#btnCargarTodas').addEventListener('click', cargarTablaSimple);
  $qs('#btnBuscar').addEventListener('click', buscarPorId);
  $qs('#btnRefrescarCrud').addEventListener('click', cargarCRUD);
  $qs('#btnAbrirAgregar').addEventListener('click', ()=> abrirModal('Nueva Categoría'));
  $qs('#btnAbrirEditar').addEventListener('click', ()=>{
    if (!dtCRUD) return alert('Primero carga el CRUD.');
    const row = dtCRUD.row({ selected:true }).data();
    if (!row) return alert('Selecciona una fila para editar.');
    abrirModal('Editar Categoría', row);
  });
  $qs('#closeModalBtn').addEventListener('click', cerrarModal);
  $qs('#cancelModalBtn').addEventListener('click', cerrarModal);

  // Editar desde la tabla (click en nombre o botón editar)
  $(document).on('click', '#tablaCRUD .link-edit, #tablaCRUD .btn-edit', function(){
    const row = dtCRUD.row($(this).closest('tr')).data();
    if (row) abrirModal('Editar Categoría', row);
  });

  // Eliminar
  $(document).on('click', '#tablaCRUD .btn-delete', async function(){
    const row = dtCRUD.row($(this).closest('tr')).data();
    if (!row) return;
    if (!confirm(`¿Eliminar la categoría "${row.nombre_categoria}"? Esta acción no se puede deshacer.`)) return;
    try{
      await categoriasAPI.remove(row.categoria_id);
      await cargarCRUD();
    }catch(e){
      alert('No se pudo eliminar: ' + e.message);
    }
  });

  // Guardar (crear/actualizar)
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const categoria_id = inputId.value ? parseInt(inputId.value, 10) : null;
    const payload = {
      nombre_categoria: inputNombre.value.trim(),
      descripcion: inputDesc.value.trim() || null
    };
    if (!payload.nombre_categoria){
      alert('El nombre es obligatorio.');
      inputNombre.focus();
      return;
    }
    try{
      if (categoria_id){
        await categoriasAPI.update({ categoria_id, ...payload });
      }else{
        await categoriasAPI.insert(payload);
      }
      cerrarModal();
      await Promise.all([cargarTablaSimple(), cargarCRUD()]);
    }catch(e2){
      alert('Error al guardar/actualizar: ' + e2.message);
    }
  });

  // Inicio
  window.addEventListener('DOMContentLoaded', async ()=>{
    // toque visual inicial coherente
    document.body.style.backgroundColor = 'var(--color-bg)';
    $$qs('h1,h2').forEach(e => e.style.fontFamily = 'var(--font-heading)');
    await Promise.all([cargarTablaSimple(), cargarCRUD()]);
  });
})();
