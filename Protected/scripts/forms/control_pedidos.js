// UI del Panel de Control de Pedidos
import { controlPedidosAPI } from '/admin-resources/scripts/apis/controlPedidosManager.js';
import { pedidosAPI } from '/admin-resources/scripts/apis/pedidosManager.js';

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
const prd = (id) => ensurePrefix(id, 'prd-');

const fmtMoney = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v || 0));

// ===== DataTable =====
let dt;
function initTabla() {
  dt = $('#tablaLineas').DataTable({
    data: [],
    columns: [
      { data: 'producto_id' },
      { data: 'nombre_producto', defaultContent: '' },
      { data: 'cantidad' },
      { data: 'precio_unitario', render: (v) => (v == null ? '—' : fmtMoney(v)) },
      { data: null, render: (r) => fmtMoney((Number(r.cantidad)||0) * (Number(r.precio_unitario)||0)) },
      {
        data: null, orderable: false, searchable: false, className: 'text-end',
        render: (row) => {
          const id = row.producto_id;
          return `
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-more" data-id="${id}" title="+1">
                <i class="fa-solid fa-plus"></i>
              </button>
              <button class="btn btn-outline-warning btn-less" data-id="${id}" title="-1">
                <i class="fa-solid fa-minus"></i>
              </button>
              <button class="btn btn-outline-danger btn-del" data-id="${id}" title="Quitar línea">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>`;
        }
      }
    ],
    order: [[1, 'asc']],
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
  });

  $('#tablaLineas tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const pid = $('#pedidoId').value.trim();
    const prod = btn.dataset.id;
    if (!pid || !prod) return;

    if (btn.classList.contains('btn-more')) return incLinea(pid, prod, 1);
    if (btn.classList.contains('btn-less')) return decLinea(pid, prod, 1);
    if (btn.classList.contains('btn-del'))  return confirmarEliminarLinea(pid, prod);
  });
}

function pintarTotal(rows) {
  const total = rows.reduce((acc, r) => acc + (Number(r.cantidad)||0) * (Number(r.precio_unitario)||0), 0);
  $('#totalPedido').textContent = fmtMoney(total);
}

// ===== Cargar líneas del pedido =====
async function cargarPedidoDetalles(pedido_id) {
  try {
    const out = await pedidosAPI.getDetalles(pedido_id);
    const rows = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
    dt.clear().rows.add(rows).draw();
    pintarTotal(rows);
    showAlert('success', `Se cargaron ${rows.length} línea(s) del pedido ${ped(pedido_id)}.`);
  } catch (err) {
    dt.clear().draw();
    pintarTotal([]);
    showAlert('danger', err.message || 'No se pudieron cargar los detalles');
  }
}

// ===== Acciones de líneas =====
async function incLinea(pedido_id, producto_id, cantidad = 1, precio_unitario = null) {
  try {
    await controlPedidosAPI.addItem({ pedido_id, producto_id, cantidad, ...(precio_unitario!=null?{precio_unitario}: {}) });
    await cargarPedidoDetalles(pedido_id);
  } catch (err) {
    // si es stock insuficiente, muestra faltantes
    if (Array.isArray(err?.faltantes) && err.faltantes.length) {
      renderFaltantes(err.faltantes);
      new bootstrap.Modal('#modalFaltantes').show();
    } else {
      showAlert('danger', err.message || 'No fue posible agregar');
    }
  }
}

async function decLinea(pedido_id, producto_id, cantidad = 1) {
  try {
    await controlPedidosAPI.removeItem({ pedido_id, producto_id, cantidad });
    await cargarPedidoDetalles(pedido_id);
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible decrementar');
  }
}

function confirmarEliminarLinea(pedido_id, producto_id) {
  $('#confirmAccion').value = 'del_linea';
  $('#confirmProductoId').value = producto_id;
  $('#confirmCantidad').value = ''; // null → quitar toda la línea
  $('#confirmTitulo').textContent = 'Quitar línea';
  $('#confirmMsg').textContent = `¿Quitar por completo el producto ${producto_id} del pedido ${ped(pedido_id)}?`;
  new bootstrap.Modal('#modalConfirm').show();
}

$('#btnConfirmarAccion').addEventListener('click', async () => {
  const accion = $('#confirmAccion').value;
  const producto_id = $('#confirmProductoId').value;
  const cantidad = $('#confirmCantidad').value;
  const pedido_id = $('#pedidoId').value.trim();
  const modal = bootstrap.Modal.getInstance($('#modalConfirm'));

  try {
    if (accion === 'del_linea') {
      await controlPedidosAPI.removeItem({ pedido_id, producto_id /* sin cantidad → borra línea */ });
    }
    modal.hide();
    await cargarPedidoDetalles(pedido_id);
  } catch (err) {
    modal.hide();
    showAlert('danger', err.message || 'No fue posible completar la acción');
  }
});

// ===== Verificar stock =====
function renderFaltantes(list) {
  const tbody = $('#modalFaltantes #faltTbody');
  tbody.innerHTML = '';
  list.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.producto_id ?? '—'}</td>
      <td>${f.nombre_producto ?? '—'}</td>
      <td>${f.requerido ?? f.requerido_total ?? '—'}</td>
      <td>${f.disponible ?? f.stock_disponible ?? '—'}</td>`;
    tbody.appendChild(tr);
  });
}

async function verificarStock(pedido_id) {
  try {
    const out = await controlPedidosAPI.verificarProductos(pedido_id);
    const list = Array.isArray(out?.data) ? out.data : (Array.isArray(out) ? out : []);
    if (!list.length) {
      showAlert('success', 'Todo en orden: no hay faltantes.');
      return;
    }
    renderFaltantes(list);
    new bootstrap.Modal('#modalFaltantes').show();
  } catch (err) {
    showAlert('danger', err.message || 'No fue posible verificar el stock');
  }
}

// ===== Confirmar / Cancelar pedido =====
async function setEstado(pedido_id, estado) {
  try {
    const out = await controlPedidosAPI.setEstado({ pedido_id, estado });
    showAlert('success', `Estado actualizado a "${estado}".`);
    // refrescar detalle porque puede cambiar totales en trigger
    await cargarPedidoDetalles(pedido_id);
  } catch (err) {
    // si el backend valida stock insuficiente al confirmar:
    if (estado === 'Confirmado' && Array.isArray(err?.faltantes) && err.faltantes.length) {
      renderFaltantes(err.faltantes);
      new bootstrap.Modal('#modalFaltantes').show();
    } else {
      showAlert('danger', err.message || 'No fue posible actualizar el estado');
    }
  }
}

// ===== Wire de UI =====
$('#btnCargar').addEventListener('click', () => {
  const pid = $('#pedidoId').value.trim();
  if (!pid) return showAlert('warning', 'Indica un pedido.');
  cargarPedidoDetalles(pid);
});

$('#btnAgregar').addEventListener('click', async () => {
  const pid = $('#pedidoId').value.trim();
  const prod = $('#prodId').value.trim();
  const cant = Number($('#cantidad').value);
  const pvu  = $('#precioUnit').value.trim();

  if (!pid) return showAlert('warning', 'Indica un pedido.');
  if (!prod) return showAlert('warning', 'Indica un producto.');
  if (!Number.isInteger(cant) || cant < 1) return showAlert('warning', 'Cantidad inválida.');

  await incLinea(pid, prod, cant, pvu === '' ? null : Number(pvu));
});

$('#btnVerificar').addEventListener('click', () => {
  const pid = $('#pedidoId').value.trim();
  if (!pid) return showAlert('warning', 'Indica un pedido.');
  verificarStock(pid);
});

$('#btnConfirmar').addEventListener('click', () => {
  const pid = $('#pedidoId').value.trim();
  if (!pid) return showAlert('warning', 'Indica un pedido.');
  $('#confirmAccion').value = 'estado';
  $('#confirmProductoId').value = '';
  $('#confirmCantidad').value = '';
  $('#confirmTitulo').textContent = 'Confirmar pedido';
  $('#confirmMsg').textContent = `¿Confirmar el pedido ${ped(pid)}?`;
  const modal = new bootstrap.Modal('#modalConfirm');
  modal.show();
  $('#btnConfirmarAccion').onclick = async () => { // rewire para esta acción
    modal.hide();
    await setEstado(pid, 'Confirmado');
  };
});

$('#btnCancelar').addEventListener('click', () => {
  const pid = $('#pedidoId').value.trim();
  if (!pid) return showAlert('warning', 'Indica un pedido.');
  $('#confirmAccion').value = 'estado';
  $('#confirmProductoId').value = '';
  $('#confirmCantidad').value = '';
  $('#confirmTitulo').textContent = 'Cancelar pedido';
  $('#confirmMsg').textContent = `¿Cancelar el pedido ${ped(pid)}?`;
  const modal = new bootstrap.Modal('#modalConfirm');
  modal.show();
  $('#btnConfirmarAccion').onclick = async () => {
    modal.hide();
    await setEstado(pid, 'Cancelado');
  };
});

// ===== Boot =====
(function boot() {
  initTabla();
  // si llegas con ?ped=... en la URL, auto-carga
  const url = new URL(location.href);
  const q = url.searchParams.get('ped');
  if (q && q.trim()) {
    $('#pedidoId').value = q.trim();
    $('#btnCargar').click();
  }
})();
