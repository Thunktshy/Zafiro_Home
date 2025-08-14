import { categoriasAPI } from '/admin-resources/scripts/apis/categoriasManager.js';
import { gestionStockAlertasAPI } from '/admin-resources/scripts/apis/gestion_stock_y_alertasManager.js';

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

const ensurePrefix = (v, prefix) => {
  const s = String(v ?? '').trim();
  return s && !s.startsWith(prefix) ? `${prefix}${s}` : s;
};
const prd = (id) => ensurePrefix(id, 'prd-');
const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleString('es-MX') : (v || '—');
};

// ===== Estado =====
let dt;               // DataTable instancia
let categorias = [];  // [{categoria_id,nombre_categoria}]
const catMap = new Map();

// ===== Cargar categorías en filtros y modales =====
async function cargarCategorias() {
  const res = await categoriasAPI.getList();
  const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
  categorias = list;
  catMap.clear();
  list.forEach(c => catMap.set(Number(c.categoria_id), c.nombre_categoria));

  const selFiltro = $('#filtroCategoria');
  const selPrecio = $('#categoriaPrecio');

  [selFiltro, selPrecio].forEach(sel => {
    sel.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
    list.forEach(({ categoria_id, nombre_categoria }) => {
      const opt = document.createElement('option');
      opt.value = String(categoria_id);
      opt.textContent = `${nombre_categoria} (ID ${categoria_id})`;
      sel.appendChild(opt);
    });
  });
}

// ===== DataTable de logs =====
function initTabla() {
  dt = $('#tablaLogs').DataTable({
    data: [],
    columns: [
      { data: null, render: r => fmtDate(r.fecha || r.fecha_evento || r.created_at) },
      { data: null, render: r => r.producto_id || '—' },
      { data: null, render: r => r.categoria_id ?? '—' },
      { data: null, render: r => r.accion || r.tipo || '—' },
      { data: null, render: r => r.cantidad ?? r.delta ?? r.cambio ?? '—' },
      { data: null, render: r => r.nuevo_stock ?? r.stock ?? '—' },
      { data: null, render: r => r.usuario || r.user || '—' },
      { data: null, render: r => r.mensaje || r.comentario || '—' }
    ],
    order: [[0, 'desc']],
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json'
    }
  });
}

// ===== Recarga de logs según filtros =====
async function recargarLogs() {
  try {
    const prod = $('#filtroProducto').value.trim();
    const cat  = $('#filtroCategoria').value.trim();
    const d    = $('#filtroDesde').value;
    const h    = $('#filtroHasta').value;

    let data;
    if (prod) {
      data = (d || h)
        ? await gestionStockAlertasAPI.logsGetByProductoRango(prd(prod), d || '', h || '')
        : await gestionStockAlertasAPI.logsGetByProducto(prd(prod));
    } else if (cat) {
      data = (d || h)
        ? await gestionStockAlertasAPI.logsGetByCategoriaRango(Number(cat), d || '', h || '')
        : await gestionStockAlertasAPI.logsGetByCategoria(Number(cat));
    } else if (d || h) {
      data = await gestionStockAlertasAPI.logsGetByRango(d || '', h || '');
    } else {
      data = await gestionStockAlertasAPI.logsGetAll();
    }

    const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    dt.clear().rows.add(rows).draw();
    showAlert('success', `Se cargaron ${rows.length} registros.`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron cargar los logs');
  }
}

// ===== Wire de filtros =====
function wireFiltros() {
  $('#btnAplicarFiltros').addEventListener('click', recargarLogs);
  $('#btnLimpiarFiltros').addEventListener('click', () => {
    $('#filtroProducto').value = '';
    $('#filtroCategoria').value = '';
    $('#filtroDesde').value = '';
    $('#filtroHasta').value = '';
    recargarLogs();
  });
}

// ===== Modales y envíos =====
const modalStock    = new bootstrap.Modal('#modalStock');
const modalAlertas  = new bootstrap.Modal('#modalAlertas');
const modalPrecios  = new bootstrap.Modal('#modalPrecios');

// --- Stock ---
$('#btnAgregarStock').addEventListener('click', () => {
  $('#stockAccion').value = 'agregar';
  $('#modalStockTitulo').textContent = 'Agregar stock';
  $('#stockProductoId').value = '';
  $('#stockCantidad').value = '';
  $$('#formStock .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  modalStock.show();
});

$('#btnReducirStock').addEventListener('click', () => {
  $('#stockAccion').value = 'reducir';
  $('#modalStockTitulo').textContent = 'Reducir stock';
  $('#stockProductoId').value = '';
  $('#stockCantidad').value = '';
  $$('#formStock .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  modalStock.show();
});

$('#formStock').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const producto_id = $('#stockProductoId').value.trim();
  const cantidad    = Number($('#stockCantidad').value);

  let ok = true;
  $$('#formStock .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  if (!producto_id) { $('#stockProductoId').classList.add('is-invalid'); ok = false; }
  if (!Number.isInteger(cantidad) || cantidad < 1) { $('#stockCantidad').classList.add('is-invalid'); ok = false; }
  if (!ok) return;

  try {
    const accion = $('#stockAccion').value;
    if (accion === 'agregar') {
      await gestionStockAlertasAPI.stockAgregar({ producto_id: prd(producto_id), cantidad });
    } else {
      await gestionStockAlertasAPI.stockReducir({ producto_id: prd(producto_id), cantidad });
    }
    modalStock.hide();
    showAlert('success', `Stock ${accion === 'agregar' ? 'agregado' : 'reducido'} correctamente`);
    recargarLogs();
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible ajustar el stock');
  }
});

// --- Alertas ---
$('#btnGenerarAlertas').addEventListener('click', () => {
  $('#umbralGlobal').value = 5;
  $('#soloActivos').checked = true;
  $$('#formAlertas .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  modalAlertas.show();
});

$('#formAlertas').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const umbral = Number($('#umbralGlobal').value);
  if (!Number.isInteger(umbral) || umbral < 1) {
    $('#umbralGlobal').classList.add('is-invalid'); return;
  }
  try {
    await gestionStockAlertasAPI.alertasGenerar({ umbral_global: umbral, solo_activos: $('#soloActivos').checked ? 1 : 0 });
    modalAlertas.hide();
    showAlert('success', 'Alertas generadas.');
    recargarLogs();
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible generar alertas');
  }
});

// --- Precios masivos ---
function togglePrecioInputs() {
  const tipo = document.querySelector('input[name="tipoPrecio"]:checked')?.value;
  const grpMonto = $('#grupoMonto'), grpPct = $('#grupoPorcentaje');
  if (tipo === 'descuento') {
    grpMonto.classList.add('d-none');
    grpPct.classList.remove('d-none');
  } else {
    grpPct.classList.add('d-none');
    grpMonto.classList.remove('d-none');
  }
}
$$('input[name="tipoPrecio"]').forEach(r => r.addEventListener('change', togglePrecioInputs));
$('#btnPreciosMasivos').addEventListener('click', () => {
  $('#precioIncrementar').checked = true;
  $('#monto').value = '';
  $('#porcentaje').value = '';
  $('#categoriaPrecio').value = '';
  $('#soloActivosPrecio').checked = true;
  togglePrecioInputs();
  modalPrecios.show();
});

$('#formPrecios').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const tipo = document.querySelector('input[name="tipoPrecio"]:checked')?.value;
  const categoria_id = $('#categoriaPrecio').value ? Number($('#categoriaPrecio').value) : null;
  const soloActivos  = $('#soloActivosPrecio').checked ? 1 : 0;

  try {
    if (tipo === 'descuento') {
      const pct = Number($('#porcentaje').value);
      if (!(pct > 0 && pct <= 100)) { $('#porcentaje').classList.add('is-invalid'); return; }
      await gestionStockAlertasAPI.preciosAgregarDescuento({ porcentaje: pct, categoria_id, solo_activos: soloActivos });
    } else {
      const monto = Number($('#monto').value);
      if (!(monto > 0)) { $('#monto').classList.add('is-invalid'); return; }
      if (tipo === 'incrementar') {
        await gestionStockAlertasAPI.preciosIncrementar({ monto, categoria_id, solo_activos: soloActivos });
      } else {
        await gestionStockAlertasAPI.preciosReducir({ monto, categoria_id, solo_activos: soloActivos });
      }
    }
    modalPrecios.hide();
    showAlert('success', 'Actualización de precios aplicada.');
    recargarLogs();
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible actualizar precios');
  }
});

// ===== Boot =====
(async function boot() {
  try {
    await cargarCategorias();
    initTabla();
    wireFiltros();
    await recargarLogs();
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
