// Public/scripts/apis/reportesManager.js
const BASE = '/reportes';

function extractErrorMessage(data, res) {
  if (data && typeof data === 'object') return data.message || data.error || `Error ${res.status}`;
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

function toQS(params = {}) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return entries.length ? `?${entries.join('&')}` : '';
}

async function apiFetch(path, { method = 'GET', body, bodyType } = {}) {
  const opts = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body != null) {
    if (!bodyType || bodyType === 'json') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      opts.body = body; // ej. FormData
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(extractErrorMessage(data, res));
  return data;
}

export const reportesAPI = {
  // GET /reportes/ventas_mensual_pivot?desde=...&hasta=...
  ventasMensualPivot: (desde, hasta) =>
    apiFetch(`/ventas_mensual_pivot${toQS({ desde, hasta })}`),

  // GET /reportes/top_ventas?desde=...&hasta=...&limit=10
  topVentas: (desde, hasta, limit = 10) => {
    const n = Number(limit || 10);
    // Enviar limit y top para compatibilidad con el validador/ruta del backend
    return apiFetch(`/top_ventas${toQS({ desde, hasta, limit: n, top: n })}`);
  },
  // GET /reportes/clientes_frecuencia_compra?desde=...&hasta=...
  clientesFrecuencia: (desde, hasta) =>
    apiFetch(`/clientes_frecuencia_compra${toQS({ desde, hasta })}`),

  // GET /reportes/historial_cliente?cliente_id=...&desde=...&hasta=...
  historialCliente: (cliente_id, desde, hasta) => {
    const cid = String(cliente_id || '').trim();
    if (!cid) throw new Error('cliente_id es requerido');
    return apiFetch(`/historial_cliente${toQS({ cliente_id: cid, desde, hasta })}`);
  },
};
