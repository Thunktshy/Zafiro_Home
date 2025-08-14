// Controlador de UI del Panel de Productos
import { categoriasAPI } from '/admin-resources/scripts/apis/categoriesManager.js';
import { productosAPI } from '/admin-resources/scripts/apis/productosManager.js';

// ===== Helpers DOM / feedback =====
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const alertBox = $('#alertBox');

function showAlert(type, msg, autoHideMs = 4000) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
  if (autoHideMs) setTimeout(() => alertBox.classList.add('d-none'), autoHideMs);
}

const fmtMoney = (v) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(v || 0));

const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleDateString('es-MX') : (v || '—');
};

// ===== Estado local =====
let dt; // DataTable instance
let categorias = [];               // [{ categoria_id, nombre_categoria }]
const catMap = new Map();          // id -> nombre

// ====== Cargar categorías (filtros + modal) ======
async function cargarCategorias() {
  const res = await categoriasAPI.getList(); // puede venir como {data:[...]} o array plano
  const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
  categorias = list;
  catMap.clear();
  list.forEach(c => catMap.set(Number(c.categoria_id), c.nombre_categoria));

  // popular selects
  const filtro = $('#filtroCategoria');
  const selModal = $('#categoria_id');
  [filtro, selModal].forEach(sel => {
    // limpiar menos la opción (Todas) del filtro
    const opts = sel.querySelectorAll('option:not(:first-child)');
    opts.forEach(o => o.remove());
    list.forEach(({ categoria_id, nombre_categoria }) => {
      const opt = document.createElement('option');
      opt.value = String(categoria_id);
      opt.textContent = `${nombre_categoria} (ID ${categoria_id})`;
      sel.appendChild(opt);
    });
  });
}

// ====== DataTable ======
function initTabla() {
  dt = $('#tablaProductos').DataTable({
    data: [],
    columns: [
      { data: 'producto_id' },
      { data: 'nombre_producto' },
      { data: 'descripcion', defaultContent: '' },
      {
        data: 'precio_unitario',
        render: (d) => fmtMoney(d)
      },
      { data: 'stock' },
      {
        data: 'categoria_id',
        render: (id) => {
          const name = catMap.get(Number(id)) || '';
          return name ? `${id} — ${name}` : String(id ?? '');
        }
      },
      { data: 'estado_producto' },
      { data: 'fecha_creacion', render: (d) => fmtDate(d) },
      {
        data: null,
        orderable: false,
        searchable: false,
        className: 'text-end',
        render: (row) => {
          const id = row.producto_id;
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-editar" data-id="${id}" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-outline-danger btn-eliminar" data-id="${id}" data-name="${(row.nombre_producto||'').replaceAll('"','&quot;')}" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>`;
        }
      }
    ],
    order: [[1, 'asc']],
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json'
    }
  });

  // Delegación de eventos en acciones de la tabla
  $('#tablaProductos tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('btn-editar')) {
      abrirModalEditar(id);
    } else if (btn.classList.contains('btn-eliminar')) {
      abrirModalEliminar(id, btn.dataset.name || '');
    }
  });
}

// ====== Carga de datos ======
async function recargarProductos(origen = 'all') {
  try {
    let data;
    const nombre = $('#filtroNombre').value.trim();
    const catId  = $('#filtroCategoria').value.trim();

    if (origen === 'nombre' && nombre) {
      data = await productosAPI.getByName(nombre);
    } else if (origen === 'categoria' && catId) {
      data = await productosAPI.getByCategoria(Number(catId));
    } else {
      data = await productosAPI.getAll();
    }

    const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    dt.clear().rows.add(rows).draw();

    showAlert('success', `Se cargaron ${rows.length} producto(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron cargar los productos');
  }
}

// ====== Filtros / acciones de barra ======
function wireFiltros() {
  $('#btnBuscarNombre').addEventListener('click', () => recargarProductos('nombre'));
  $('#filtroCategoria').addEventListener('change', () => recargarProductos('categoria'));

  $('#ordenarPor').addEventListener('change', (e) => {
    const col = String(e.target.value);
    // Mapa columnas -> índice en la DataTable
    const colIndex = {
      producto_id: 0,
      nombre_producto: 1,
      descripcion: 2,
      precio_unitario: 3,
      stock: 4,
      categoria_id: 5,
      estado_producto: 6,
      fecha_creacion: 7
    }[col] ?? 1;
    dt.order([colIndex, 'asc']).draw();
  });

  $('#btnLimpiar').addEventListener('click', () => {
    $('#filtroNombre').value = '';
    $('#filtroCategoria').value = '';
    $('#ordenarPor').value = 'nombre_producto';
    recargarProductos('all');
  });

  $('#btnNuevo').addEventListener('click', abrirModalNuevo);
}

// ====== Modales ======
const modalProd   = new bootstrap.Modal('#modalProducto');
const modalConfirm = new bootstrap.Modal('#modalConfirm');

function limpiarFormulario() {
  $('#producto_id').value = '';
  $('#nombre_producto').value = '';
  $('#descripcion').value = '';
  $('#precio_unitario').value = '';
  $('#stock').value = '';
  $('#categoria_id').value = '';
  $('#estado_producto').value = 'activo';
  // quitar invalid
  $$('#formProducto .is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

function abrirModalNuevo() {
  limpiarFormulario();
  $('#modalProductoTitulo').textContent = 'Nuevo producto';
  $('#btnGuardar').textContent = 'Guardar';
  modalProd.show();
  setTimeout(() => $('#nombre_producto')?.focus(), 200);
}

async function abrirModalEditar(producto_id) {
  limpiarFormulario();
  $('#modalProductoTitulo').textContent = 'Editar producto';
  $('#btnGuardar').textContent = 'Actualizar';

  try {
    // Si ya está en la tabla, úsalo; si prefieres la API exacta, descomenta getOne
    const row = dt
      .rows()
      .data()
      .toArray()
      .find(r => String(r.producto_id) === String(producto_id));
    // const row = (await productosAPI.getOne(producto_id))?.data;

    if (!row) throw new Error('No se pudo cargar el producto');

    $('#producto_id').value = row.producto_id || '';
    $('#nombre_producto').value = row.nombre_producto || '';
    $('#descripcion').value = row.descripcion || '';
    $('#precio_unitario').value = row.precio_unitario ?? '';
    $('#stock').value = row.stock ?? '';
    $('#categoria_id').value = row.categoria_id ?? '';
    $('#estado_producto').value = row.estado_producto || 'activo';

    modalProd.show();
    setTimeout(() => $('#nombre_producto')?.focus(), 200);
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible abrir el formulario');
  }
}

function abrirModalEliminar(id, nombre='') {
  $('#confirmId').value = id;
  $('#confirmMsg').textContent = `¿Eliminar el producto "${nombre}" (ID ${id})? Esta acción no se puede deshacer.`;
  modalConfirm.show();
}

// ====== Validación mínima del formulario ======
function validarFormulario() {
  let ok = true;

  const nombre = $('#nombre_producto');
  const precio = $('#precio_unitario');
  const stock  = $('#stock');
  const cat    = $('#categoria_id');

  // limpiar
  [nombre, precio, stock, cat].forEach(el => el.classList.remove('is-invalid'));

  if (!nombre.value.trim() || nombre.value.trim().length > 50) {
    nombre.classList.add('is-invalid'); ok = false;
  }
  const nPrecio = Number(precio.value);
  if (!Number.isFinite(nPrecio) || nPrecio < 0) { precio.classList.add('is-invalid'); ok = false; }

  const nStock = Number(stock.value);
  if (!Number.isInteger(nStock) || nStock < 0) { stock.classList.add('is-invalid'); ok = false; }

  if (!cat.value) { cat.classList.add('is-invalid'); ok = false; }

  return ok;
}

// ====== Guardar (insert/update) ======
$('#formProducto').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!validarFormulario()) return;

  const payload = {
    nombre_producto: $('#nombre_producto').value.trim(),
    descripcion: $('#descripcion').value.trim() || null,
    precio_unitario: Number($('#precio_unitario').value),
    stock: Number($('#stock').value),
    categoria_id: Number($('#categoria_id').value),
    estado_producto: $('#estado_producto').value
  };

  const producto_id = $('#producto_id').value.trim();

  try {
    if (producto_id) {
      await productosAPI.update({ producto_id, ...payload });
      showAlert('success', 'Producto actualizado correctamente');
    } else {
      await productosAPI.insert(payload);
      showAlert('success', 'Producto creado correctamente');
    }
    modalProd.hide();
    recargarProductos('all');
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible guardar el producto');
  }
});

// ====== Confirmar eliminación (hard delete) ======
$('#btnConfirmarAccion').addEventListener('click', async () => {
  const id = $('#confirmId').value;
  try {
    await productosAPI.remove(id);
    modalConfirm.hide();
    showAlert('success', 'Producto eliminado');
    recargarProductos('all');
  } catch (err) {
    showAlert('danger', err.message || 'No se pudo eliminar');
  }
});

// ====== Boot ======
(async function boot() {
  try {
    await cargarCategorias();  // llena selects usando categoriasManager
    initTabla();               // prepara DataTable
    wireFiltros();             // listeners
    await recargarProductos('all'); // primera carga
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
