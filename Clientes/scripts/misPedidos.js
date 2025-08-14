// /client-resources/scripts/misPedidos.js
// Renderiza el historial de pedidos del cliente antes del <h1.cart-title>
// Requiere: /scripts/apis/pedidosManager.js (getByCliente, getDetalles)

import { pedidosAPI } from '../scripts/apis/pedidosManager.js'; // GET /pedidos/por_cliente/:cliente_id, /get_detalles/:pedido_id

/* ==================== Utils ==================== */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const fmtMoney = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));
const safe = (s) => String(s ?? '').trim();

function detectClienteId() {
  // 1) ?uid=cl-123 | ?cliente_id=cl-123
  const p = new URLSearchParams(location.search);
  const byUrl = p.get('uid') || p.get('cliente_id') || '';
  if (byUrl && /^cl-\w+/i.test(byUrl)) return byUrl;

  // 2) session/local storage (si tu login lo guardó ahí)
  const fromSS = sessionStorage.getItem('uid') || localStorage.getItem('uid') || '';
  if (fromSS && /^cl-\w+/i.test(fromSS)) return fromSS;

  // 3) cookie muy simple (uid=cl-123) si existiera
  const m = document.cookie.match(/(?:^|;\s*)uid=(cl-[^;]+)/i);
  if (m) return m[1];

  return ''; // no identificado
}

function normalizePedido(p) {
  return {
    id: safe(p.pedido_id || p.id || ''),
    estado: safe(p.estado_pedido || p.estado || ''),
    fecha: safe(p.fecha_pedido || p.fecha || p.created_at || ''),
    total: Number(p.total_pedido ?? p.total ?? NaN), // si no viene, se intentará calcular con detalles
    metodo: safe(p.metodo_pago || ''),
  };
}

function normalizeDetalle(d) {
  const cantidad = Number(d.cantidad ?? 0);
  const pu = Number(d.precio_unitario ?? d.precio ?? 0);
  return {
    producto_id: safe(d.producto_id || d.id || ''),
    nombre: safe(d.nombre_producto || d.nombre || ''),
    cantidad,
    precio_unitario: pu,
    subtotal: cantidad * pu,
  };
}

function renderSkeleton(container) {
  container.innerHTML = `
    <section id="ordersHistory" class="orders-history" style="margin-bottom:1rem">
      <h2 style="margin:0 0 .5rem;color:#2d4778">Mis pedidos</h2>
      <div class="orders-list" style="display:flex;flex-direction:column;gap:.75rem"></div>
    </section>
  `;
  return $('#ordersHistory .orders-list', container);
}

function renderEmpty(listEl, msg = 'Aún no tienes pedidos.') {
  listEl.innerHTML = `
    <div class="empty" role="status">${msg}</div>
  `;
}

function pedidoCardHTML(p) {
  const fechaTxt = p.fecha ? new Date(p.fecha).toLocaleString('es-MX') : '—';
  const totalTxt = Number.isFinite(p.total) ? fmtMoney(p.total) : '(calculando…)';
  const estadoBadge = `<span class="cart-badge" style="background:#eef2ff;border:1px solid #c7d2fe;color:#1e3a8a">${p.estado || '—'}</span>`;
  return `
    <article class="card" data-pedido="${p.id}" style="border-radius:12px;overflow:hidden">
      <div class="card-head" style="background:#a5230c;color:#fff;padding:.6rem 1rem">
        <div class="card-title" style="display:flex;gap:.6rem;align-items:center;margin:0">
          <strong>Pedido ${p.id || '(sin id)'}</strong>
          ${estadoBadge}
        </div>
      </div>
      <div class="card-body" style="padding:1rem">
        <div class="sum-row" style="display:flex;justify-content:space-between;margin:.25rem 0">
          <span>Fecha</span><span>${fechaTxt}</span>
        </div>
        <div class="sum-row" style="display:flex;justify-content:space-between;margin:.25rem 0">
          <span>Método de pago</span><span>${p.metodo || '—'}</span>
        </div>
        <div class="sum-row" style="display:flex;justify-content:space-between;margin:.25rem 0">
          <span>Total</span><strong>${totalTxt}</strong>
        </div>

        <button class="btn-min js-toggle" style="margin-top:.5rem">Ver detalles</button>
        <div class="js-detalles" style="display:none;margin-top:.6rem"></div>
      </div>
    </article>
  `;
}

/* ==================== Carga principal ==================== */
async function loadPedidosIntoPage() {
  const wrap = $('.cart-wrap');
  const title = $('.cart-title', wrap);
  if (!wrap || !title) return; // Estructura no encontrada

  const listEl = renderSkeleton(wrap);
  // Insertar sección ANTES del H1
  wrap.insertBefore($('#ordersHistory'), title);

  const clienteId = detectClienteId();
  if (!clienteId) {
    renderEmpty(listEl, 'Inicia sesión para ver tus pedidos.');
    return;
  }

  let rows;
  try {
    // GET /pedidos/por_cliente/:cliente_id  → Array<pedido>
    const resp = await pedidosAPI.getByCliente(clienteId);
    rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
  } catch (e) {
    renderEmpty(listEl, 'No fue posible cargar tus pedidos.');
    console.error('misPedidos: error al obtener pedidos', e);
    return;
  }

  if (!rows.length) {
    renderEmpty(listEl, 'Aún no tienes pedidos.');
    return;
  }

  // Normalizar y renderizar tarjetas
  const pedidos = rows.map(normalizePedido);
  listEl.innerHTML = pedidos.map(pedidoCardHTML).join('');

  // Si falta total en alguno, se calcula con detalles
  pedidos.forEach(async (p) => {
    if (!Number.isFinite(p.total) && p.id) {
      try {
        // GET /pedidos/get_detalles/:pedido_id → Array<detalle>
        const det = await pedidosAPI.getDetalles(p.id);
        const arr = Array.isArray(det?.data) ? det.data : (Array.isArray(det) ? det : []);
        const detalles = arr.map(normalizeDetalle);
        const total = detalles.reduce((acc, d) => acc + d.subtotal, 0);
        p.total = total;

        const card = $(`article.card[data-pedido="${p.id}"]`);
        if (card) {
          const totalRow = $$('.sum-row', card).at(2);
          if (totalRow) totalRow.lastElementChild.textContent = fmtMoney(total);
        }
      } catch {
        /* silencioso */
      }
    }
  });

  // Delegación para "Ver detalles"
  listEl.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.js-toggle');
    if (!btn) return;

    const card = ev.target.closest('article.card');
    const detBox = $('.js-detalles', card);
    const pedido_id = card?.getAttribute('data-pedido');
    if (!pedido_id || !detBox) return;

    // Toggle visual
    const isOpen = detBox.style.display !== 'none';
    if (isOpen) {
      detBox.style.display = 'none';
      btn.textContent = 'Ver detalles';
      return;
    }

    // Cargar si está vacío
    if (!detBox.hasChildNodes()) {
      detBox.innerHTML = '<div style="color:#6b7280">Cargando…</div>';
      try {
        const det = await pedidosAPI.getDetalles(pedido_id);
        const arr = Array.isArray(det?.data) ? det.data : (Array.isArray(det) ? det : []);
        const detalles = arr.map(normalizeDetalle);
        if (!detalles.length) {
          detBox.innerHTML = '<div style="color:#6b7280">Sin partidas.</div>';
        } else {
          detBox.innerHTML = `
            <div style="border:1px solid #eee;border-radius:10px;padding:.6rem">
              ${detalles.map(d => `
                <div class="sum-row" style="display:flex;justify-content:space-between;margin:.25rem 0">
                  <span>${d.nombre || d.producto_id} × ${d.cantidad}</span>
                  <span>${fmtMoney(d.subtotal)}</span>
                </div>
              `).join('')}
            </div>
          `;
        }
      } catch (e) {
        console.error('misPedidos: detalles error', e);
        detBox.innerHTML = '<div style="color:#b91c1c">No fue posible cargar los detalles.</div>';
      }
    }

    detBox.style.display = 'block';
    btn.textContent = 'Ocultar detalles';
  });
}

document.addEventListener('DOMContentLoaded', loadPedidosIntoPage);
