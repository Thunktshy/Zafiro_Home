// scripts/forms/pedidos.js
// UI de administración para Pedidos (DataTable + modales + crear/confirmar/cancelar + ver detalles)
// Requiere: pedidosAPI (pedidosManager.js)

import { pedidosAPI } from '/admin-resources/scripts/apis/pedidosManager.js';

// Utilidades UI
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const money = (n) => (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const badgeEstado = (estado) => {
  const e = String(estado || '').toLowerCase();
  const map = { 'por confirmar': 'bg-warning text-dark', 'confirmado': 'bg-success', 'cancelado': 'bg-secondary' };
  return `<span class="badge ${map[e] || 'bg-light text-dark'}">${estado || '—'}</span>`;
};

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
let modalView, modalCreate, modalConfirm; // bootstrap modals
let accionConfirm = null; // { type:'confirmar'|'cancelar', id }

// Índices de columnas para ordenar
const COL_INDEX = {
  pedido_id: 0,
  cliente_id: 1,
  fecha_pedido: 2,
  estado_pedido: 3,
  total_pedido: 4,
  metodo_pago: 5
};

function configurarTabla() {
  if (tabla) {
    tabla.destroy();
    $('#tablaPedidos tbody').innerHTML = '';
  }
  tabla = new DataTable('#tablaPedidos', {
    paging: true,
    pageLength: 10,
    lengthChange: false,
    ordering: true,
    order: [[COL_INDEX.fecha_pedido, 'desc']],
    searching: true,
    language: { url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' },
    columns: [
      { data: 'pedido_id' },
      { data: 'cliente_id' },
      { data: 'fecha_pedido', render: (v) => v ? new Date(v).toLocaleString('es-MX') : '' },
      { data: 'estado_pedido', render: (v) => badgeEstado(v) },
      { data: 'total_pedido', render: (v) => money(v) },
      { data: 'metodo_pago', defaultContent: '' },
      {
        data: null,
        orderable: false,
        searchable: false,
        className: 'text-end',
        render: (_v, _t, row) => {
          const id = row.pedido_id;
          const estado = String(row.estado_pedido || '').toLowerCase();
          const btnConfirm = estado === 'por confirmar'
            ? `<button class="btn btn-sm btn-outline-success me-1" data-action="confirmar" data-id="${id}"><i class="bi bi-check2-circle"></i> Confirmar</button>`
            : '';
          const btnCancelar = estado !== 'cancelado'
            ? `<button class="btn btn-sm btn-outline-warning me-1" data-action="cancelar" data-id="${id}"><i class="bi bi-x-circle"></i> Cancelar</button>`
            : '';
          return `
            <button class="btn btn-sm btn-primary me-1" data-action="ver" data-id="${id}"><i class="bi bi-eye"></i> Ver</button>
            ${btnConfirm}
            ${btnCancelar}
          `;
        }
      }
    ]
  });

  // Acciones por fila
  $('#tablaPedidos tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');

    if (action === 'ver') return abrirVer(id);
    if (action === 'confirmar') return prepararConfirm('confirmar', id);
    if (action === 'cancelar') return prepararConfirm('cancelar', id);
  });
}

async function cargarPorCliente() {
  const raw = $('#filtroCliente').value.trim();
  if (!raw) return showAlert('warning', 'Escribe un ID de cliente (cl-1 o 1).');
  try {
    const rows = unpack(await pedidosAPI.getByCliente(raw));
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('info', `Pedidos del cliente <strong>${raw}</strong> cargados.`);
  } catch (err) {
    console.error('cargarPorCliente error:', err);
    showAlert('danger', `Error al buscar pedidos del cliente: ${err.message}`);
  }
}

async function cargarPorEstado(estado) {
  if (!estado) return limpiar();
  try {
    const rows = unpack(await pedidosAPI.getByEstado(estado));
    tabla.clear();
    tabla.rows.add(rows).draw();
    showAlert('info', `Pedidos con estado <strong>${estado}</strong> cargados.`);
  } catch (err) {
    console.error('cargarPorEstado error:', err);
    showAlert('danger', `Error al filtrar por estado: ${err.message}`);
  }
}

async function cargarPorConfirmar() {
  try {
    const rows = unpack(await pedidosAPI.getPorConfirmar());
    tabla.clear();
    tabla.rows.add(rows).draw();
    $('#filtroEstado').value = 'Por confirmar';
    showAlert('info', 'Pedidos "Por confirmar" cargados.');
  } catch (err) {
    console.error('cargarPorConfirmar error:', err);
    showAlert('danger', `Error al cargar por confirmar: ${err.message}`);
  }
}

function ordenarTabla() {
  const value = $('#ordenarPor').value;
  const idx = COL_INDEX[value] ?? COL_INDEX.fecha_pedido;
  tabla.order([idx, value === 'fecha_pedido' ? 'desc' : 'asc']).draw();
}

function limpiar() {
  $('#filtroCliente').value = '';
  $('#filtroEstado').value = '';
  $('#ordenarPor').value = 'fecha_pedido';
  tabla.clear().draw();
}

async function abrirVer(pedido_id) {
  try {
    const header = (await pedidosAPI.getOne(pedido_id))?.data || null;
    const detalles = unpack(await pedidosAPI.getDetalles(pedido_id));

    // Header
    $('#v_pedido_id').textContent = header?.pedido_id ?? '—';
    $('#v_cliente_id').textContent = header?.cliente_id ?? '—';
    $('#v_fecha_pedido').textContent = header?.fecha_pedido ? new Date(header.fecha_pedido).toLocaleString('es-MX') : '—';
    $('#v_estado_pedido').textContent = header?.estado_pedido ?? '—';
    $('#v_estado_pedido').className = 'badge ' + (String(header?.estado_pedido || '').toLowerCase() === 'confirmado' ? 'bg-success' : (String(header?.estado_pedido || '').toLowerCase() === 'por confirmar' ? 'bg-warning text-dark' : 'bg-secondary'));
    $('#v_total_pedido').textContent = money(header?.total_pedido ?? 0);
    $('#v_metodo_pago').textContent = header?.metodo_pago ?? '—';

    // Detalles
    const tbody = $('#v_detalles');
    tbody.innerHTML = '';
    detalles.forEach((d, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${d.producto_id}</td>
        <td>${d.nombre_producto ?? ''}</td>
        <td>${d.cantidad}</td>
        <td>${money(d.precio_unitario)}</td>
        <td>${money(d.subtotal)}</td>
      `;
      tbody.appendChild(tr);
    });

    modalView.show();
  } catch (err) {
    console.error('abrirVer error:', err);
    showAlert('danger', `No se pudo obtener el pedido: ${err.message}`);
  }
}

function prepararConfirm(type, id) {
  accionConfirm = { type, id };
  const msg = type === 'confirmar'
    ? `¿Confirmar el pedido <strong>${id}</strong>? (Debe tener artículos y total > 0)`
    : `¿Cancelar el pedido <strong>${id}</strong>?`;
  $('#confirmMsg').innerHTML = msg;
  modalConfirm.show();
}

async function ejecutarConfirm() {
  if (!accionConfirm) return;
  const { type, id } = accionConfirm;
  try {
    if (type === 'confirmar') await pedidosAPI.confirmar(id);
    else if (type === 'cancelar') await pedidosAPI.cancelar(id);

    modalConfirm.hide();
    accionConfirm = null;

    // Refresca según filtro activo
    const est = $('#filtroEstado').value;
    const cli = $('#filtroCliente').value.trim();
    if (cli) await cargarPorCliente();
    else if (est) await cargarPorEstado(est);
    else await cargarPorConfirmar();
  } catch (err) {
    console.error('ejecutarConfirm error:', err);
    showAlert('danger', `Acción fallida: ${err.message}`);
  }
}

function validarCrear() {
  const input = $('#cliente_id');
  const cli = input.value.trim();
  if (!cli) { input.classList.add('is-invalid'); return false; }
  input.classList.remove('is-invalid');
  return true;
}

async function crearPedido(ev) {
  ev.preventDefault();
  if (!validarCrear()) return;
  const cliente_id = $('#cliente_id').value.trim();
  const metodo_pago = $('#metodo_pago').value.trim() || null;
  try {
    const res = await pedidosAPI.insert({ cliente_id, metodo_pago });
    modalCreate.hide();
    showAlert('success', 'Pedido creado correctamente.');
    // tras crear, muestro pedidos del cliente para verlo en la tabla
    $('#filtroCliente').value = cliente_id;
    await cargarPorCliente();
    // y abro el modal de vista si nos devolvieron id
    const id = res?.data?.pedido_id ?? null;
    if (id) abrirVer(id);
  } catch (err) {
    console.error('crearPedido error:', err);
    showAlert('danger', `No se pudo crear el pedido: ${err.message}`);
  }
}

async function init() {
  // Modales
  modalView   = new bootstrap.Modal('#modalPedidoView');
  modalCreate = new bootstrap.Modal('#modalPedidoCreate');
  modalConfirm= new bootstrap.Modal('#modalConfirm');

  configurarTabla();
  await cargarPorConfirmar(); // vista inicial útil para admin

  // Filtros/acciones
  $('#btnBuscarCliente').addEventListener('click', cargarPorCliente);
  $('#filtroEstado').addEventListener('change', (e) => cargarPorEstado(e.target.value));
  $('#btnPorConfirmar').addEventListener('click', cargarPorConfirmar);
  $('#ordenarPor').addEventListener('change', ordenarTabla);
  $('#btnLimpiar').addEventListener('click', limpiar);
  $('#btnNuevo').addEventListener('click', () => { $('#formPedido').reset(); modalCreate.show(); });

  // Confirmar/cancelar
  $('#btnConfirmarAccion').addEventListener('click', ejecutarConfirm);

  // Crear
  $('#formPedido').addEventListener('submit', crearPedido);
}

window.addEventListener('DOMContentLoaded', init);