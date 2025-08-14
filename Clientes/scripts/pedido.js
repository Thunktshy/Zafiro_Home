// /client-resources/scripts/pedido.js
// Crea/confirmar pedido leyendo el carrito y mostrando un modal de envío/pago.

let pedidosAPI, confirmarConVerificacion;
let controlPedidosAPI, addItemConVerificacion;
let clientsAPI, datosPersonalesAPI, datosFacturacionAPI, metodosPagoAPI;

async function loadApis() {
  try {
    ({ pedidosAPI, confirmarConVerificacion } = await import('/client-resources/scripts/apis/pedidosManager.js'));
  } catch { ({ pedidosAPI, confirmarConVerificacion } = await import('/scripts/apis/pedidosManager.js')); }

  try {
    ({ controlPedidosAPI, addItemConVerificacion } = await import('/client-resources/scripts/apis/controlPedidosManager.js'));
  } catch { ({ controlPedidosAPI, addItemConVerificacion } = await import('/scripts/apis/controlPedidosManager.js')); }

  try {
    ({ clientsAPI } = await import('/client-resources/scripts/apis/clientesManager.js'));
  } catch { ({ clientsAPI } = await import('/scripts/apis/clientesManager.js')); }

  try {
    ({ datosPersonalesAPI } = await import('/client-resources/scripts/apis/datosPersonalesManager.js'));
  } catch { ({ datosPersonalesAPI } = await import('/scripts/apis/datosPersonalesManager.js')); }

  try {
    ({ datosFacturacionAPI } = await import('/client-resources/scripts/apis/datosFacturacionManager.js'));
  } catch { ({ datosFacturacionAPI } = await import('/scripts/apis/datosFacturacionManager.js')); }

  try {
    ({ metodosPagoAPI } = await import('/client-resources/scripts/apis/metodosPagoManager.js'));
  } catch { ({ metodosPagoAPI } = await import('/scripts/apis/metodosPagoManager.js')); }

  try {
    ({ productosAPI } = await import('/client-resources/scripts/apis/productosManager.js'));
  } catch {
    ({ productosAPI } = await import('/scripts/apis/productosManager.js'));
  }
}

// ====== Utils ======
const money = (n) => (Number(n)||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const $ = (sel) => document.querySelector(sel);
const $$ = (sel)=> Array.from(document.querySelectorAll(sel));
const byText = (el, sel) => (el && el.querySelector(sel)) ? el.querySelector(sel).textContent.trim() : '';
function showMsg(kind, text) {
  const box = $('#pedidoAlert'); if (!box) return;
  box.className = `alert alert-${kind}`; box.textContent = text; box.classList.remove('d-none');
  setTimeout(() => box.classList.add('d-none'), 3500);
}
function logPaso(btn, api, resp) { console.log(`se preciono el boton "${btn}" y se llamo a la api "${api}"`); if (resp) console.log('respuesta :', resp); }
function logError(btn, api, e) { console.log(`se preciono el boton "${btn}" y se llamo a la api "${api}"`); console.error('respuesta :', e?.message || e); }

// Lee ids del carrito y cantidades actuales desde la UI de micarrito
function collectCartFromUI() {
  const ids = JSON.parse(localStorage.getItem('tmpCartIds') || '[]');
  const rows = $$('#cartList .cart-item');
  const items = [];

  rows.forEach((row, i) => {
    const desc = byText(row, '.cart-desc');
    if (desc.toLowerCase().includes('no encontrado')) return; // ignora no encontrados
    const qtyEl = row.querySelector('.js-qty');
    const qty = qtyEl ? Number(qtyEl.value || 0) : 0;
    if (!qty) return;

    // intenta leer id visible (badge con 'prd-#'), si no, cae al orden de ids
    const rawId = (row.textContent.match(/prd-\w+/i) || [])[0] || ids[i] || '';
    if (!rawId) return;

    items.push({ producto_id: rawId, cantidad: qty });
  });
  return items;
}

// Prefill de datos del cliente
async function prefillCliente(uid) {
  try {
    const cli = await clientsAPI.getOne(uid).catch(()=>null); // :contentReference[oaicite:13]{index=13}
    const per = await datosPersonalesAPI.getByCliente(uid).catch(()=>({ data:[] })); // :contentReference[oaicite:14]{index=14}
    const fis = await datosFacturacionAPI.getByCliente(uid).catch(()=>({ data:[] })); // :contentReference[oaicite:15]{index=15}
    const met = await metodosPagoAPI.getByCliente(uid).catch(()=>({ data:[] })); // :contentReference[oaicite:16]{index=16}

    const p = Array.isArray(per?.data) ? per.data[0] : per?.data || null;

    $('#shipNombre').value    = p?.nombre || '';
    $('#shipApellidos').value = p?.apellidos || '';
    $('#shipTelefono').value  = p?.telefono || '';
    $('#shipDireccion').value = p?.direccion || '';
    $('#shipCiudad').value    = p?.ciudad || '';
    $('#shipCP').value        = p?.codigo_postal || '';
    $('#shipPais').value      = p?.pais || 'México';

    const sel = $('#selPago');
    const list = Array.isArray(met?.data) ? met.data : [];
    sel.innerHTML = `<option value="">Selecciona…</option>` + (
      list.map(m => `<option value="${String(m.tipo||'Otro')}">${String(m.tipo||'Otro')} ${m.es_principal? '(principal)':''}</option>`).join('')
      || `<option value="Tarjeta (demo)">Tarjeta (demo)</option>
          <option value="Transferencia (demo)">Transferencia (demo)</option>
          <option value="Efectivo (demo)">Efectivo (demo)</option>`
    );

    return { cli, per: p, fis, met: list };
  } catch (e) {
    console.warn('prefillCliente error', e);
    return {};
  }
}

function resumenHTML(items) {
  const total = items.reduce((acc, it) => acc + (Number(it.price||0) * Number(it.cantidad||0)), 0);
  const lines = items.map(it => `<li>${it.producto_id} × ${it.cantidad}</li>`).join('');
  return `<div><strong>Artículos:</strong><ul>${lines}</ul><div><strong>Total estimado:</strong> ${money(total)}</div></div>`;
}

// ====== Flujo principal ======
export async function openPedidoModal() {
  await loadApis();

  const uid = sessionStorage.getItem('uid') || '';
  if (!uid) { showMsg('warning','No se encontró sesión de cliente.'); return; }

  const items = collectCartFromUI();
  if (!items.length) { showMsg('warning','No hay artículos disponibles para comprar.'); return; }

  // Prefill y resumen
  await prefillCliente(uid);
  $('#pedidoResumen').innerHTML = resumenHTML(items);

  // Mostrar modal
  const m = bootstrap.Modal.getOrCreateInstance('#modalPedido');
  m.show();

  // Enviar pedido
  const form = $('#formPedido');
  const btn  = $('#btnCrearPedido');
  const onSubmit = async (ev) => {
    ev.preventDefault();
    btn.disabled = true;

    const metodo_pago = $('#selPago').value || 'demo';
    try {
      // 1) Insertar pedido
      logPaso('Finalizar compra', '/pedidos/insert');
      const ins = await pedidosAPI.insert({ cliente_id: uid, metodo_pago }); // crea encabezado
      logPaso('Finalizar compra', '/pedidos/insert', ins);
      const pedido_id = ins?.data?.pedido_id || ins?.pedido_id || '';

      if (!pedido_id) throw new Error('No se pudo crear el pedido');

      // 2) Agregar cada línea con cantidad + precio_unitario
      for (const it of items) {
        // it: { producto_id, cantidad } recolectado del DOM
        // Obtenemos precio_unitario confiable desde la API de productos
        let precio_unitario = 0;
        try {
          const p = await productosAPI.getOne(it.producto_id);
          const row = Array.isArray(p?.data) ? p.data[0] : p?.data || p;
          precio_unitario = Number(row?.precio_unitario || 0);
        } catch {}

        const payload = {
          pedido_id,
          producto_id: it.producto_id,
          cantidad: Number(it.cantidad || 0),
          precio_unitario
        };

        logPaso('Agregar item', '/pedidos/add_item', payload);
        await addItemConVerificacion(payload, controlPedidosAPI);
      }

      // 3) Confirmar (intentará y reportará faltantes si hay)
      try {
        logPaso('Confirmar pedido', '/pedidos/confirmar', { pedido_id });
        const conf = await confirmarConVerificacion(pedido_id, pedidosAPI, controlPedidosAPI);
        logPaso('Confirmar pedido', '/pedidos/confirmar', conf);
      } catch (e) {
        if (e?.faltantes?.length) {
          const falt = e.faltantes.map(f => `${f.producto_id} (req: ${f.requerido}, disp: ${f.stock_disponible})`).join('; ');
          showMsg('warning', `Pedido creado pero con faltantes: ${falt}. Nuestro equipo te contactará.`);
        } else {
          showMsg('warning', e?.message || 'No se pudo confirmar. Quedó Por confirmar.');
        }
      }

      // 4) Éxito total
      showMsg('success','¡Tu pedido fue creado!');
      // Limpia carrito y cierra modal
      localStorage.setItem('tmpCartIds', '[]');
      localStorage.removeItem('tmpCartIds');
      localStorage.removeItem('temProdIds');
      console.log('local storage tem prodIds = []');
      setTimeout(() => location.href = `/client-resources/pages/miCuenta.html?uid=${encodeURIComponent(uid)}`, 1200);
    } catch (e) {
      logError('Finalizar compra', '/pedidos', e);
      showMsg('danger', e?.message || 'No se pudo realizar el pedido.');
    } finally {
      btn.disabled = false;
      form.removeEventListener('submit', onSubmit);
    }
  };

  form.addEventListener('submit', onSubmit, { once: true });
}
