// /Public/scripts/miCarrito.js
// Origen de datos:
//   - pid:   ?pid=... (prioritario)
//   - ids:   localStorage/sessionStorage ("tmpCartIds" o "cart:ids"); fallback ?ids=a,b,c
//   - uid:   sessionStorage.uid; fallback ?uid=...

/* =======================
   Utilidades
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
   Storage helpers
======================= */
function parseIdList(raw) {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) return j.map(String).map(s => s.trim()).filter(Boolean);
  } catch {}
  // fallback "a,b,c"
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}
function getStoredCartIds() {
  // Preferir sessionStorage, luego localStorage
  const s1 = sessionStorage.getItem('tmpCartIds') ?? sessionStorage.getItem('cart:ids');
  const s2 = localStorage.getItem('tmpCartIds')  ?? localStorage.getItem('cart:ids');
  const fromStorage = parseIdList(s1 || s2);
  const fromUrl = parseIdList(qs('ids') || '');
  const all = [...fromStorage, ...fromUrl];
  // unique preservando orden
  const seen = new Set();
  const uniq = [];
  for (const id of all) if (!seen.has(id)) { seen.add(id); uniq.push(id); }
  console.log('[STORAGE] ids detectados:', uniq);
  return uniq;
}
function clearStoredCartIds() {
  // Limpia solo tmpCartIds/cart:ids para evitar re-agregar al recargar
  sessionStorage.removeItem('tmpCartIds');
  sessionStorage.removeItem('cart:ids');
  localStorage.removeItem('tmpCartIds');
  localStorage.removeItem('cart:ids');
  console.log('[STORAGE] tmpCartIds/cart:ids limpiados');
}
function getStoredUid() {
  const uid = sessionStorage.getItem('uid') || localStorage.getItem('uid') || qs('uid');
  console.log('[STORAGE] uid detectado:', uid);
  return uid || null;
}

/* =======================
   API helpers
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
   Productos (cache + enrich usando /productos_por_id)
======================= */
const productCache = new Map();
async function getProductoPorId(id) {
  if (productCache.has(id)) return productCache.get(id);
  try {
    console.log('[Producto] /productos_por_id?id=', id);
    const r = await apiGet(`/productos_por_id?id=${encodeURIComponent(id)}`);
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
      subtotal: Number(d.subtotal ?? ((Number(d.precio_unitario) || Number(p?.precio_unitario) || 0) * Number(d.cantidad || 1)))
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

  btnInc?.addEventListener('click', () => { console.log('[CLICK] +', producto_id); handlers.add(producto_id, 1); });
  btnDec?.addEventListener('click', () => { console.log('[CLICK] -', producto_id); handlers.remove(producto_id, 1); });
  btnDel?.addEventListener('click', () => { console.log('[CLICK] quitar', producto_id); handlers.remove(producto_id, null); });
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
function actualizarTotalesYBadge(pedido, detalles) {
  const total = (detalles || []).reduce((a, d) =>
    a + Number(d.subtotal || (Number(d.precio_unitario) * Number(d.cantidad || 1)) || 0), 0);
  const $total = document.getElementById('total-label');
  const $badge = document.getElementById('pedido-badge');
  if ($total) $total.textContent = `Total: ${money(total)}`;
  if ($badge) $badge.textContent = pedido?.pedido_id
    ? `Pedido ${pedido.pedido_id} — Estado: ${pedido.estado || pedido.estado_pedido || 'Abierto'}`
    : 'Sin pedido';
}
function renderPedidoActual(root, pedido, detalles, handlers) {
  root.innerHTML = '';
  if (!pedido) {
    console.log('[RENDER] sin pedido actual');
    root.appendChild(el(`<div class="empty">No hay pedido actual.</div>`));
    actualizarTotalesYBadge(null, []);
    return;
  }
  console.log('[RENDER] pedido', pedido?.pedido_id, 'líneas', (detalles || []).length);
  const frag = document.createDocumentFragment();
  (detalles || []).forEach(det => frag.appendChild(renderLinea(det, handlers)));
  root.appendChild(frag);
  actualizarTotalesYBadge(pedido, detalles || []);
}
function renderMisPedidos(root, pedidos) {
  root.innerHTML = '';
  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    root.appendChild(el(`<div class="empty">Sin pedidos.</div>`));
    return;
  }
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
      const uid = getStoredUid();
      console.log('[CLICK] ver pedido', p.pedido_id);
      location.assign(`miCarrito.html?pid=${encodeURIComponent(p.pedido_id)}${uid ? `&uid=${encodeURIComponent(uid)}`:''}`);
    });
    container.appendChild(card);
  });
  root.appendChild(container);
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
      await apiPost('/pedidos/add_item', { pedido_id: pid, producto_id, cantidad: 1 });
      console.log('[FLOW] agregado', producto_id);
    } catch (e) {
      console.log('[FLOW][WARN] no se pudo agregar', producto_id, e?.message || e);
    }
  }
  // Consumimos los IDs del storage para no duplicar en recargas
  clearStoredCartIds();
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
  const uid = getStoredUid();
  const ids = getStoredCartIds();

  const $actual = document.getElementById('pedido-actual');
  const $mis    = document.getElementById('mis-pedidos');

  let pedido = null, detalles = [];

  try {
    if (pid) {
      console.log('[MODE] cargar por pid', pid);
      ({ pedido, detalles } = await cargarPedidoPorPid(pid));
    } else if (ids.length && uid) {
      console.log('[MODE] crear pedido con ids (storage)', ids, 'uid', uid);
      ({ pedido, detalles } = await crearPedidoConIds(uid, ids));
      // limpiar ?ids de la URL si venían (no estrictamente necesario)
      const u = new URL(location.href);
      u.searchParams.delete('ids');
      history.replaceState({}, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash);
    } else {
      console.log('[MODE] no hay pid ni (ids+uid) -> esperando acción del usuario');
    }
  } catch (e) {
    console.log('[ERROR] cargando/creando pedido', e?.message || e);
  }

  // Handlers
  const handlers = {
    add: async (producto_id, n) => {
      if (!pedido?.pedido_id) { console.log('[ADD] no hay pedido actual'); return; }
      try {
        await apiPost('/pedidos/add_item', { pedido_id: pedido.pedido_id, producto_id, cantidad: Number(n) });
        ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
        if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);
      } catch (e) { console.log('[ADD][ERROR]', e?.message || e); }
    },
    remove: async (producto_id, nOrNull) => {
      if (!pedido?.pedido_id) { console.log('[REMOVE] no hay pedido actual'); return; }
      try {
        const body = { pedido_id: pedido.pedido_id, producto_id };
        if (nOrNull != null) body.cantidad = Number(nOrNull); // null => quitar todo
        await apiPost('/pedidos/remove_item', body);
        ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
        if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);
      } catch (e) { console.log('[REMOVE][ERROR]', e?.message || e); }
    }
  };

  if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);

  // Botón comprar
  document.getElementById('btn-comprar')?.addEventListener('click', async () => {
    if (!pedido?.pedido_id) { console.log('[COMPRAR] no hay pedido'); return; }
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
  document.getElementById('btn-vaciar')?.addEventListener('click', async () => {
    if (!pedido?.pedido_id) { console.log('[VACIAR] no hay pedido'); return; }
    try {
      for (const d of (detalles || [])) {
        await apiPost('/pedidos/remove_item', { pedido_id: pedido.pedido_id, producto_id: d.producto_id });
      }
      ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
      if ($actual) renderPedidoActual($actual, pedido, detalles, handlers);
    } catch (e) { console.log('[VACIAR][ERROR]', e?.message || e); }
  });

  // Mis pedidos
  try {
    const mine = uid ? await cargarMisPedidos(uid) : [];
    if ($mis) renderMisPedidos($mis, mine);
  } catch (e) {
    console.log('[ERROR] cargar mis pedidos', e?.message || e);
  }

  // Badge final
  actualizarTotalesYBadge(pedido, detalles);
}

document.addEventListener('DOMContentLoaded', run);
