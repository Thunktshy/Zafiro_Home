// UI del Panel de Promociones
import { categoriasAPI } from '/admin-resources/scripts/apis/categoriesManager.js';
import { productosAPI } from '/admin-resources/scripts/apis/productosManager.js';
import { promocionesAPI } from '/admin-resources/scripts/apis/promocionesManager.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const alertBox = $('#alertBox');

function showAlert(type, msg, autoHideMs = 4000) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
  if (autoHideMs) setTimeout(() => alertBox.classList.add('d-none'), autoHideMs);
}

const fmtMoney = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v || 0));
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString('es-MX');
};

const ensurePrefix = (v, prefix) => {
  const s = String(v ?? '').trim();
  return s && !s.startsWith(prefix) ? `${prefix}${s}` : s;
};
const prd = (id) => ensurePrefix(id, 'prd-');

// Mapa producto_id -> categoria_id y nombre de producto
const productMeta = new Map(); // key: producto_id (string) -> { categoria_id:number, nombre:string }
const categoryNameById = new Map(); // key: categoria_id (number) -> nombre

// ===== DataTable =====
let dt;
function initTabla() {
  dt = $('#tablaPromos').DataTable({
    data: [],
    columns: [
      { data: 'producto_id', render: v => v ?? '—' },
      { data: 'nombre_producto', render: v => v ?? '—' },
      { data: 'categoria_nombre', render: v => v ?? '—' },
      { data: 'promo_nombre', render: v => v ?? '—' },
      { data: 'tipo', render: v => v ?? '—' },
      { data: 'valor', render: v => v == null ? '—' : v },
      { data: 'precio_original', render: v => v == null ? '—' : fmtMoney(v) },
      { data: 'precio_promocional', render: v => v == null ? '—' : fmtMoney(v) },
      { data: 'vigencia', render: v => v ?? '—' },
      {
        data: null, orderable: false, searchable: false, className: 'text-end',
        render: (row) => {
          const json = encodeURIComponent(JSON.stringify(row._raw || row, null, 2));
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-detalle" data-json="${json}">
                <i class="fa-solid fa-circle-info"></i> Detalle
              </button>
            </div>`;
        }
      }
    ],
    order: [[1, 'asc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  $('#tablaPromos tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button.btn-detalle');
    if (!btn) return;
    try {
      $('#detalleJSON').textContent = decodeURIComponent(btn.dataset.json);
      new bootstrap.Modal('#modalDetalle').show();
    } catch {
      $('#detalleJSON').textContent = 'No fue posible mostrar el detalle.';
      new bootstrap.Modal('#modalDetalle').show();
    }
  });
}

// ===== Carga de catálogos =====
async function cargarCategorias() {
  const list = await categoriasAPI.getList(); // [{categoria_id, nombre_categoria}]
  const sel = $('#filtroCategoria');
  list.forEach(c => {
    categoryNameById.set(Number(c.categoria_id), c.nombre_categoria);
    const opt = document.createElement('option');
    opt.value = String(c.categoria_id);
    opt.textContent = c.nombre_categoria;
    sel.appendChild(opt);
  });
}

async function cargarProductosInicial() {
  const all = await productosAPI.getAll(); // trae categoria_id
  const sel = $('#filtroProducto');
  all.forEach(p => {
    const pid = String(p.producto_id ?? p.id ?? '').trim();
    const nombre = p.nombre_producto ?? p.nombre ?? `Producto ${pid}`;
    const catid = Number(p.categoria_id ?? 0);
    productMeta.set(pid, { categoria_id: catid, nombre });
    const opt = document.createElement('option');
    opt.value = pid;
    opt.textContent = `${nombre} (${pid})`;
    sel.appendChild(opt);
  });
}

// Si cambia la categoría, filtramos opciones de producto (client-side)
$('#filtroCategoria').addEventListener('change', () => {
  const catid = Number($('#filtroCategoria').value || 0);
  const sel = $('#filtroProducto');
  const current = sel.value;
  sel.innerHTML = '<option value="">(Todos)</option>';
  for (const [pid, meta] of productMeta.entries()) {
    if (!catid || meta.categoria_id === catid) {
      const opt = document.createElement('option');
      opt.value = pid;
      opt.textContent = `${meta.nombre} (${pid})`;
      sel.appendChild(opt);
    }
  }
  // si el valor actual sigue siendo válido, mantenerlo
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
});

// ===== Transformación robusta de respuesta =====
function mapPromoRow(raw) {
  // Intentar diferentes nombres de campos
  const producto_id = prd(raw.producto_id ?? raw.id_producto ?? raw.producto ?? '');
  const nombre_producto = raw.nombre_producto ?? raw.producto_nombre ?? productMeta.get(String(raw.producto_id))?.nombre ?? '—';

  // metas de categoría
  const meta = productMeta.get(String(raw.producto_id)) || productMeta.get(producto_id) || {};
  const categoria_id = Number(raw.categoria_id ?? meta.categoria_id ?? 0);
  const categoria_nombre = categoryNameById.get(categoria_id) || (categoria_id ? `Cat ${categoria_id}` : '—');

  // info promo
  const promo_nombre = raw.promo_nombre ?? raw.nombre_promocion ?? raw.promocion ?? '—';
  const tipo = raw.tipo ?? raw.tipo_descuento ?? raw.modalidad ?? '—';
  const valor = raw.valor ?? raw.descuento ?? raw.monto ?? null;

  // precios (si existen)
  const precio_original = raw.precio_original ?? raw.precio_base ?? null;
  const precio_promocional = raw.precio_promocional ?? raw.precio_final ?? null;

  // vigencia
  const ini = raw.inicio ?? raw.fecha_inicio ?? raw.vigencia_inicio ?? null;
  const fin = raw.fin ?? raw.fecha_fin ?? raw.vigencia_fin ?? null;
  const vigencia = ini || fin ? `${fmtDate(ini)} – ${fmtDate(fin)}` : (raw.vigencia ?? '—');

  return {
    _raw: raw,
    producto_id, nombre_producto, categoria_id, categoria_nombre,
    promo_nombre, tipo, valor, precio_original, precio_promocional, vigencia
  };
}

// ===== Carga de promociones con filtros =====
async function cargarPromos() {
  try {
    const fecha = $('#filtroFecha').value || null;
    const catid = Number($('#filtroCategoria').value || 0);
    const prod = $('#filtroProducto').value || '';

    const resp = await promocionesAPI.activasPorProducto(fecha || undefined);
    const list = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
    const rows = list.map(mapPromoRow)
      .filter(r => (!catid || r.categoria_id === catid) && (!prod || r.producto_id === prod));

    dt.clear().rows.add(rows).draw();
    showAlert('success', `Se cargaron ${rows.length} promoción(es) vigentes${fecha ? ` para ${fmtDate(fecha)}` : ' hoy'}.`);
  } catch (err) {
    dt?.clear().draw();
    showAlert('danger', err.message || 'No fue posible cargar las promociones');
  }
}

// ===== Botones =====
$('#btnBuscar').addEventListener('click', cargarPromos);
$('#btnRefrescar').addEventListener('click', cargarPromos);
$('#btnLimpiar').addEventListener('click', () => {
  $('#filtroFecha').value = '';
  $('#filtroCategoria').value = '';
  $('#filtroProducto').value = '';
  cargarPromos();
});

// ===== Boot =====
(async function boot() {
  initTabla();

  // fecha por defecto = hoy (local)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  $('#filtroFecha').value = `${yyyy}-${mm}-${dd}`;

  try {
    await Promise.all([cargarCategorias(), cargarProductosInicial()]);
    await cargarPromos();
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
