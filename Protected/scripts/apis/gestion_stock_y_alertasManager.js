// Public/scripts/apis/gestion_stock_y_alertasManager.js
// Módulo de cliente para gestión de stock, alertas y precios masivos
const BASE = '/gestion_stock_y_alertas';

/** Extrae mensaje de error útil */
function extractErrorMessage(data, res) {
  if (data && typeof data === 'object') return data.message || data.error || `Error ${res.status}`;
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

/** Fetch standard (cookies de sesión, JSON por defecto) */
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

/** Normalizadores / coerciones */
const normId = (id) => String(id ?? '').trim();
const toNumberOr = (v, fb = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const toBit = (v) => (Number(v) ? 1 : 0);

export const gestionStockAlertasAPI = {
  /* ----------------------- STOCK ----------------------- */
  // requiere : { producto_id, cantidad>0 }
  // POST /gestion_stock_y_alertas/stock/agregar
  stockAgregar: ({ producto_id, cantidad }) =>
    apiFetch('/stock/agregar', { method: 'POST', body: { producto_id: normId(producto_id), cantidad: toNumberOr(cantidad, null) } }),

  // requiere : { producto_id, cantidad>0 }
  // POST /gestion_stock_y_alertas/stock/reducir
  stockReducir: ({ producto_id, cantidad }) =>
    apiFetch('/stock/reducir', { method: 'POST', body: { producto_id: normId(producto_id), cantidad: toNumberOr(cantidad, null) } }),

  /* ----------------------- ALERTAS (opcional) ----------------------- */
  // requiere : { umbral_global?:int, solo_activos?:0|1 }
  // POST /gestion_stock_y_alertas/alertas/generar
  alertasGenerar: ({ umbral_global = 5, solo_activos = 1 } = {}) =>
    apiFetch('/alertas/generar', { method: 'POST', body: { umbral_global: toNumberOr(umbral_global, 5), solo_activos: toBit(solo_activos) } }),

  /* ----------------------- LOGS ----------------------- */
  // GET /gestion_stock_y_alertas/logs/all
  logsGetAll: () => apiFetch('/logs/all'),

  // GET /gestion_stock_y_alertas/logs/by_producto/:producto_id
  logsGetByProducto: (producto_id) => apiFetch(`/logs/by_producto/${encodeURIComponent(normId(producto_id))}`),

  // GET /gestion_stock_y_alertas/logs/by_categoria/:categoria_id
  logsGetByCategoria: (categoria_id) => apiFetch(`/logs/by_categoria/${encodeURIComponent(toNumberOr(categoria_id, NaN))}`),

  // GET /gestion_stock_y_alertas/logs/by_rango?desde=...&hasta=...
  logsGetByRango: (desde, hasta) => apiFetch(`/logs/by_rango?desde=${encodeURIComponent(String(desde||''))}&hasta=${encodeURIComponent(String(hasta||''))}`),

  // GET /gestion_stock_y_alertas/logs/by_producto_rango/:producto_id?desde=...&hasta=...
  logsGetByProductoRango: (producto_id, desde, hasta) =>
    apiFetch(`/logs/by_producto_rango/${encodeURIComponent(normId(producto_id))}?desde=${encodeURIComponent(String(desde||''))}&hasta=${encodeURIComponent(String(hasta||''))}`),

  // GET /gestion_stock_y_alertas/logs/by_categoria_rango?categoria_id=...&desde=...&hasta=...
  logsGetByCategoriaRango: (categoria_id, desde, hasta) =>
    apiFetch(`/logs/by_categoria_rango?categoria_id=${encodeURIComponent(toNumberOr(categoria_id, NaN))}&desde=${encodeURIComponent(String(desde||''))}&hasta=${encodeURIComponent(String(hasta||''))}`),

  /* ----------------------- PRECIOS MASIVOS ----------------------- */
  // requiere : { monto>0, categoria_id?:int|null, solo_activos?:0|1 }
  // POST /gestion_stock_y_alertas/precios/incrementar
  preciosIncrementar: ({ monto, categoria_id = null, solo_activos = 1 }) =>
    apiFetch('/precios/incrementar', { method: 'POST', body: {
      monto: toNumberOr(monto, null), categoria_id: categoria_id==null ? null : toNumberOr(categoria_id, null), solo_activos: toBit(solo_activos)
    }}),

  // requiere : { monto>0, categoria_id?:int|null, solo_activos?:0|1 }
  // POST /gestion_stock_y_alertas/precios/reducir
  preciosReducir: ({ monto, categoria_id = null, solo_activos = 1 }) =>
    apiFetch('/precios/reducir', { method: 'POST', body: {
      monto: toNumberOr(monto, null), categoria_id: categoria_id==null ? null : toNumberOr(categoria_id, null), solo_activos: toBit(solo_activos)
    }}),

  // requiere : { porcentaje:0-100, categoria_id?:int|null, solo_activos?:0|1 }
  // POST /gestion_stock_y_alertas/precios/descuento
  preciosAgregarDescuento: ({ porcentaje, categoria_id = null, solo_activos = 1 }) =>
    apiFetch('/precios/descuento', { method: 'POST', body: {
      porcentaje: toNumberOr(porcentaje, null), categoria_id: categoria_id==null ? null : toNumberOr(categoria_id, null), solo_activos: toBit(solo_activos)
    }})
};
