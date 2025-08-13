// scripts/apis/pedidosManager.js
// Envíos a la API de Pedidos (usa cookies de sesión)
// Debe coincidir con el montaje del server: app.use('/pedidos', PedidosRouter)
const BASE = '/pedidos';

// Helpers de IDs con prefijo
const ensurePrefix = (v, prefix) => {
  const s = String(v ?? '').trim();
  if (!s) return s;
  return s.startsWith(prefix) ? s : `${prefix}${s}`;
};
const ped = (id) => ensurePrefix(id, 'ped-');
const cli = (id) => ensurePrefix(id, 'cl-');

/** Extrae un mensaje de error útil desde { message } | { error } | texto. */
function extractErrorMessage(data, res) {
  if (data && typeof data === 'object') return data.message || data.error || `Error ${res.status}`;
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

/**
 * apiFetch:
 * - credentials: 'include' (cookies de sesión)
 * - Content-Type JSON por defecto (o body raw si se indica)
 * - Parse seguro JSON/text
 * - Lanza Error con mensaje claro si !res.ok
 */
async function apiFetch(path, { method = 'GET', body, bodyType } = {}) {
  const opts = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body != null) {
    if (!bodyType || bodyType === 'json') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      opts.body = body; // p.ej. FormData
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(extractErrorMessage(data, res));
  return data;
}

export const pedidosAPI = {
  // ---------------------------------------------------------
  // ALTA (ingresa) — CLIENTE
  // requiere : { cliente_id:'cl-<n>', metodo_pago?:string<=20 }
  // ingresa  : Crea pedido vacío (estado 'Por confirmar')
  // devuelve : { success:true, data:{ pedido_id, pedido, detalles:[] } }
  // POST /pedidos/insert
  // ---------------------------------------------------------
  insert: ({ cliente_id, metodo_pago }) =>
    apiFetch('/insert', { method: 'POST', body: { cliente_id: cli(cliente_id), metodo_pago: metodo_pago ?? null } }),

  // ---------------------------------------------------------
  // CONFIRMAR — CLIENTE
  // requiere : { pedido_id:'ped-<n>' }
  // devuelve : { success:true, data:{ pedido, detalles[] } }
  // POST /pedidos/confirmar
  // ---------------------------------------------------------
  confirmar: (pedido_id) =>
    apiFetch('/confirmar', { method: 'POST', body: { pedido_id: ped(pedido_id) } }),

  // ---------------------------------------------------------
  // CANCELAR — CLIENTE
  // requiere : { pedido_id:'ped-<n>' }
  // devuelve : { success:true, data:{ pedido, detalles[] } }
  // POST /pedidos/cancelar
  // ---------------------------------------------------------
  cancelar: (pedido_id) =>
    apiFetch('/cancelar', { method: 'POST', body: { pedido_id: ped(pedido_id) } }),

  // ---------------------------------------------------------
  // OBTENER ENCABEZADO — CLIENTE
  // requiere : pedido_id:'ped-<n>'
  // devuelve : { success:true, data:{...} | null }
  // GET /pedidos/get/:pedido_id
  // ---------------------------------------------------------
  getOne: (pedido_id) => apiFetch(`/get/${encodeURIComponent(ped(pedido_id))}`),

  // ---------------------------------------------------------
  // OBTENER DETALLES — CLIENTE
  // requiere : pedido_id:'ped-<n>'
  // devuelve : { success:true, data:Array<detalle> }
  // GET /pedidos/get_detalles/:pedido_id
  // ---------------------------------------------------------
  getDetalles: (pedido_id) => apiFetch(`/get_detalles/${encodeURIComponent(ped(pedido_id))}`),

  // ---------------------------------------------------------
  // LISTAR DEL CLIENTE — CLIENTE
  // requiere : cliente_id:'cl-<n>'
  // devuelve : { success:true, data:Array<pedido> }
  // GET /pedidos/por_cliente/:cliente_id
  // ---------------------------------------------------------
  getByCliente: (cliente_id) => apiFetch(`/por_cliente/${encodeURIComponent(cli(cliente_id))}`),

  // ---------------------------------------------------------
  // LISTAR POR ESTADO — ADMIN
  // requiere : estado:'Por confirmar'|'Confirmado'|'Cancelado'
  // devuelve : { success:true, data:Array<pedido> }
  // GET /pedidos/por_estado/:estado
  // ---------------------------------------------------------
  getByEstado: (estado) => apiFetch(`/por_estado/${encodeURIComponent(String(estado ?? '').trim())}`),

  // ---------------------------------------------------------
  // LISTAR 'POR CONFIRMAR' — ADMIN
  // requiere : nada
  // devuelve : { success:true, data:Array<pedido> }
  // GET /pedidos/por_confirmar
  // ---------------------------------------------------------
  getPorConfirmar: () => apiFetch('/por_confirmar')
};
