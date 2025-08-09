// /scripts/pages/categoriesPage.js
import { showError } from '../showError.js';
import {
  getAllCategories,
  insertNewCategory,
  updateCategory,
  deleteCategory,
} from '../apis/categoriesManager.js';

let dt; // DataTable instance
let pendingDelete = { id: null, name: '' };

const $ = window.jQuery; // ensure jQuery is available

document.addEventListener('DOMContentLoaded', () => {
  initTable();
  bindUI();
  // initial load
  reloadTable();
});

function initTable() {
  // Make sure the table exists
  const tbl = document.getElementById('categoriesTable');
  if (!tbl) {
    showError('No se encontró la tabla de categorías en el DOM.');
    return;
  }

  // Initialize DataTable
  dt = $('#categoriesTable').DataTable({
    // Basic columns: ID, Nombre, Descripción, Acciones
    columns: [
      { data: 'categoria_id', title: 'ID' },
      { data: 'nombre_categoria', title: 'Nombre' },
      { data: 'descripcion', title: 'Descripción', defaultContent: '' },
      {
        data: null,
        orderable: false,
        searchable: false,
        title: 'Acciones',
        render: (row) => {
          // Buttons carry data attributes for modals
          return `
            <button class="btn btn-sm btn-primary btn-edit"
              data-id="${row.categoria_id}"
              data-name="${escapeAttr(row.nombre_categoria)}"
              data-desc="${escapeAttr(row.descripcion || '')}"
              data-bs-toggle="modal" data-bs-target="#editModal">
              Editar
            </button>
            <button class="btn btn-sm btn-danger btn-delete ms-2"
              data-id="${row.categoria_id}"
              data-name="${escapeAttr(row.nombre_categoria)}"
              data-bs-toggle="modal" data-bs-target="#deleteModal">
              Eliminar
            </button>
          `;
        },
      },
    ],
    // UX niceties
    pageLength: 10,
    lengthChange: false,
    order: [[0, 'asc']],
    // Optional: Spanish strings (can be adjusted)
    language: {
      search: 'Buscar:',
      info: 'Mostrando _START_ a _END_ de _TOTAL_ categorías',
      infoEmpty: 'Mostrando 0 a 0 de 0 categorías',
      zeroRecords: 'No se encontraron resultados',
      paginate: { next: 'Siguiente', previous: 'Anterior' },
    },
  });

  // Row action handlers (event delegation)
  $('#categoriesTable tbody')
    .on('click', 'button.btn-edit', onOpenEditModal)
    .on('click', 'button.btn-delete', onOpenDeleteModal);
}

function bindUI() {
  // Load button
  const loadBtn = document.getElementById('loadCategories');
  if (loadBtn) loadBtn.addEventListener('click', reloadTable);

  // Create form
  const createForm = document.getElementById('createCategoryForm');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        disableForm(createForm, true);
        const fd = new FormData(createForm);
        await insertNewCategory(fd);
        // Close modal, reset form, refresh
        closeModal('createModal');
        createForm.reset();
        reloadTable();
      } catch (err) {
        showError(err?.message || 'Error al crear la categoría');
      } finally {
        disableForm(createForm, false);
      }
    });
  }

  // Edit form
  const editForm = document.getElementById('editCategoryForm');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        disableForm(editForm, true);
        const fd = new FormData(editForm);
        // Ensure ID is present
        if (!fd.get('categoria_id')) {
          showError('Falta el ID de categoría para actualizar.');
          return;
        }
        await updateCategory(fd);
        closeModal('editModal');
        editForm.reset();
        reloadTable();
      } catch (err) {
        showError(err?.message || 'Error al actualizar la categoría');
      } finally {
        disableForm(editForm, false);
      }
    });
  }

  // Confirm delete
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', onConfirmDelete);
  }
}

async function reloadTable() {
  try {
    setLoading(true);
    const res = await getAllCategories();

    // Normalize: accept either an array or {data:[...]} or {rows:[...]}
    const rows = Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.rows)
      ? res.rows
      : [];

    dt.clear();
    dt.rows.add(rows);
    dt.draw();
  } catch (err) {
    showError(err?.message || 'Error al cargar categorías');
  } finally {
    setLoading(false);
  }
}

/* ======================
   Modal Handlers
   ====================== */

function onOpenEditModal(ev) {
  const btn = ev.currentTarget;
  const id = btn.getAttribute('data-id');
  const name = btn.getAttribute('data-name') || '';
  const desc = btn.getAttribute('data-desc') || '';

  // Fill inputs
  document.getElementById('editId').value = id;
  document.getElementById('editName').value = name;
  document.getElementById('editDesc').value = desc;

  // Clear file input
  const fileInput = document.getElementById('editImage');
  if (fileInput) fileInput.value = '';
}

function onOpenDeleteModal(ev) {
  const btn = ev.currentTarget;
  pendingDelete.id = btn.getAttribute('data-id');
  pendingDelete.name = btn.getAttribute('data-name') || '';

  const el = document.getElementById('deleteName');
  if (el) el.textContent = pendingDelete.name;
}

async function onConfirmDelete() {
  if (!pendingDelete.id) {
    showError('No se encontró el ID de la categoría a eliminar.');
    return;
  }
  try {
    const fd = new FormData();
    fd.append('categoria_id', pendingDelete.id);
    await deleteCategory(fd);
    closeModal('deleteModal');
    pendingDelete = { id: null, name: '' };
    reloadTable();
  } catch (err) {
    showError(err?.message || 'Error al eliminar la categoría');
  }
}

/* ======================
   Helpers
   ====================== */

function disableForm(formEl, disabled) {
  [...formEl.elements].forEach((el) => (el.disabled = disabled));
}

function setLoading(isLoading) {
  const btn = document.getElementById('loadCategories');
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Cargando…' : 'Cargar Categorías';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const modal = bootstrap.Modal.getOrCreateInstance(el);
  modal.hide();
}

function escapeAttr(str) {
  // Cheap attribute-escape for data-attrs
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
