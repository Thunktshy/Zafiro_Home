// scripts/forms/control_pedidos.js
// Panel de Control de Pedidos: agregar/quitar ítems, verificar stock y cambiar estado.
// Requiere: controlPedidosAPI y pedidosAPI

import { controlPedidosAPI } from '/admin-resources/scripts/apis/controlPedidosManager.js';
import { pedidosAPI } from '/admin-resources/scripts/apis/pedidosManager.js';

// Utils
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const money = (n) => (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const ensureStr = (v) => String(v ?? '').trim();
const qs = (name) => new URL(location.href).searchParams.get(name);

function showAlert(kind, msg) {
  const box = $('#alertBox');
  box.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-info', 'alert-warning');
  box.classList.add(`alert-${kind}`);
  box.innerHTML = msg;
  setTimeout(() => box.classList.add('d-none'), 4000);
}

function unpack(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (typeof response === 'object' && Array.isArray(response.data)) return response.data;
  return [];
}

let tabla; // DataTable
let modalStock; // Modal bootstrap
let currentPedidoId = null;
let currentHeader = null;

const COL_INDEX = { producto_id: 0, nombre_producto: 1, cantidad: 2, precio_unitario: 3, subtotal: 4 };

function badgeEstado(estado) {
  const e = String(estado || '').toLowerCase();
  const map = { 'por confirmar': 'bg-warning text-dark', 'confirmado': 'bg-success', 'cancelado': 'bg-secondary' };
  return `<span class="badge ${map[e] || 'bg-light text-dark'}">${estado || '—'}</span>`;
}

function setButtonsEnabled(canEdit) {
  $('#btnAgregar').disabled = !canEdit;
  $('#btnVerificar').disabled = !currentPedidoId;
  $('#btnSetPorConfirmar').disabled = !currentPedidoId || (currentHeader?.estado_pedido === 'Por confirmar');
  $('#btnConfirmar').disabled = !currentPedidoId || !canEdit; // Confirmar solo si está por confirmar
  $('#btnCancelar').disabled = !currentPedidoId || (currentHeader?.estado_pedido === 'Cancelado');
}

function configurarTabla() {
  if (tabla) {
    tabla.destroy();
    $('#tablaDetalle tbody').innerHTML = '';
  }
  tabla = new DataTable('#tablaDetalle', {
    paging: true,
    pageLength: 10,
    lengthChange: false,
    ordering: true,
    order: [[COL_INDEX.producto_id, 'asc']],
    searching: true,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columns: [
      { data: 'producto_id' },
      { data: 'nombre_producto', defaultContent: '' },
      { data: 'cantidad' },
      { data: 'precio_unitario', render: (v) => money(v) },
      { data: 'subtotal', render: (v) => money(v) },
      {
        data: null,
        orderable: false,
        searchable: false,
        className: 'text-end',
        render: (_v, _t, row) => `
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-secondary" data-action="dec" data-id="${row.producto_id}"><i class="bi bi-dash"></i></button>
            <button class="btn btn-outline-secondary" data-action="inc" data-id="${row.producto_id}"><i class="bi bi-plus"></i></button>
            <button class="btn btn-outline-danger" data-action="del" data-id="${row.producto_id}"><i class="bi bi-trash"></i></button>
          </div>`
      }
    ]
  });

  // Delegación de eventos
  $('#tablaDetalle tbody').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const pid = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!currentPedidoId) return;

    try {
      if (action === 'inc') {
        await controlPedidosAPI.addItem({ pedido_id: currentPedidoId, producto_id: pid, cantidad: 1 });
      } else if (action === 'dec') {
        await controlPedidosAPI.removeItem({ pedido_id: currentPedidoId, producto_id: pid, cantidad: 1 });
      } else if (action === 'del') {
        await controlPedidosAPI.removeItem({ pedido_id: currentPedidoId, producto_id: pid, cantidad: null });
      }
      await refrescarDetalles();
      showAlert('success', 'Pedido actualizado.');
    } catch (err) {
      console.error('detalle acción error:', err);
      showAlert('danger', err.message || 'No se pudo actualizar el detalle');
    }
  });
}

function renderHeader() {
  $('#h_pedido_id').textContent = currentHeader?.pedido_id ?? '—';
  $('#h_cliente_id').textContent = currentHeader?.cliente_id ?? '—';
  $('#h_fecha_pedido').textContent = currentHeader?.fecha_pedido ? new Date(currentHeader.fecha_pedido).toLocaleString('es-MX') : '—';
  $('#h_estado').outerHTML = badgeEstado(currentHeader?.estado_pedido ?? '—');
  $('#h_total').textContent = money(currentHeader?.total_pedido ?? 0);
  $('#h_metodo_pago').textContent = currentHeader?.metodo_pago ?? '—';

  const canEdit = (currentHeader?.estado_pedido === 'Por confirmar');
  setButtonsEnabled(canEdit);
}

async function refrescarDetalles() {
  if (!currentPedidoId) return;
  // detalles con join para obtener nombre_producto
  const detalles = unpack(await pedidosAPI.getDetalles(currentPedidoId));
  // Normaliza subtotal si no viene
  detalles.forEach(d => d.subtotal = d.subtotal ?? (Number(d.cantidad) * Number(d.precio_unitario)));
  tabla.clear();
  tabla.rows.add(detalles).draw();
}

async function cargarPedido(id) {
  try {
    currentPedidoId = ensureStr(id);
    if (!currentPedidoId) throw new Error('Proporciona un ID de pedido');

    // Header normalizado
    currentHeader = (await pedidosAPI.getOne(currentPedidoId))?.data || null;
    if (!currentHeader) throw new Error('No se encontró el pedido');

    renderHeader();
    await refrescarDetalles();
    showAlert('success', `Pedido <strong>${currentPedidoId}</strong> cargado.`);
  } catch (err) {
    console.error('cargarPedido error:', err);
    showAlert('danger', err.message || 'No se pudo cargar el pedido');
  }
}

async function verificarStock() {
  if (!currentPedidoId) return;
  try {
    const rows = unpack(await controlPedidosAPI.verificarProductos(currentPedidoId));
    const body = $('#stockBody');
    body.innerHTML = '';
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="text-center text-success">Todos los artículos tienen stock suficiente.</td></tr>';
      $('#stockMsg').textContent = 'Puedes confirmar el pedido con seguridad.';
    } else {
      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.producto_id}</td>
          <td>${r.requerido}</td>
          <td>${r.stock_disponible}</td>
          <td class="text-danger fw-semibold">${r.deficit}</td>
        `;
        body.appendChild(tr);
      });
      $('#stockMsg').textContent = 'Resuelve los déficits antes de confirmar el pedido.';
    }
    modalStock.show();
  } catch (err) {
    console.error('verificarStock error:', err);
    showAlert('danger', err.message || 'No se pudo verificar stock');
  }
}

async function setEstado(nuevoEstado) {
  if (!currentPedidoId) return;
  try {
    const res = await controlPedidosAPI.setEstado({ pedido_id: currentPedidoId, estado: nuevoEstado });
    // Devuelve { pedido, detalles[] }
    currentHeader = res?.data?.pedido || currentHeader;
    renderHeader();
    await refrescarDetalles();
    showAlert('success', `Estado actualizado a <strong>${nuevoEstado}</strong>.`);
  } catch (err) {
    console.error('setEstado error:', err);
    showAlert('danger', err.message || 'No se pudo actualizar el estado');
  }
}

async function agregarItem() {
  const producto_id = ensureStr($('#producto_id').value);
  const cantidad = Number($('#cantidad').value || 1);
  const precio_unitario_raw = $('#precio_unitario').value;
  const precio_unitario = precio_unitario_raw === '' ? undefined : Number(precio_unitario_raw);

  if (!currentPedidoId) return showAlert('warning', 'Primero carga un pedido.');
  if (!producto_id) return showAlert('warning', 'Escribe un ID de producto.');
  if (!Number.isInteger(cantidad) || cantidad <= 0) return showAlert('warning', 'Cantidad inválida.');

  try {
    await controlPedidosAPI.addItem({ pedido_id: currentPedidoId, producto_id, cantidad, precio_unitario });
    $('#producto_id').value = '';
    $('#cantidad').value = '1';
    $('#precio_unitario').value = '';
    await refrescarDetalles();
    showAlert('success', 'Artículo agregado.');
  } catch (err) {
    console.error('agregarItem error:', err);
    showAlert('danger', err.message || 'No se pudo agregar el artículo');
  }
}

function init() {
  modalStock = new bootstrap.Modal('#modalStock');
  configurarTabla();

  // Botones
  $('#btnCargar').addEventListener('click', () => cargarPedido($('#pedido_id').value.trim()));
  $('#btnAgregar').addEventListener('click', agregarItem);
  $('#btnVerificar').addEventListener('click', verificarStock);
  $('#btnSetPorConfirmar').addEventListener('click', () => setEstado('Por confirmar'));
  $('#btnConfirmar').addEventListener('click', () => setEstado('Confirmado'));
  $('#btnCancelar').addEventListener('click', () => setEstado('Cancelado'));

  // Auto-carga por query string
  const pid = qs('pid') || qs('id');
  if (pid) {
    $('#pedido_id').value = pid;
    cargarPedido(pid);
  }
}

window.addEventListener('DOMContentLoaded', init);