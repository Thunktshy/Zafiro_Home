// /Public/scripts/miCarrito.js
// Lee ?pid=... o ?ids=a,b,c & uid=...  -> crea/recupera pedido y lo pinta.
// Llama a /pedidos/* siguiendo tus rutas del backend.

function qs(name) {
  const url = new URL(location.href);
  const v = url.searchParams.get(name);
  return v && v.trim() !== '' ? v : null;
}

function money(n) {
  const x = Number(n) || 0;
  return x.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

async function apiGet(url) {
  console.log('GET', url);
  const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' }});
  const t = await r.text();
  const j = (r.headers.get('content-type')||'').includes('application/json') ? JSON.parse(t||'{}') : {};
  if (!r.ok) throw new Error(j.message || ('GET ' + url + ' -> ' + r.status));
  console.log('GET ok', url, j);
  return j;
}

async function apiPost(url, body) {
  console.log('POST', url, body);
  const r = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const t = await r.text();
  const j = (r.headers.get('content-type')||'').includes('application/json') ? JSON.parse(t||'{}') : {};
  if (!r.ok) throw new Error(j.message || ('POST ' + url + ' -> ' + r.status));
  console.log('POST ok', url, j);
  return j;
}

// ============ RENDER ============

function renderLinea(det, handlers) {
  const { producto_id, nombre_producto, cantidad, precio_unitario, subtotal, image_url } = det;
  const card = el(`
    <div class="cart-card" data-pid="${producto_id}">
      <img class="cart-img" src="${image_url || 'https://picsum.photos/seed/'+encodeURIComponent(producto_id)+'/160/160'}" alt="">
      <div>
        <div class="cart-title">${nombre_producto || producto_id}</div>
        <div class="cart-meta">ID: ${producto_id}</div>
        <div class="qty" style="margin-top:.4rem">
          <button class="btn-dec" title="Restar">−</button>
          <input class="inp-qty" type="number" min="1" value="${Number(cantidad)||1}">
          <button class="btn-inc" title="Sumar">+</button>
          <button class="btn-danger btn-del" style="margin-left:.5rem">Quitar</button>
        </div>
      </div>
      <div class="price">${money(subtotal || (precio_unitario * cantidad))}</div>
    </div>
  `);

  const btnInc = card.querySelector('.btn-inc');
  const btnDec = card.querySelector('.btn-dec');
  const btnDel = card.querySelector('.btn-del');
  const inpQty = card.querySelector('.inp-qty');

  btnInc.addEventListener('click', () => handlers.add(producto_id, 1));
  btnDec.addEventListener('click', () => handlers.remove(producto_id, 1));
  btnDel.addEventListener('click', () => handlers.remove(producto_id, null)); // null => quitar todo
  inpQty.addEventListener('change', () => {
    const targetQty = Math.max(1, Number(inpQty.value)||1);
    const cur = Number(cantidad)||1;
    const diff = targetQty - cur;
    if (diff > 0) handlers.add(producto_id, diff);
    else if (diff < 0) handlers.remove(producto_id, Math.abs(diff));
  });

  return card;
}

function renderPedidoActual(root, pedido, detalles, handlers) {
  root.innerHTML = '';
  if (!pedido) {
    root.appendChild(el(`<div class="empty">No hay pedido actual.</div>`));
    return;
  }
  const list = document.createDocumentFragment();
  detalles.forEach(det => list.appendChild(renderLinea(det, handlers)));
  root.appendChild(list);

  const total = detalles.reduce((a, d) => a + Number(d.subtotal || (d.precio_unitario * d.cantidad) || 0), 0);
  document.getElementById('total-label').textContent = `Total: ${money(total)}`;
  const badge = document.getElementById('pedido-badge');
  badge.textContent = `Pedido ${pedido.pedido_id || ''} — Estado: ${pedido.estado || 'Abierto'}`;
}

// Mis pedidos agrupados
function renderMisPedidos(root, pedidos) {
  root.innerHTML = '';
  if (!Array.isArray(pedidos) || pedidos.length === 0) {
    root.appendChild(el(`<div class="empty">Sin pedidos.</div>`));
    return;
  }
  const container = document.createDocumentFragment();
  pedidos.forEach(p => {
    const card = el(`
      <div class="cart-card" data-pedido="${p.pedido_id}">
        <div style="flex:1">
          <div class="cart-title">Pedido ${p.pedido_id}</div>
          <div class="cart-meta">Estado: ${p.estado} · Fecha: ${p.fecha_creacion || ''}</div>
        </div>
        <button class="btn-primary btn-ver">Ver</button>
      </div>
    `);
    card.querySelector('.btn-ver').addEventListener('click', () => {
      console.log('se presiono ver pedido', p.pedido_id);
      location.assign(`miCarrito.html?pid=${encodeURIComponent(p.pedido_id)}&uid=${encodeURIComponent(String(p.cliente_id || qs('uid') || ''))}`);
    });
    container.appendChild(card);
  });
  root.appendChild(container);
}

// ============ FLUJO ============

async function cargarPedidoPorPid(pid) {
  console.log('cargarPedidoPorPid', pid);
  const pedido = (await apiGet(`/pedidos/get/${encodeURIComponent(pid)}`)).data;            // GET pedido  :contentReference[oaicite:12]{index=12}
  const detalles = (await apiGet(`/pedidos/get_detalles/${encodeURIComponent(pid)}`)).data; // GET detalles :contentReference[oaicite:13]{index=13}
  return { pedido, detalles };
}

async function crearPedidoConIds(uid, ids) {
  console.log('crearPedidoConIds', uid, ids);
  // 1) crear pedido
  const creado = await apiPost('/pedidos/insert', { cliente_id: uid }); // insert  :contentReference[oaicite:14]{index=14}
  const pid = (creado?.data?.pedido_id) || (creado?.data?.pedido?.pedido_id) || creado?.pedido_id;
  if (!pid) throw new Error('No se pudo crear el pedido');
  console.log('pedido creado', pid);

  // 2) agregar items (1 c/u)
  for (const producto_id of ids) {
    try {
      await apiPost('/pedidos/add_item', { pedido_id: pid, producto_id, cantidad: 1 }); // add_item  :contentReference[oaicite:15]{index=15}
      console.log('agregado producto', producto_id);
    } catch (e) {
      console.log('error agregando producto', producto_id, e?.message || e);
    }
  }

  // 3) devolver pedido listo
  return cargarPedidoPorPid(pid);
}

async function cargarMisPedidos(uid) {
  console.log('cargarMisPedidos', uid);
  const r = await apiGet(`/pedidos/por_cliente/${encodeURIComponent(uid)}`); // por_cliente  :contentReference[oaicite:16]{index=16}
  return Array.isArray(r.data) ? r.data : [];
}

async function run() {
  console.log('init miCarrito');
  const pid = qs('pid');
  const uid = qs('uid');
  const ids = (qs('ids') || '').split(',').map(s => s.trim()).filter(Boolean);

  const $actual = document.getElementById('pedido-actual');
  const $mis = document.getElementById('mis-pedidos');

  let pedido = null, detalles = [];

  try {
    if (pid) {
      console.log('modo: cargar por pid', pid);
      ({ pedido, detalles } = await cargarPedidoPorPid(pid));
    } else if (ids.length && uid) {
      console.log('modo: crear pedido con ids', ids, 'uid', uid);
      ({ pedido, detalles } = await crearPedidoConIds(uid, ids));
      // limpiar ids de la URL para evitar duplicar si recarga
      const u = new URL(location.href);
      u.searchParams.delete('ids');
      history.replaceState({}, '', u.pathname + u.search + u.hash);
    } else {
      console.log('no hay pid ni ids -> nada que mostrar todavía');
    }
  } catch (e) {
    console.log('error cargando/creando pedido', e?.message || e);
  }

  // Handlers +/−/del aplican sobre el pedido actual
  const handlers = {
    add: async (producto_id, n) => {
      if (!pedido?.pedido_id) return;
      console.log('sumar cantidad', producto_id, n);
      try {
        await apiPost('/pedidos/add_item', { pedido_id: pedido.pedido_id, producto_id, cantidad: Number(n) }); // :contentReference[oaicite:17]{index=17}
        ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
        renderPedidoActual($actual, pedido, detalles, handlers);
      } catch (e) {
        console.log('error al sumar', e?.message || e);
      }
    },
    remove: async (producto_id, nOrNull) => {
      if (!pedido?.pedido_id) return;
      console.log('restar/quitar', producto_id, nOrNull);
      try {
        const body = { pedido_id: pedido.pedido_id, producto_id };
        if (nOrNull != null) body.cantidad = Number(nOrNull); // si null => quitar todo
        await apiPost('/pedidos/remove_item', body); // :contentReference[oaicite:18]{index=18}
        ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
        renderPedidoActual($actual, pedido, detalles, handlers);
      } catch (e) {
        console.log('error al restar/quitar', e?.message || e);
      }
    }
  };

  renderPedidoActual($actual, pedido, detalles, handlers);

  // Botones globales
  document.getElementById('btn-comprar')?.addEventListener('click', async () => {
    if (!pedido?.pedido_id) { console.log('no hay pedido para comprar'); return; }
    console.log('se presiono comprar ahora');
    try {
      await apiPost('/pedidos/set_estado', { pedido_id: pedido.pedido_id, estado: 'Completado' }); // :contentReference[oaicite:19]{index=19}
      ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
      renderPedidoActual($actual, pedido, detalles, handlers);
      alert('¡Pedido completado!');
    } catch (e) {
      console.log('error al completar pedido', e?.message || e);
      alert(e?.message || 'No se pudo completar el pedido');
    }
  });

  document.getElementById('btn-vaciar')?.addEventListener('click', async () => {
    if (!pedido?.pedido_id) { console.log('no hay pedido para vaciar'); return; }
    console.log('se presiono vaciar carrito');
    try {
      // quita todas las líneas existentes
      for (const d of (detalles || [])) {
        await apiPost('/pedidos/remove_item', { pedido_id: pedido.pedido_id, producto_id: d.producto_id }); // quitar todo :contentReference[oaicite:20]{index=20}
      }
      ({ pedido, detalles } = await cargarPedidoPorPid(pedido.pedido_id));
      renderPedidoActual($actual, pedido, detalles, handlers);
    } catch (e) {
      console.log('error al vaciar', e?.message || e);
    }
  });

  // Mis pedidos
  try {
    const mine = uid ? await cargarMisPedidos(uid) : [];
    renderMisPedidos($mis, mine);
  } catch (e) {
    console.log('error cargando mis pedidos', e?.message || e);
  }

  // Mostrar badge
  const badge = document.getElementById('pedido-badge');
  if (pedido?.pedido_id) badge.textContent = `Pedido ${pedido.pedido_id} — Estado: ${pedido.estado || 'Abierto'}`;
  else badge.textContent = 'Sin pedido';
}

document.addEventListener('DOMContentLoaded', run);
