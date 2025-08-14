// UI Reportes
import { reportesAPI } from '/admin-resources/scripts/apis/reportesManager.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
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
const cli = (id) => ensurePrefix(id, 'cl-');

const fmtMoney = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v || 0));
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString('es-MX');
};

// ====== DataTables ======
let dtPivot, dtTop, dtClientes, dtHist;

function initTables() {
  dtPivot = $('#tablaPivot').DataTable({
    data: [],
    columns: [
      { data: 'periodo' },
      { data: 'ventas', render: v => v ?? 0 },
      { data: 'importe', render: v => fmtMoney(v) }
    ],
    order: [[0, 'asc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  dtTop = $('#tablaTop').DataTable({
    data: [],
    columns: [
      { data: 'rank' },
      { data: 'producto' },
      { data: 'unidades' },
      { data: 'importe', render: v => fmtMoney(v) }
    ],
    order: [[0, 'asc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  dtClientes = $('#tablaClientes').DataTable({
    data: [],
    columns: [
      { data: 'cliente_id' },
      { data: 'cuenta_email' },
      { data: 'pedidos' },
      { data: 'importe', render: v => fmtMoney(v) }
    ],
    order: [[2, 'desc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  dtHist = $('#tablaHistorial').DataTable({
    data: [],
    columns: [
      { data: 'pedido_id' },
      { data: 'fecha', render: v => fmtDate(v) },
      { data: 'estado' },
      { data: 'importe', render: v => fmtMoney(v) }
    ],
    order: [[1, 'desc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });
}

// ====== Charts ======
let chPivot, chTop, chClientes;
function resetChart(refName) {
  if (refName && refName.destroy) refName.destroy();
}

// ====== Mapeos tolerantes ======
function mapPivotRow(r) {
  const anio   = r.anio ?? r.year ?? r.y ?? r.Año ?? r['Año'] ?? null;
  const mesNum = r.mes ?? r.month ?? r.m ?? r.Mes ?? r['Mes'] ?? null;
  const mesTxt = r.mes_texto ?? r.month_name ?? null;
  const periodo = mesTxt
    ? `${anio ?? ''}-${mesTxt}`
    : (anio != null && mesNum != null
        ? `${anio}-${String(mesNum).padStart(2, '0')}`
        : (r.periodo ?? r['Año-Mes'] ?? '—'));
  const ventas  = r.ventas ?? r.orders ?? r.pedidos ?? r.cantidad ?? r.total_ventas ?? 0;
  const importe = r.importe ?? r.monto ?? r.total ?? r.importe_total ?? r.monto_total ?? 0;
  return { periodo, ventas: Number(ventas)||0, importe: Number(importe)||0 };
}

function mapTopRow(r, idx) {
  const producto_id = r.producto_id ?? r.id_producto ?? r.producto ?? r.codigo ?? '';
  const nombre = r.nombre_producto ?? r.nombre ?? r.producto_nombre ?? `Producto ${producto_id || idx+1}`;
  const unidades = r.unidades ?? r.cantidad ?? r.total_unidades ?? r.total_vendido ?? r.pedidos ?? 0;
  const importe  = r.importe ?? r.total ?? r.monto ?? r.importe_total ?? 0;
  return {
    rank: idx + 1,
    producto: `${nombre} (${producto_id||'—'})`,
    unidades: Number(unidades)||0,
    importe: Number(importe)||0
  };
}

function mapClienteRow(r) {
  const cliente_id = r.cliente_id ?? r.id_cliente ?? r.cliente ?? '—';
  const cuenta = r.cuenta ?? r.username ?? null;
  const email  = r.email ?? r.correo ?? null;
  const pedidos = r.pedidos ?? r.ordenes ?? r.frecuencia ?? r.total_pedidos ?? 0;
  const importe = r.importe ?? r.total ?? r.monto ?? r.total_facturado ?? 0;
  return {
    cliente_id,
    cuenta_email: cuenta || email ? `${cuenta||''}${cuenta&&email?' · ':''}${email||''}` : '—',
    pedidos: Number(pedidos)||0,
    importe: Number(importe)||0
  };
}

function mapHistRow(r) {
  const pedido_id = r.pedido_id ?? r.id_pedido ?? r.pedido ?? '—';
  const fecha = r.fecha ?? r.fecha_pedido ?? r.creado ?? r.created_at ?? null;
  const estado = r.estado ?? r.estado_pedido ?? '—';
  const importe = r.importe ?? r.total ?? r.monto ?? r.importe_total ?? 0;
  return { pedido_id, fecha, estado, importe: Number(importe)||0 };
}

// ====== Fechas ======
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfYearISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  return `${yyyy}-01-01`;
}

// ====== Cargas ======
async function cargarPivot() {
  const desde = $('#desde').value || '';
  const hasta = $('#hasta').value || '';
  const resp = await reportesAPI.ventasMensualPivot(desde, hasta);
  const list = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
  const rows = list.map(mapPivotRow);

  dtPivot.clear().rows.add(rows).draw();

  // Chart
  resetChart(chPivot);
  const ctx = $('#chartPivot').getContext('2d');
  chPivot = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rows.map(r => r.periodo),
      datasets: [
        { label: 'Importe', data: rows.map(r => r.importe) },
        { label: 'Ventas', data: rows.map(r => r.ventas) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });
}

async function cargarTop() {
  const desde = $('#desde').value || '';
  const hasta = $('#hasta').value || '';
  const limit = Number($('#limitTop').value || 10);
  const resp = await reportesAPI.topVentas(desde, hasta, limit);
  const list = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
  const rows = list.map(mapTopRow);

  dtTop.clear().rows.add(rows).draw();

  resetChart(chTop);
  const ctx = $('#chartTop').getContext('2d');
  chTop = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.producto),
      datasets: [{ label: 'Importe', data: rows.map(r => r.importe) }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true } }
    }
  });
}

async function cargarClientes() {
  const desde = $('#desde').value || '';
  const hasta = $('#hasta').value || '';
  const resp = await reportesAPI.clientesFrecuencia(desde, hasta);
  const list = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
  const rows = list.map(mapClienteRow);

  dtClientes.clear().rows.add(rows).draw();

  // top 15 por pedidos para el gráfico
  const top = [...rows].sort((a,b) => b.pedidos - a.pedidos).slice(0, 15);
  resetChart(chClientes);
  const ctx = $('#chartClientes').getContext('2d');
  chClientes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(r => r.cliente_id),
      datasets: [{ label: 'Pedidos', data: top.map(r => r.pedidos) }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true } }
    }
  });
}

async function cargarHistorial() {
  const cliente_id = cli($('#histCliente').value.trim());
  if (!cliente_id) return showAlert('warning', 'Indica un cliente.');
  const desde = $('#histDesde').value || '';
  const hasta = $('#histHasta').value || '';
  const resp = await reportesAPI.historialCliente(cliente_id, desde, hasta);
  const list = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
  const rows = list.map(mapHistRow);
  dtHist.clear().rows.add(rows).draw();
  showAlert('success', `Historial cargado (${rows.length} pedido(s)).`);
}

// ====== Wire ======
$('#btnAplicarFechas').addEventListener('click', async () => {
  try {
    await Promise.all([cargarPivot(), cargarTop(), cargarClientes()]);
    showAlert('success', 'Reportes actualizados.');
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible actualizar los reportes');
  }
});

$('#btnLimpiarFechas').addEventListener('click', () => {
  $('#desde').value = '';
  $('#hasta').value = '';
});

$('#btnRefrescarTop').addEventListener('click', cargarTop);
$('#btnBuscarHist').addEventListener('click', cargarHistorial);

// ====== Boot ======
(function boot() {
  initTables();

  // por defecto: año corriente
  $('#desde').value = firstDayOfYearISO();
  $('#hasta').value = todayISO();

  // inicial
  $('#btnAplicarFechas').click();
})();
