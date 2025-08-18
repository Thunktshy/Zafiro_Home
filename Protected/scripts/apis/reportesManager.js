// Public/scripts/apis/reportesManager.js
const BASE = '/reportes';

// Extrae el mensaje de error, si existe
function extractErrorMessage(data, res) {
  if (data && typeof data === 'object')
    return data.message || data.error || `Error ${res.status}`;
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

// Serializa los parámetros a query string
function toQS(params = {}) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return entries.length ? `?${entries.join('&')}` : '';
}

// Realiza la petición fetch a la API, usando JSON o FormData
async function apiFetch(path, { method = 'GET', body, bodyType } = {}) {
  const opts = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body != null) {
    if (!bodyType || bodyType === 'json') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      opts.body = body; // Para FormData u otros tipos
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(extractErrorMessage(data, res));
  return data;
}

// API para reportes
export const reportesAPI = {
  // Ventas mensual por producto (pivot)
  ventasMensualPivot: (desde, hasta) => {
    // Envía fechas en formato YYYY-MM-DD o compatible con Date
    return apiFetch(`/ventas_mensual_pivot${toQS({ desde, hasta })}`);
  },

  // Top ventas por producto (ranking)
  topVentas: (desde, hasta, limit = 10) => {
    const n = Number(limit || 10);
    // El backend acepta 'limit', ignora 'top' (se deja solo 'limit' para limpieza)
    return apiFetch(`/top_ventas${toQS({ desde, hasta, limit: n })}`);
  },

  // Clasificación de clientes por frecuencia
  clientesFrecuencia: (desde, hasta) => {
    return apiFetch(`/clientes_frecuencia_compra${toQS({ desde, hasta })}`);
  },

  // Historial de compras por cliente (cliente_id en formato 'cl-#')
  historialCliente: (cliente_id, desde, hasta) => {
    let cid = String(cliente_id || '').trim();
    if (!cid) throw new Error('cliente_id es requerido');
    // Normaliza para enviar siempre 'cl-#'
    if (!cid.startsWith('cl-')) cid = 'cl-' + cid;
    return apiFetch(`/historial_cliente${toQS({ cliente_id: cid, desde, hasta })}`);
  },
};
