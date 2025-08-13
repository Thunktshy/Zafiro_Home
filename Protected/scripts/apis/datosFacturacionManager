// scripts/apis/datosFacturacionManager.js
// Envíos a la API de Datos Fiscales (usa cookies de sesión)
// BASE debe coincidir con el montaje del server: app.use('/datos_facturacion', DatosFacturacionRouter)
const BASE = '/datos_facturacion';

/**
 * Extrae un mensaje de error útil desde { message } | { error } | texto.
 */
function extractErrorMessage(data, res) {
  if (data && typeof data === 'object') {
    return data.message || data.error || `Error ${res.status}`;
  }
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

/**
 * apiFetch:
 * - credentials: 'include' (cookies de sesión)
 * - Content-Type JSON por defecto (o body raw si se indica)
 * - Parse seguro JSON/text
 * - Lanza Error con mensaje claro si !res.ok
 *
 * @param {string} path   Ruta relativa (p.ej. '/select_by_cliente/cl-1')
 * @param {object} [opt]  { method, body, bodyType }
 * @returns {Promise<any>}
 */
async function apiFetch(path, { method = 'GET', body, bodyType } = {}) {
  const opts = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body != null) {
    if (!bodyType || bodyType === 'json') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      // p.ej. FormData / binario
      opts.body = body;
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(extractErrorMessage(data, res));
  return data;
}

export const datosFacturacionAPI = {
  // ---------------------------------------------------------
  // ALTA (ingresa): crear datos fiscales del cliente (CLIENTE)
  // requiere : { cliente_id:string<=20, rfc:string(12-13), razon_social:string<=100, direccion_fiscal?:string<=200|null }
  // ingresa  : Crea registro; si ya existe para el cliente → 409 (según backend)
  // devuelve : { success:true, message }
  // POST /datos_facturacion/insert
  // ---------------------------------------------------------
  insert: ({ cliente_id, rfc, razon_social, direccion_fiscal }) =>
    apiFetch('/insert', {
      method: 'POST',
      body: { cliente_id, rfc, razon_social, direccion_fiscal: direccion_fiscal ?? null }
    }),

  // ---------------------------------------------------------
  // ACTUALIZACIÓN: modificar datos fiscales del cliente (CLIENTE)
  // requiere : { cliente_id, rfc, razon_social, direccion_fiscal?:string|null }
  // devuelve : { success:true, message } | 404 si no existían previos
  // POST /datos_facturacion/update
  // ---------------------------------------------------------
  update: ({ cliente_id, rfc, razon_social, direccion_fiscal }) =>
    apiFetch('/update', {
      method: 'POST',
      body: { cliente_id, rfc, razon_social, direccion_fiscal: direccion_fiscal ?? null }
    }),

  // ---------------------------------------------------------
  // BAJA (elimina): borrar datos fiscales del cliente (CLIENTE)
  // requiere : { cliente_id }
  // elimina  : Borra el registro de datos fiscales de ese cliente
  // devuelve : { success:true, message } | 404 si no existe
  // POST /datos_facturacion/delete
  // ---------------------------------------------------------
  remove: (cliente_id) =>
    apiFetch('/delete', { method: 'POST', body: { cliente_id } }),

  // ---------------------------------------------------------
  // CONSULTA (cliente): obtener datos fiscales por cliente (CLIENTE)
  // requiere : cliente_id (string, con o sin prefijo 'cl-')
  // devuelve : { success:true, message, data:Array<{datos_fiscales...}> } | data:[] si vacío
  // GET /datos_facturacion/select_by_cliente/:cliente_id
  // ---------------------------------------------------------
  getByCliente: (cliente_id) =>
    apiFetch(`/select_by_cliente/${encodeURIComponent(cliente_id)}`),

  // ---------------------------------------------------------
  // CONSULTA (admin): listar todos los datos fiscales (ADMIN)
  // requiere : nada (sesión ADMIN)
  // devuelve : { success:true, message, data:Array }
  // GET /datos_facturacion/select_all
  // ---------------------------------------------------------
  getAll: () => apiFetch('/select_all'),

  // ---------------------------------------------------------
  // CONSULTA (admin): obtener un registro por id (ADMIN)
  // requiere : id (number)
  // devuelve : { success:true, message:'OK', data:{...} } | 404 si no existe
  // GET /datos_facturacion/por_id/:id
  // ---------------------------------------------------------
  getById: (id) =>
    apiFetch(`/por_id/${encodeURIComponent(id)}`)
};
