// Public/scripts/apis/controlPedidosManager.js
// Envíos a la API de control de Pedidos (usa cookies de sesión)
const BASE = '/pedidos';

const ensurePrefix = (v, prefix) => {
  const s = String(v ?? '').trim();
  return s && !s.startsWith(prefix) ? `${prefix}${s}` : s;
};
const ped = (id) => ensurePrefix(id, 'ped-');
const prd = (id) => ensurePrefix(id, 'prd-');

/** Extrae mensaje de error útil desde { message } | { error } | texto. */
function extractErrorMessage(data, res) {
  if (data && typeof data === 'object') return data.message || data.error || `Error ${res.status}`;
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

/** apiFetch con cookies + JSON por defecto */
async function apiFetch(path, { method = 'GET', body, bodyType } = {}) {
  const opts = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body != null) {
    if (!bodyType || bodyType === 'json') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      opts.body = body; // FormData/binario
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(extractErrorMessage(data, res));
  return data;
}

export async function addItemConVerificacion(payload, api = controlPedidosAPI) {
  try {
    return await api.addItem(payload);
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg.toLowerCase().includes('stock insuficiente')) {
      const faltantes = await api.verificarProductos(payload.pedido_id).catch(() => ({ data: [] }));
      const err = new Error('Stock insuficiente');
      err.faltantes = Array.isArray(faltantes?.data) ? faltantes.data : [];
      throw err;
    }
    throw e;
  }
}


export const controlPedidosAPI = {
  // ---------------------------------------------------------
  // AGREGA LÍNEA (ingresa)
  // requiere : { pedido_id:'ped-#'|#, producto_id:'prd-#'|#, cantidad?:int>=1, precio_unitario?:number }
  // ingresa  : Crea/actualiza línea en detalle_pedidos
  // devuelve : { success:true, data:Array<detalles> }
  // POST /pedidos/add_item
  // ---------------------------------------------------------
  addItem: ({ pedido_id, producto_id, cantidad, precio_unitario }) =>
    apiFetch('/add_item', {
      method: 'POST',
      body: {
        pedido_id: ped(pedido_id),
        producto_id: prd(producto_id),
        ...(cantidad != null ? { cantidad: Number(cantidad) } : {}),
        ...(precio_unitario != null ? { precio_unitario: Number(precio_unitario) } : {})
      }
    }),

  // ---------------------------------------------------------
  // QUITA / DECREMENTA LÍNEA
  // requiere : { pedido_id:'ped-#'|#, producto_id:'prd-#'|#, cantidad?:int>=1 }
  // elimina  : Si cantidad = null → borra toda la línea; si >0 → resta
  // devuelve : { success:true, data:Array<detalles> }
  // POST /pedidos/remove_item
  // ---------------------------------------------------------
  removeItem: ({ pedido_id, producto_id, cantidad }) =>
    apiFetch('/remove_item', {
      method: 'POST',
      body: {
        pedido_id: ped(pedido_id),
        producto_id: prd(producto_id),
        ...(cantidad != null ? { cantidad: Number(cantidad) } : {})
      }
    }),

  // ---------------------------------------------------------
  // CAMBIA ESTADO
  // requiere : { pedido_id:'ped-#'|#, estado:'Por confirmar'|'Confirmado'|'Cancelado' }
  // devuelve : { success:true, data:{ pedido, detalles[] } }
  // POST /pedidos/set_estado
  // ---------------------------------------------------------
  setEstado: ({ pedido_id, estado }) =>
    apiFetch('/set_estado', {
      method: 'POST',
      body: {
        pedido_id: ped(pedido_id),
        estado: String(estado ?? '').trim()
      }
    }),

  // ---------------------------------------------------------
  // VERIFICAR STOCK NECESARIO PARA EL PEDIDO
  // requiere : pedido_id:'ped-#'|#
  // devuelve : { success:true, data:Array<{producto_id, requerido, stock_disponible, deficit}> }
  // GET /pedidos/verificar_productos/:pedido_id
  // ---------------------------------------------------------
  verificarProductos: (pedido_id) =>
    apiFetch(`/verificar_productos/${encodeURIComponent(ped(pedido_id))}`)
};
