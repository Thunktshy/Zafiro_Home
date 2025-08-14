// /client-resources/scripts/pedido.js
// Flujo de compra (0→6): modal → crear pedido → leer carrito + stock/precio → calcular → confirmar → agregar líneas → confirmar pedido.

let pedidosAPI, confirmarConVerificacion;       // pedidosManager
let controlPedidosAPI, addItemConVerificacion;  // controlPedidosManager
let productosAPI;                               // productosManager

// Import robusto con rutas fallback
async function importFirst(paths) {
  let lastErr;
  for (const p of paths) {
    try { return await import(p); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

let _apisLoaded = false;
async function loadApis() {
  if (_apisLoaded) return;

  // pedidos
  {
    const mod = await importFirst([
      '/client-resources/scripts/apis/pedidosManager.js',
      '/client-resources/apis/pedidosManager.js',
      '/scripts/apis/pedidosManager.js',
      '/apis/pedidosManager.js'
    ]);
    ({ pedidosAPI, confirmarConVerificacion } = mod);
  }

  // control de pedidos (add/remove/verificar)
  {
    const mod = await importFirst([
      '/client-resources/scripts/apis/controlPedidosManager.js',
      '/client-resources/apis/controlPedidosManager.js',
      '/scripts/apis/controlPedidosManager.js',
      '/apis/controlPedidosManager.js'
    ]);
    ({ controlPedidosAPI, addItemConVerificacion } = mod);
  }

  // productos (para precio y stock)
  {
    const mod = await importFirst([
      '/client-resources/scripts/apis/productosManager.js',
      '/client-resources/apis/productosManager.js',
      '/scripts/apis/productosManager.js',
      '/apis/productosManager.js'
    ]);
    ({ productosAPI } = mod);
  }

  _apisLoaded = true;
}

/////////////////////////////
// Utilidades de interfaz //
/////////////////////////////

const money = (n) => (Number(n)||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showMsg(kind, text) {
  const box = $('#pedidoAlert');
  if (!box) return;
  box.className = `alert alert-${kind}`;
  box.textContent = text;
  box.classList.remove('d-none');
  // Oculta después de unos segundos
  window.clearTimeout(box._t);
  box._t = setTimeout(() => box.classList.add('d-none'), 4000);
}

function showModal() {
  const modalEl = document.getElementById('modalPedido');
  if (!modalEl) return;
  if (window.bootstrap?.Modal) {
    const m = bootstrap.Modal.getOrCreateInstance(modalEl);
    m.show();
  } else {
    console.warn('Bootstrap JS no encontrado. Usando fallback simple para el modal.');
    modalEl.classList.add('show');
    modalEl.style.display = 'block';
    modalEl.removeAttribute('aria-hidden');
    document.body.classList.add('modal-open');

    // Cierre básico
    const hide = () => {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
      modalEl.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    };
    modalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close')
      .forEach(btn => btn.addEventListener('click', hide, { once: true }));
  }
}

function byText(el, sel) {
  const t = el?.querySelector(sel)?.textContent ?? '';
  return String(t).trim();
}

function logPaso(etq, api, data) {
  console.log(`se presiono el boton "${etq}" y se llamo a la api "${api}"`);
  if (data !== undefined) console.log('respuesta :', data);
}
function logError(etq, api, e) {
  console.log(`se presiono el boton "${etq}" y se llamo a la api "${api}"`);
  console.error('respuesta :', e?.message || e);
}

///////////////////////////////////////////////
// 2) Leer carrito, obtener stock y precio  //
///////////////////////////////////////////////

/**
 * Lee cantidades e ids desde la página del carrito (micarrito.html).
 * Espera filas .cart-item con input.js-qty y algún indicio de producto_id:
 * - Badge de texto que contenga "prd-#" en la misma fila
 * - O el orden de localStorage.tmpCartIds como respaldo
 */
function collectCartFromUI() {
  const idsFromLS = (() => {
    try { return JSON.parse(localStorage.getItem('tmpCartIds') || '[]'); }
    catch { return []; }
  })();

  const rows = $$('#cartList .cart-item');
  const items = [];
  rows.forEach((row, idx) => {
    // Ignorar filas "no encontrado"
    const desc = byText(row, '.cart-desc').toLowerCase();
    if (desc.includes('no encontrado')) return;

    const qtyEl = row.querySelector('.js-qty');
    const qty = qtyEl ? Number(qtyEl.value || 0) : 0;
    if (!qty) return;

    // producto_id por badge de texto (patrón prd-xxx) o por respaldo del LS
    const text = row.textContent || '';
    const match = text.match(/prd-[\w-]+/i);
    const producto_id = match ? match[0] : (idsFromLS[idx] || '');

    if (!producto_id) return;
    items.push({ producto_id, cantidad: qty });
  });

  return items;
}

/**
 * Consulta API de productos para enriquecer con stock y precio actual.
 * @param {{producto_id: string, cantidad: number}[]} items
 * @returns {Promise<Array<{producto_id, nombre, cantidad, stock, price}>>}
 */
async function enrichWithStockPrice(items) {
  const out = [];
  for (const it of items) {
    try {
      const r = await productosAPI.getOne(it.producto_id);
      const row = Array.isArray(r?.data) ? r.data[0] : (r?.data || r);
      out.push({
        producto_id: it.producto_id,
        nombre: row?.nombre_producto || '(Sin nombre)',
        cantidad: Number(it.cantidad || 0),
        stock: Number(row?.stock || 0),
        price: Number(row?.precio_unitario || 0)
      });
    } catch {
      out.push({
        producto_id: it.producto_id,
        nombre: '(No disponible)',
        cantidad: 0,
        stock: 0,
        price: 0
      });
    }
  }
  return out;
}

//////////////////////////////////////
// 3) Calcular y pintar el resumen  //
//////////////////////////////////////

function resumenHTML(items) {
  const rows = items.map(it => {
    const ok = it.cantidad > 0 && it.cantidad <= it.stock;
    const line = Number(it.cantidad || 0) * Number(it.price || 0);
    return `
      <li class="mb-1">
        <strong>${it.producto_id}</strong> — ${it.nombre}
        &times; ${it.cantidad} @ ${money(it.price)} =
        <strong>${money(line)}</strong>
        ${ok ? '' : '<span class="text-danger"> (ajustar cantidad/stock)</span>'}
      </li>`;
  }).join('');
  const total = items.reduce((acc, it) => acc + (Number(it.cantidad||0) * Number(it.price||0)), 0);
  return `
    <div>
      <strong>Artículos:</strong>
      <ul class="mt-2">${rows}</ul>
      <div class="mt-2"><strong>Total estimado:</strong> ${money(total)}</div>
    </div>`;
}

/////////////////////////////////////////////
// 0→6  Abrir modal y ejecutar todo el flujo
/////////////////////////////////////////////

export async function openPedidoModal() {
  await loadApis();

  const uid = sessionStorage.getItem('uid') || '';
  if (!uid) { showMsg('warning', 'Inicia sesión para completar tu compra.'); return; }

  // 0) Abrir modal
  showModal();

  // Elementos de UI del modal
  const form = $('#formPedido');
  const btnConfirm = $('#btnCrearPedido');
  const resumenBox = $('#pedidoResumen');
  const metodoPagoSel = $('#selPago');

  if (!form || !btnConfirm || !resumenBox) {
    console.warn('Modal pedido: faltan elementos #formPedido, #btnCrearPedido o #pedidoResumen.');
  }

  // 1) Crear pedido (encabezado)
  let pedido_id = '';
  try {
    const metodo_pago = metodoPagoSel?.value || 'NA';
    logPaso('Crear pedido', '/pedidos/insert');
    const ins = await pedidosAPI.insert({ cliente_id: uid, metodo_pago });
    logPaso('Crear pedido', '/pedidos/insert', ins);
    pedido_id = ins?.data?.pedido_id || ins?.pedido_id || '';
    if (!pedido_id) throw new Error('No se pudo crear el pedido');
  } catch (e) {
    logError('Crear pedido', '/pedidos/insert', e);
    showMsg('danger', e?.message || 'No se pudo crear el pedido.');
    return;
  }

  // 2) Leer cantidades/ids productos + 3) obtener stock y precio, calcular y renderizar
  let enriched = [];
  try {
    const rawItems = collectCartFromUI();
    if (!rawItems.length) {
      showMsg('warning', 'No hay artículos disponibles para comprar.');
      return;
    }
    enriched = await enrichWithStockPrice(rawItems);
    resumenBox.innerHTML = resumenHTML(enriched);
  } catch {
    showMsg('danger', 'No se pudieron obtener precios/stock.');
    return;
  }

  // 4→6 en submit del formulario (cliente presiona confirmar)
  const submitHandler = async (ev) => {
    ev.preventDefault();
    btnConfirm.disabled = true;

    try {
      // Releer cantidades por si el usuario cambió algo en el carrito abierto detrás
      const latest = collectCartFromUI();
      const merged = await enrichWithStockPrice(latest);

      // Validación rápida de stock y cantidades
      const invalid = merged.filter(x => !(x.cantidad > 0 && x.cantidad <= x.stock));
      if (invalid.length) {
        showMsg('warning', 'Ajusta las cantidades según stock antes de confirmar.');
        btnConfirm.disabled = false;
        return;
      }

      // 5) Agregar productos al pedido (cantidad + precio_unitario)
      for (const it of merged) {
        const payload = {
          pedido_id,
          producto_id: it.producto_id,
          cantidad: Number(it.cantidad || 0),
          precio_unitario: Number(it.price || 0)
        };
        logPaso('Agregar item', '/pedidos/add_item', payload);
        await addItemConVerificacion(payload, controlPedidosAPI);
      }

      // 6) Intentar confirmar “Confirmado”
      try {
        logPaso('Confirmar pedido', '/pedidos/confirmar', { pedido_id });
        const conf = await confirmarConVerificacion(pedido_id, pedidosAPI, controlPedidosAPI);
        logPaso('Confirmar pedido', '/pedidos/confirmar', conf);
        showMsg('success', '¡Pedido confirmado!');
      } catch (e) {
        if (e?.faltantes?.length) {
          const falt = e.faltantes.map(f =>
            `${f.producto_id} (req: ${f.requerido}, disp: ${f.stock_disponible})`).join('; ');
          showMsg('warning', `Pedido creado pero con faltantes: ${falt}.`);
        } else {
          showMsg('warning', e?.message || 'No se pudo confirmar. El pedido quedó "Por confirmar".');
        }
      }

      // Limpieza de carrito local + log legacy
      localStorage.removeItem('tmpCartIds');
      localStorage.removeItem('temProdIds');
      console.log('local storage tem prodIds = []');

      // Redirección ligera post-éxito
      setTimeout(() => {
        location.href = `/client-resources/pages/miCuenta.html?uid=${encodeURIComponent(uid)}`;
      }, 1200);

    } catch (e) {
      logError('Finalizar compra', '/pedidos', e);
      showMsg('danger', e?.message || 'No se pudo realizar el pedido.');
    } finally {
      btnConfirm.disabled = false;
      form.removeEventListener('submit', submitHandler);
    }
  };

  form?.addEventListener('submit', submitHandler, { once: true });
}
