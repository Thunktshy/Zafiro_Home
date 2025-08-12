// /Public/scripts/miCarrito.js

/* =======================
   Utilidades generales
======================= */
function qs(name) {
  const url = new URL(location.href);
  const v = url.searchParams.get(name);
  return v && v.trim() !== '' ? v : null;
}

function money(n) {
  const x = Number(n) || 0;
  return x.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"'`=\/]/g, s =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s])
  );
}

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

/* =======================
   API helpers (con logs)
======================= */
async function apiGet(url) {
  console.log('[API][GET] ->', url);
  const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' }});
  const text = await r.text();
  const isJson = (r.headers.get('content-type')||'').includes('application/json');
  const data = isJson ? (text ? JSON.parse(text) : {}) : {};
  if (!r.ok) {
    console.log('[API][GET][ERROR]', url, r.status, text.slice(0, 200));
    throw new Error(data?.message || (`GET ${url} -> ${r.status}`));
  }
  console.log('[API][GET][OK]', url, data);
  return data;
}

async function apiPost(url, body) {
  console.log('[API][POST] ->', url, body);
  const r = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await r.text();
  const isJson = (r.headers.get('content-type')||'').includes('application/json');
  const data = isJson ? (text ? JSON.parse(text) : {}) : {};
  if (!r.ok) {
    console.log('[API][POST][ERROR]', url, r.status, text.slice(0, 200));
    throw new Error(data?.message || (`POST ${url} -> ${r.status}`));
  }
  console.log('[API][POST][OK]', url, data);
  return data;
}

/* =======================
   Productos (cache + enrich)
======================= */
const productCache = new Map();

async function getProductoPorId(id) {
  if (productCache.has(id)) return productCache.get(id);
  try {
    console.log('[Producto] consultando /productos_por_id?id=', id);
    const r = await apiGet(`/productos_por_id?id=${encodeURIComponent(id)}`);
    // Normaliza: puede venir como {data:[...]} o {data:{...}} o {...}
    const row = Array.isArray(r?.data) ? r.data[0] : (r?.data?.[0] ?? r?.data ?? r) || null;
    productCache.set(id, row);
    return row;
  } catch (e) {
    console.log('[Producto][ERROR]', id, e?.message || e);
    productCache.set(id, null);
    return null;
  }
}

async function enrichDetalles(detalles) {
  const out = await Promise.all((detalles || []).map(async d => {
    const p = await getProductoPorId(d.producto_id);
    return {
      ...d,
      nombre_producto: d.nombre_producto ?? p?.nombre_producto ?? d.producto_id,
      precio_unitario: (Number(d.precio_unitario) || Number(p?.precio_unitario) || 0),
      image_url: d.image_url || p?.image_path || p?.image_url || null,
      subtotal: Number(d.subtotal ?? ( (Number(d.precio_unitario) || Number(p?.precio_unitario) || 0) * Number(d.cantidad || 1) ))
    };
  }));
  return out;
}

/* =======================
   Render
======================= */
function renderLinea(det, handlers) {
  const producto_id     = String(det.producto_id || '');
  const nombre_producto = escapeHtml(det.nombre_producto || det.producto_id || '');
  const cantidad        = Number(det.cantidad) || 1;
  const precio_unitario = Number(det.precio_unitario) || 0;
  const subtotal        = Number(det.subtotal ?? (precio_unitario * cantidad));
  const image_url       = det.image_url || `https://picsum.photos/seed/${encodeURIComponent(producto_id)}/160/160`;

  const card = el(`
    <div class="cart-card" data-pid="${escapeHtml(producto_id)}">
      <img class="cart-img" src="${escapeHtml(image_url)}" alt="">
      <div>
        <div class="cart-title">${nombre_producto || escapeHtml(producto_id)}</div>
        <div class="cart-meta">ID: ${escapeHtml(producto_id)}</div>
        <div class="qty" style="margin-top:.4rem">
          <button class="btn-dec" title="Restar">−</button>
          <input class="inp-qty" type="number" min="1" value="${cantidad}">
          <button class="btn-inc" title="Sumar">+</button>
          <button class="btn-danger btn-del" style="margin-left:.5rem">Quitar</button>
        </div>
      </div>
      <div class="price">${money(subtotal)}</div>
    </div>
  `);

  const btnInc = card.querySelector('.btn-inc');
  const btnDec = card.querySelector('.btn-dec');
  const btnDel = card.querySelector('.btn-del');
  const inpQty = card.querySelector('.inp-qty');

  if (!btnInc)  console.log('[UI] no se encontró botón + para', producto_id);
  if (!btnDec)  console.log('[UI] no se encontró botón - para', producto_id);
  if (!btnDel)  console.log('[UI] no se encontró botón quitar para', producto_id);
  if (!inpQty)  console.log('[UI] no se encontró input qty para', producto_id);

  btnInc?.addEventListener('click', () => {
    console.log('[CLICK] sumar cantidad para', producto_id);
    handlers.add(producto_id, 1);
  });

  btnDec?.addEventListener('click', () => {
    console.log('[CLICK] restar cantidad para', producto_id);
    handlers.remove(producto_id, 1);
  });

  btnDel?.addEventListener('click', () => {
    console.log('[CLICK] quitar producto', producto_id);
    handlers.remove(producto_id, null); // null => quitar todo
  });

  inpQty?.addEventListener('change', () => {
    const targetQty = Math.max(1, Number(inpQty.value) || 1);
    const cur = Number(cantidad) || 1;
    const diff = targetQty - cur;
    console.log('[CHANGE] qty', producto_id, 'de', cur, 'a', targetQty, '(diff=', diff, ')');
    if (diff > 0) handlers.add(producto_id, diff);
    else if (diff < 0) handlers.remove(producto_id, Math.abs(diff));
  });

  return card;
}

function renderPedidoActual(root, pedido, detalles, handlers) {
  root.innerHTML = '';
  if (!pedido) {
    console.log('[RENDER] sin pedido actual');
    root.appendChild(el(`<div class="empty">No hay pedido actual.</div>`));
    actualizarTotalesYBadge(null, []);
    return;
  }

  console.log('[RENDER] pedido', pedido?.pedido_id, 'con', (detalles || []).length, 'líneas');
  const frag = document.createDocumentFragment();
  (detalles || []).forEach(det => frag.appendChild(renderLinea(det, handlers)));
  root.appendChild(frag);

  actualizarTotalesYBadge(pedido, detalles || []);
}

function renderMisPedidos(root, pedidos) {
  root.innerHTML = '';
  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    console.log('[RENDER] sin pedidos del cliente');
    root.appendChild(el(`<div class="empty">Sin pedidos.</div>`));
    return;
  }

  console.log('[RENDER] mis pedidos x', pedidos.length);
  const container = document.createDocumentFragment();
  pedidos.forEach(p => {
    const card = el(`
      <div class="cart-card" data-pedido="${escapeHtml(String(p.pedido_id || ''))}">
        <div style="flex:1">
          <div class="cart-title">Pedido ${escapeHtml(String(p.pedido_id || ''))}</div>
          <div class="cart-meta">Estado: ${escapeHtml(String(p.estado || p.estado_pedido || ''))} · Fecha: ${escapeHtml(String(p.fecha_creacion || p.fecha_pedido || ''))}</div>
        </div>
        <button class="btn-primary btn-ver">Ver</button>
      </div>
    `);
    card.querySelector('.btn-ver')?.addEventListener('click', () => {
      console.log('[CLICK] ver pedido', p.pedido_id);
      const uid = qs('uid') || String(p.cliente_id || '');
      location.assign(`miCarrito.html?pid=${encodeURIComponent(p.pedido_id)}&uid=${encodeURIComponent(uid)}`);
    });
    container.appendChild(card);
  });
  root.appendChild(container);
}

function actualizarTotalesYBadge(pedido, detalles) {
  const total = (detalles || []).reduce((a, d) =>
    a + Number(d.subtotal || (Number(d.precio_unitario) * Number(d.cantidad || 1)) || 0), 0);
  const $total = document.getElementById('total-label');
  const $badge = document.getElementById('pedido-badge');

  if (!$total) console.log('[UI] no se encontró #total-label');
  if (!$badge) console.log('[UI] no se encontró #pedido-badge');

  if ($total) $total.textContent = `Total: ${money(total)}`;
  if ($badge)  $badge.textContent = pedido?.pedido_id
    ? `Pedido ${pedido.pedido_id} — Estado: ${pedido.estado || pedido.estado_pedido || 'Abierto'}`
    : 'Sin pedido';
}

/* =======================
   Flujos
======================= */
async function cargarPedidoPorPid(pid) {
  console.log('[FLOW] cargarPedidoPorPid', pid);
  const pedidoResp   = await apiGet(`/pedidos/get/${encodeURIComponent(pid)}`);
  const detallesResp = await apiGet(`/pedidos/get_detalles/${encodeURIComponent(pid)}`);
  const pedido   = pedidoResp?.data || null;
  let   detalles = Array.isArray(detallesResp?.data) ? detallesResp.data : [];
  detalles = await enrichDetalles(detalles);
  return { pedido, detalles };
}

async function crearPedidoConIds(uid, ids) {
  console.log('[FLOW] crearPedidoConIds', uid, ids);
  const creado = await apiPost('/pedidos/insert', { cliente_id: uid });
  const pid = (creado?.data?.pedido_id) || (creado?.data?.pedido?.pedido_id) || creado?.pedido_id;
  if (!pid) throw new Error('No se pudo crear el pedido (sin pid)');
  console.log('[FLOW] pedido creado', pid);

  for (const producto_id of ids) {
    try {
      console.log('[FLOW] agregando producto', producto_id);
      await apiPost('/pedidos/add_item', { pedido_id: pid, producto_id, cantidad: 1 });
    } catch (e) {
      console.log('[FLOW][WARN] no se pudo agregar', producto_id, e?.message || e);
    }
  }
  return cargarPedidoPorPid(pid);
}

async function cargarMisPedidos(uid) {
  console.log('[FLOW] cargarMisPedidos', uid);
  const r = await apiGet(`/pedidos/por_cliente/${encodeURIComponent(uid)}`);
  return Array.isArray(r?.data) ? r.data : [];
}

/* =======================
   Main
======================= */
async function run() {
  console.log('[INIT] miCarrito');
  const pid = qs('pid');
  const uid = qs('uid');
  const ids = (qs('ids') || '').split(',').map(s => s.trim()).filter(Boolean);

  const $actual = document.getElementById('pedido-actual');
  const $mis    = document.getElementById('mis-pedidos');

  if (!$actual) console.log('[UI] no se encontró #pedido-actual');
  if (!$mis)    console.log('[UI] no se encontró #mis-pedidos');

  let pedido = null, detalles = [];

  try {
    if (pid) {
      console.log('[MODE] cargar por pid', pid);
      ({ pedido, detalles } = await cargarPedidoPorPid(pid));
    } else if (ids.length && uid) {
      console.log('[MODE] crear pedido con ids', ids, 'uid', uid);
      ({ pedido, detalles } = await crearPedidoConIds(uid, ids));

      // limpiar ids de la URL para evitar duplicar si recarga
      const u = new URL(location.href);
      u.searchParams.delete('ids');
      history.replaceState({}, '', u.pathname + '?' + u.searchParams.toString());
    } else {
      console.log('[MODE] no hay pid ni (ids+uid) -> esperando acción del usuario');
    }
  } catch (e) {
    console.log('[ERROR] cargando/creando pedido', e?.message || e);
  }

  // Handlers de acciones sobre el pedido actual (+, -, quitar)
  const handlers = {
    add: async (producto_id, n) => {
      if (!pedido?.pedido_id) { console.log('[ADD] no hay pedido actual'); return; }
      console.log('[ADD]', producto_id, 'n=', n);
      try {
        await apiPost('/pedidos/add_item', { pedido_id: pedido.pedido_id, producto_id, cantidad: Number(n) });
        ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
        if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);
      } catch (e) {
        console.log('[ADD][ERROR]', e?.message || e);
      }
    },
    remove: async (producto_id, nOrNull) => {
      if (!pedido?.pedido_id) { console.log('[REMOVE] no hay pedido actual'); return; }
      console.log('[REMOVE]', producto_id, 'n=', nOrNull);
      try {
        const body = { pedido_id: pedido.pedido_id, producto_id };
        if (nOrNull != null) body.cantidad = Number(nOrNull); // null => quitar todo
        await apiPost('/pedidos/remove_item', body);
        ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
        if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);
      } catch (e) {
        console.log('[REMOVE][ERROR]', e?.message || e);
      }
    }
  };

  if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);

  // Botón comprar
  const $btnComprar = document.getElementById('btn-comprar');
  if (!$btnComprar) console.log('[UI] no se encontró #btn-comprar');
  $btnComprar?.addEventListener('click', async () => {
    if (!pedido?.pedido_id) { console.log('[COMPRAR] no hay pedido'); return; }
    console.log('[COMPRAR] se presionó comprar ahora');
    try {
      await apiPost('/pedidos/set_estado', { pedido_id: pedido.pedido_id, estado: 'Completado' });
      ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
      if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);
      alert('¡Pedido completado!');
    } catch (e) {
      console.log('[COMPRAR][ERROR]', e?.message || e);
      alert(e?.message || 'No se pudo completar el pedido');
    }
  });

  // Botón vaciar
  const $btnVaciar = document.getElementById('btn-vaciar');
  if (!$btnVaciar) console.log('[UI] no se encontró #btn-vaciar');
  $btnVaciar?.addEventListener('click', async () => {
    if (!pedido?.pedido_id) { console.log('[VACIAR] no hay pedido'); return; }
    console.log('[VACIAR] se presionó vaciar carrito');
    try {
      for (const d of (detalles || [])) {
        await apiPost('/pedidos/remove_item', { pedido_id: pedido.pedido_id, producto_id: d.producto_id });
      }
      ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
      if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);
    } catch (e) {
      console.log('[VACIAR][ERROR]', e?.message || e);
    }
  });

  // Mis pedidos
  try {
    const mine = (qs('uid')) ? await cargarMisPedidos(qs('uid')) : [];
    if ($mis) renderMisPedidos($mis, mine);
  } catch (e) {
    console.log('[ERROR] cargando mis pedidos', e?.message || e);
  }

  // Badge final
  actualizarTotalesYBadge(pedido, detalles);
}

document.addEventListener('DOMContentLoaded', run);
