// Public/scripts/apis/reportesManager.js
const BASE = '/reportes';

function extractErrorMessage(data, res) {
  if (data && typeof data === 'object') return data.message || data.error || `Error ${res.status}`;
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

async function apiFetch(path, { method = 'GET', body, bodyType } = {}) {
  const opts = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body != null) {
    if (!bodyType || bodyType === 'json') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      opts.body = body;
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
    apiFetch(`/ventas_mensual_pivot?desde=${encodeURIComponent(String(desde||''))}&hasta=${encodeURIComponent(String(hasta||''))}`),

  // GET /reportes/top_ventas?desde=...&hasta=...&limit=10
  topVentas: (desde, hasta, limit = 10) =>
    apiFetch(`/top_ventas?desde=${encodeURIComponent(String(desde||''))}&hasta=${encodeURIComponent(String(hasta||''))}&limit=${encodeURIComponent(Number(limit||10))}`),

  // GET /reportes/clientes_frecuencia?desde=...&hasta=...
  clientesFrecuencia: (desde, hasta) =>
    apiFetch(`/clientes_frecuencia?desde=${encodeURIComponent(String(desde||''))}&hasta=${encodeURIComponent(String(hasta||''))}`),

  // GET /reportes/historial_cliente/:cliente_id?desde=...&hasta=...
  historialCliente: (cliente_id, desde, hasta) =>
    apiFetch(`/historial_cliente/${encodeURIComponent(String(cliente_id||''))}?desde=${encodeURIComponent(String(desde||''))}&hasta=${encodeURIComponent(String(hasta||''))}`)
};
