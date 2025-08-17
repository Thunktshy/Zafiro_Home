// /admin-resources/scripts/forms/categorias-panel.js
// Control de UI del panel de categorías + DataTables + modal accesible

import { categoriasAPI } from '/admin-resources/scripts/apis/categorias-service.js';

/* ------------------------------ Utilidades ------------------------------ */

const $ = window.jQuery; // aseguramos jQuery global
const q  = (sel) => document.querySelector(sel);
const qa = (sel) => Array.from(document.querySelectorAll(sel));

const DT_LANG_ES = {
  decimal: ",",
  thousands: ".",
  emptyTable: "Sin datos disponibles",
  info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
  infoEmpty: "Mostrando 0 a 0 de 0 registros",
  infoFiltered: "(filtrado de _MAX_ registros)",
  lengthMenu: "Mostrar _MENU_ registros",
  loadingRecords: "Cargando...",
  processing: "Procesando...",
  search: "Buscar:",
  zeroRecords: "No se encontraron resultados",
  paginate: { first: "Primero", last: "Último", next: "Siguiente", previous: "Anterior" }
};

// Normaliza cualquier forma de objeto categoría que venga del backend
function normalizeCat(row = {}) {
  const id  = row.categoria_id ?? row.id ?? row.ID ?? row.Id ?? null;
  const nom = row.nombre_categoria ?? row.nombre ?? row.Nombre ?? '';
  const des = row.descripcion ?? row.Descripcion ?? '';
  return { id, nombre: nom, descripcion: des };
}

function setBusy(el, busy = true) {
  if (!el) return;
  el.toggleAttribute?.('aria-busy', !!busy);
  el.disabled = !!busy;
}

function toastError(err, fallback = 'Ocurrió un error') {
  console.error(err);
  alert(err?.message || fallback);
}

/* --------------------------- Referencias de UI --------------------------- */

const els = {
  btnProbarDropdown : q('#btnProbarDropdown'),
  selectCategorias  : q('#selectCategorias'),
  btnCargarTodas    : q('#btnCargarTodas'),
  tablaCategorias   : q('#tablaCategorias'),
  buscarId          : q('#buscarId'),
  btnBuscar         : q('#btnBuscar'),
  tablaBusqueda     : q('#tablaBusqueda'),
  btnRefrescarCrud  : q('#btnRefrescarCrud'),
  btnAbrirAgregar   : q('#btnAbrirAgregar'),
  btnAbrirEditar    : q('#btnAbrirEditar'),
  tablaCRUD         : q('#tablaCRUD'),

  // Modal
  modal             : q('#modalCategoria'),
  modalDialog       : q('#modalCategoria .modal-dialog'),
  modalTitle        : q('#modalCategoriaTitle'),
  closeModalBtn     : q('#closeModalBtn'),
  cancelModalBtn    : q('#cancelModalBtn'),
  form              : q('#categoriaForm'),
  inputId           : q('#categoria_id'),
  inputNombre       : q('#nombre_categoria'),
  inputDesc         : q('#descripcion'),
  saveBtn           : q('#saveCategoriaBtn')
};

const state = {
  dt: {
    categorias: null,
    busqueda: null,
    crud: null
  },
  lastFocus: null,
  modalMode: 'add' // 'add' | 'edit'
};

/* -------------------------- Helpers DataTables --------------------------- */

function ensureTable(selector, data, columns, key, opts = {}) {
  // Si ya existe, actualizamos filas. Si no, inicializamos con columnas fijas.
  if (state.dt[key]) {
    state.dt[key].clear();
    state.dt[key].rows.add(data);
    state.dt[key].draw(false);
    return state.dt[key];
  }

  state.dt[key] = $(selector).DataTable({
    data,
    columns,
    language: DT_LANG_ES,              // inline para evitar CORS en JSON de i18n
    pageLength: 10,
    lengthMenu: [5, 10, 25, 50, 100],
    ordering: true,
    searching: true,
    autoWidth: false,
    deferRender: true,
    ...opts
  });
  return state.dt[key];
}

function colsSimple() {
  return [
    { data: 'id',         title: 'ID' },
    { data: 'nombre',     title: 'Nombre' },
    { data: 'descripcion',title: 'Descripción',
      defaultContent: '', render: (d) => d ?? '' }
  ];
}

function colsCRUD() {
  return [
    { data: 'id',         title: 'ID' },
    { data: 'nombre',     title: 'Nombre',
      createdCell: (td, val, row) => {
        td.classList.add('link-like'); // editable al clic
        td.tabIndex = 0;
        td.setAttribute('role','button');
        td.setAttribute('aria-label', `Editar categoría ${val}`);
      }
    },
    { data: 'descripcion',title: 'Descripción', defaultContent: '' },
    {
      data: null, title: 'Eliminar', orderable: false, searchable: false,
      defaultContent: '',
      render: (_d, _t, row) =>
        `<button class="btn btn-danger btn-eliminar" data-id="${row.id}" aria-label="Eliminar ${row.nombre}">
           <i class="fa-solid fa-trash"></i>
         </button>`
    }
  ];
}

/* ---------------------------- Carga de datos ----------------------------- */

async function loadDropdown() {
  try {
    setBusy(els.btnProbarDropdown, true);
    const listRaw =
      (await categoriasAPI.getList().catch(() => null)) ??
      (await categoriasAPI.getAll()); // fallback si no hay getList
    const list = Array.isArray(listRaw) ? listRaw.map(normalizeCat) : [];
    els.selectCategorias.innerHTML =
      `<option value="">— seleccione —</option>` +
      list.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  } catch (err) {
    toastError(err, 'No se pudo cargar el combo de categorías');
  } finally {
    setBusy(els.btnProbarDropdown, false);
  }
}

async function loadTablaCategorias() {
  try {
    setBusy(els.btnCargarTodas, true);
    const data = (await categoriasAPI.getAll()).map(normalizeCat);
    ensureTable(els.tablaCategorias, data, colsSimple(), 'categorias');
  } catch (err) {
    toastError(err, 'No se pudo cargar el listado');
  } finally {
    setBusy(els.btnCargarTodas, false);
  }
}

async function buscarPorId() {
  const id = parseInt(els.buscarId.value, 10);
  if (!id) {
    alert('Escribe un ID válido');
    return;
  }
  try {
    setBusy(els.btnBuscar, true);
    const one = await categoriasAPI.getOne(id);
    const row = normalizeCat(Array.isArray(one) ? one[0] : one);
    const data = row?.id ? [row] : [];
    ensureTable(els.tablaBusqueda, data, colsSimple(), 'busqueda');
  } catch (err) {
    toastError(err, 'No se encontró la categoría');
    ensureTable(els.tablaBusqueda, [], colsSimple(), 'busqueda');
  } finally {
    setBusy(els.btnBuscar, false);
  }
}

async function loadCRUD() {
  try {
    setBusy(els.btnRefrescarCrud, true);
    const data = (await categoriasAPI.getAll()).map(normalizeCat);
    const dt = ensureTable(els.tablaCRUD, data, colsCRUD(), 'crud');
    // Delegados (una sola vez)
    if (!els.tablaCRUD.dataset.bound) {
      bindCrudDelegates(dt);
      els.tablaCRUD.dataset.bound = '1';
    }
  } catch (err) {
    toastError(err, 'No se pudo cargar el CRUD');
  } finally {
    setBusy(els.btnRefrescarCrud, false);
  }
}

/* ---------------------------- Delegados CRUD ----------------------------- */

function bindCrudDelegates(dt) {
  // seleccionar fila (para usar con "Modificar" si se desea)
  $(els.tablaCRUD).on('click', 'tbody tr', function () {
    $(this).toggleClass('row-selected').siblings().removeClass('row-selected');
  });

  // clic en nombre -> abrir modal edición
  $(els.tablaCRUD).on('click keydown', 'tbody td.link-like', function (ev) {
    if (ev.type === 'keydown' && !['Enter',' '].includes(ev.key)) return;
    const row = dt.row(this.closest('tr')).data();
    if (row) openEditModal(row);
  });

  // eliminar
  $(els.tablaCRUD).on('click', 'button.btn-eliminar', async function () {
    const id = parseInt(this.dataset.id, 10);
    if (!id) return;
    const ok = confirm('¿Eliminar esta categoría? Esta acción no se puede deshacer.');
    if (!ok) return;
    try {
      setBusy(this, true);
      await categoriasAPI.remove(id);
      await loadCRUD();
    } catch (err) {
      toastError(err, 'No se pudo eliminar');
    } finally {
      setBusy(this, false);
    }
  });
}

/* --------------------------------- Modal -------------------------------- */

function openModal(mode = 'add', data = null) {
  state.modalMode = mode;
  state.lastFocus = document.activeElement;

  if (mode === 'add') {
    els.modalTitle.textContent = 'Nueva Categoría';
    els.inputId.value = '';
    els.form.reset();
  } else {
    els.modalTitle.textContent = `Editar Categoría #${data.id}`;
    els.inputId.value     = data.id ?? '';
    els.inputNombre.value = data.nombre ?? '';
    els.inputDesc.value   = data.descripcion ?? '';
  }

  els.modal.removeAttribute('aria-hidden');
  els.modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  els.inputNombre.focus();

  // Cerrar por overlay (clic fuera del diálogo)
  const onOverlay = (e) => {
    if (!els.modalDialog.contains(e.target)) closeModal();
  };
  els.modal.addEventListener('mousedown', onOverlay, { once: true });

  // ESC para cerrar
  const onEsc = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  els.modal.addEventListener('keydown', onEsc, { once: true });

  // Guardar referencias para remover si hiciera falta en el futuro
  els.modal._overlayHandler = onOverlay;
  els.modal._escHandler = onEsc;
}

function closeModal() {
  els.modal.setAttribute('aria-hidden', 'true');
  els.modal.classList.remove('open');
  document.body.style.overflow = '';
  // limpiar handlers
  if (els.modal._overlayHandler) {
    els.modal.removeEventListener('mousedown', els.modal._overlayHandler);
    els.modal._overlayHandler = null;
  }
  if (els.modal._escHandler) {
    els.modal.removeEventListener('keydown', els.modal._escHandler);
    els.modal._escHandler = null;
  }
  // restaurar foco
  state.lastFocus?.focus?.();
}

/* ----------------------------- Eventos modal ----------------------------- */

async function onSubmitCategoria(ev) {
  ev.preventDefault();
  const payload = {
    categoria_id: els.inputId.value ? parseInt(els.inputId.value, 10) : undefined,
    nombre_categoria: els.inputNombre.value?.trim(),
    descripcion: els.inputDesc.value?.trim() || null
  };

  if (!payload.nombre_categoria) {
    alert('El nombre es obligatorio.');
    els.inputNombre.focus();
    return;
  }

  try {
    setBusy(els.saveBtn, true);
    if (state.modalMode === 'add') {
      await categoriasAPI.insert(payload);
    } else {
      await categoriasAPI.update(payload);
    }
    closeModal();
    // refrescos
    await Promise.allSettled([
      loadDropdown(),
      loadTablaCategorias(),
      buscarPorId(),  // si hay un ID escrito lo volverá a mostrar
      loadCRUD()
    ]);
  } catch (err) {
    toastError(err, 'No se pudo guardar la categoría');
  } finally {
    setBusy(els.saveBtn, false);
  }
}

function openAddModal()  { openModal('add'); }
function openEditModal(row) { openModal('edit', row); }

/* ------------------------------- Listeners ------------------------------- */

function bindUI() {
  els.btnProbarDropdown?.addEventListener('click', loadDropdown);
  els.btnCargarTodas?.addEventListener('click', loadTablaCategorias);
  els.btnBuscar?.addEventListener('click', buscarPorId);
  els.btnRefrescarCrud?.addEventListener('click', loadCRUD);

  els.btnAbrirAgregar?.addEventListener('click', openAddModal);
  els.btnAbrirEditar?.addEventListener('click', () => {
    // Preferimos fila seleccionada en CRUD
    const dt = state.dt.crud;
    let rowData = null;
    if (dt) {
      const tr = els.tablaCRUD.querySelector('tbody tr.row-selected');
      if (tr) rowData = dt.row(tr).data();
    }
    if (rowData) return openEditModal(rowData);

    // Fallback: si hay ID escrito en el buscador
    const id = parseInt(els.buscarId.value, 10);
    if (id) {
      categoriasAPI.getOne(id)
        .then(r => openEditModal(normalizeCat(Array.isArray(r) ? r[0] : r)))
        .catch(() => alert('No se encontró la categoría a editar.'));
      return;
    }

    alert('Selecciona una fila en el CRUD o escribe un ID y usa "Buscar" antes de editar.');
  });

  // Modal
  els.closeModalBtn?.addEventListener('click', closeModal);
  els.cancelModalBtn?.addEventListener('click', closeModal);
  els.form?.addEventListener('submit', onSubmitCategoria);
}

/* ------------------------------ Inicializar ------------------------------ */

document.addEventListener('DOMContentLoaded', async () => {
  // Asegura thead/tbody correctos ya existen por HTML (evita column count errors)
  bindUI();

  // Cargas iniciales ligeras
  await loadDropdown();
  // No cargamos todas las tablas de golpe para no bloquear UI;
  // el usuario puede ir probando con los botones:
  // - "Cargar Todas"
  // - "Buscar"
  // - "Refrescar CRUD"
});
