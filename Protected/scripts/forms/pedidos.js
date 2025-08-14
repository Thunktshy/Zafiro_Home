// UI del Panel de Pedidos
import { pedidosAPI, confirmarConVerificacion } from '/admin-resources/scripts/apis/pedidosManager.js';
import { controlPedidosAPI } from '/admin-resources/scripts/apis/controlPedidosManager.js';

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
const ped = (id) => ensurePrefix(id, 'ped-');
const cli = (id) => ensurePrefix(id, 'cl-');

const fmtMoney = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v || 0));
const fmtDate  = (v) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleString('es-MX') : (v || '—');
};

let dt; // DataTable

function initTabla() {
  dt = $('#tablaPedidos').DataTable({
    data: [],
    columns: [
      { data: 'pedido_id', render: (v) => v || '—' },
      { data: 'cliente_id', render: (v) => v || '—' },
      { data: 'estado_pedido', render: (v) => v || '—' },
      { data: 'fecha_pedido', render: (v) => fmtDate(v) },
      { data: 'total_pedido', render: (v) => (v == null ? '—' : fmtMoney(v)) },
      {
        data: null,
        orderable: false,
        searchable: false,
        className: 'text-end',
        render: (row) => {
          const id = row.pedido_id;
          const estado = (row.estado_pedido || '').toLowerCase();
          const btnDet = `<button class="btn btn-outline-secondary btn-sm me-2 btn-detalles" data-id="${id}">
                            <i class="fa-solid fa-list"></i>
                          </button>`;
          const btnConf = estado === 'por confirmar'
            ? `<button class="btn btn-primary btn-sm me-2 btn-confirmar" data-id="${id}">
                 <i class="fa-solid fa-check"></i>
               </button>` : '';
          const btnCanc = estado !== 'cancelado'
            ? `<button class="btn btn-outline-danger btn-sm btn-cancelar" data-id="${id}">
                 <i class="fa-solid fa-xmark"></i>
               </button>` : '';
          return `<div class="btn-group" role="group">${btnDet}${btnConf}${btnCanc}</div>`;
        }
      }
    ],
    order: [[3, 'desc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  // Delegación
  $('#tablaPedidos tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('btn-detalles')) abrirDetalles(id);
    else if (btn.classList.contains('btn-confirmar')) abrirConfirm('confirmar', id);
    else if (btn.classList.contains('btn-cancelar')) abrirConfirm('cancelar', id);
  });
}

async function recargarPedidos() {
  try {
    const pid = $('#filtroPedidoId').value.trim();
    const cid = $('#filtroClienteId').value.trim();
    const est = $('#filtroEstado').value;

    let data;
    if (pid) {
      data = await pedidosAPI.getOne(ped(pid));
      const row = data?.data ? [data.data] : (Array.isArray(data) ? data : []);
      dt.clear().rows.add(row).draw();
      showAlert('success', row.length ? '1 pedido encontrado.' : 'Sin resultados.');
      return;
    }
    if (cid) {
      data = await pedidosAPI.getByCliente(cli(cid));
    } else if (est) {
      data = await pedidosAPI.getByEstado(est);
    } else {
      // por defecto mostrar "Por confirmar"
      data = await pedidosAPI.getByEstado('Por confirmar');
      $('#filtroEstado').value = 'Por confirmar';
    }

    const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    dt.clear().rows.add(rows).draw();
    showAlert('success', `Se cargaron ${rows.length} pedido(s).`);
  } catch (err) {
    showAlert('danger', err.message || 'No se pudieron cargar los pedidos');
  }
}

// Filtros
$('#btnAplicarFiltros').addEventListener('click', recargarPedidos);
$('#btnLimpiarFiltros').addEventListener('click', () => {
  $('#filtroPedidoId').value = '';
  $('#filtroClienteId').value = '';
  $('#filtroEstado').value = 'Por confirmar';
  recargarPedidos();
});

// Nuevo pedido
const modalNuevo = new bootstrap.Modal('#modalNuevoPedido');
$('#btnNuevoPedido').addEventListener('click', () => {
  $('#npClienteId').value = '';
  $('#npMetodoPago').value = '';
  $$('#formNuevoPedido .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  modalNuevo.show();
});
$('#formNuevoPedido').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const cid = $('#npClienteId').value.trim();
  const mp  = $('#npMetodoPago').value.trim() || null;
  if (!cid) { $('#npClienteId').classList.add('is-invalid'); return; }
  try {
    const out = await pedidosAPI.insert({ cliente_id: cli(cid), metodo_pago: mp });
    modalNuevo.hide();
    const pedId = out?.data?.pedido_id || out?.pedido_id;
    showAlert('success', `Pedido creado${pedId ? ' (' + pedId + ')' : ''}.`);
    recargarPedidos();
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible crear el pedido');
  }
});

// Detalles
const modalDet = new bootstrap.Modal('#modalDetalles');
async function abrirDetalles(pedido_id) {
  $('#detPedidoId').textContent = ped(pedido_id);
  const tbody = $('#detTbody'); tbody.innerHTML = '';
  try {
    const out = await pedidosAPI.getDetalles(pedido_id);
    const rows = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const importe = Number(r.cantidad || 0) * Number(r.precio_unitario || 0);
      tr.innerHTML = `
        <td>${r.producto_id ?? '—'}</td>
        <td>${r.nombre_producto ?? '—'}</td>
        <td>${r.cantidad ?? '—'}</td>
        <td>${r.precio_unitario != null ? fmtMoney(r.precio_unitario) : '—'}</td>
        <td>${fmtMoney(importe)}</td>`;
      tbody.appendChild(tr);
    });
    modalDet.show();
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible cargar los detalles');
  }
}

// Confirmar / Cancelar
const modalConfirm = new bootstrap.Modal('#modalConfirm');
function abrirConfirm(accion, pedido_id) {
  $('#confirmAccion').value = accion;
  $('#confirmPedidoId').value = pedido_id;
  $('#confirmTitulo').textContent = accion === 'confirmar' ? 'Confirmar pedido' : 'Cancelar pedido';
  $('#confirmMsg').textContent = accion === 'confirmar'
    ? `¿Confirmar el pedido ${ped(pedido_id)}?`
    : `¿Cancelar el pedido ${ped(pedido_id)}?`;
  modalConfirm.show();
}

$('#btnConfirmarAccion').addEventListener('click', async () => {
  const accion = $('#confirmAccion').value;
  const pedido_id = $('#confirmPedidoId').value;
  try {
    if (accion === 'confirmar') {
      await confirmarConVerificacion(pedido_id, pedidosAPI, controlPedidosAPI);
      showAlert('success', 'Pedido confirmado.');
    } else {
      await pedidosAPI.cancelar(pedido_id);
      showAlert('success', 'Pedido cancelado.');
    }
    modalConfirm.hide();
    recargarPedidos();
  } catch (err) {
    modalConfirm.hide();
    // si vino de confirmar y hay faltantes de stock, mostramos modal específico
    if (accion === 'confirmar' && Array.isArray(err?.faltantes) && err.faltantes.length) {
      const tbody = $('#faltTbody'); tbody.innerHTML = '';
      err.faltantes.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${f.producto_id ?? '—'}</td>
          <td>${f.nombre_producto ?? '—'}</td>
          <td>${f.requerido ?? '—'}</td>
          <td>${f.disponible ?? '—'}</td>`;
        tbody.appendChild(tr);
      });
      new bootstrap.Modal('#modalFaltantes').show();
    } else {
      showAlert('danger', err.message || 'No fue posible completar la acción');
    }
  }
});

// Boot
(async function boot() {
  try {
    initTabla();
    await recargarPedidos();
  } catch (err) {
    showAlert('danger', err.message || 'Error inicializando el panel');
  }
})();
