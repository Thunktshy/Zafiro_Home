// scripts/apis/clientesManager.js
// Envíos a la API de clientes (usa cookies de sesión)
// BASE coincide con server: app.use('/clientes', ClientesRoutes)
const BASE = '/clientes';

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
 * apiFetch: envoltura fetch con:
 * - credentials: 'include' (cookies de sesión)
 * - Content-Type JSON por defecto (o body raw si se indica)
 * - Parse seguro JSON/text
 * - Lanza Error con mensaje claro si !res.ok
 *
 * @param {string} path   Ruta relativa (p.ej. '/por_id/:id')
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

export const clientsAPI = {
  // ------------------------------
  // ALTA (ingresa): crear cliente (no requiere sesión)
  // requiere : { cuenta:string<=20, contrasena:string<=255, email:string<=150 }
  // ingresa  : Crea el cliente en DB
  // devuelve : { success:true, message, data:{ cliente_id } } | Error 409 si duplicado (según backend)
  // POST /clientes/insert
  // ------------------------------
  insert: ({ cuenta, contrasena, email }) =>
    apiFetch('/insert', { method: 'POST', body: { cuenta, contrasena, email } }),

  // ------------------------------
  // ACTUALIZAR: modificar datos básicos (requiere sesión CLIENTE)
  // requiere : { cliente_id:string<=20, cuenta:string<=20, email:string<=150 }
  // devuelve : { success:true, message } | 404 si no existe | 409 si cuenta/email en uso
  // POST /clientes/update
  // ------------------------------
  update: ({ cliente_id, cuenta, email }) =>
    apiFetch('/update', { method: 'POST', body: { cliente_id, cuenta, email } }),

  // ------------------------------
  // BAJA (elimina): eliminación física (requiere ADMIN)
  // requiere : { cliente_id:string<=20 }
  // elimina  : Borrado definitivo
  // devuelve : { success:true, message } | 404 si no existe
  // POST /clientes/delete
  // ------------------------------
  remove: (cliente_id) =>
    apiFetch('/delete', { method: 'POST', body: { cliente_id } }),

  // ------------------------------
  // DESACTIVAR (soft delete): estado = 0 (requiere ADMIN)
  // requiere : { cliente_id:string<=20 }
  // devuelve : { success:true, message, data:{ cliente_id, estado:0 } } | 404/409 según estado actual
  // POST /clientes/soft_delete
  // ------------------------------
  softDelete: (cliente_id) =>
    apiFetch('/soft_delete', { method: 'POST', body: { cliente_id } }),

  // ------------------------------
  // REACTIVAR: estado = 1 (requiere ADMIN)
  // requiere : { cliente_id:string<=20 }
  // devuelve : { success:true, message, data:{ cliente_id, estado:1 } } | 404/409 según estado actual
  // POST /clientes/reactivar
  // ------------------------------
  reactivate: (cliente_id) =>
    apiFetch('/reactivar', { method: 'POST', body: { cliente_id } }),

  // ------------------------------
  // CONSULTA: obtener cliente por id (acepta 'cl-123' o '123')
  // requiere : id (string|number)
  // devuelve : { success:true, message, data:{...} } | 404 si no existe
  // GET /clientes/por_id/:id
  // ------------------------------
  getOne: (id) =>
    apiFetch(`/por_id/${encodeURIComponent(id)}`),

  // ------------------------------
  // BUSCAR: por cuenta/email (requiere ADMIN)
  // requiere : term (string), solo_activos: 0|1
  // devuelve : { success:true, message, data:Array<{cliente_id}> }
  // GET /clientes/search?term=abc&solo_activos=1
  // ------------------------------
  search: ({ term, solo_activos = 1 }) =>
    apiFetch(`/search?term=${encodeURIComponent(term ?? '')}&solo_activos=${solo_activos}`),

  // ------------------------------
  // REGISTRAR LOGIN: setea último acceso (no cambia sesión del front)
  // requiere : { cliente_id:string<=20 }
  // devuelve : { success:true, message }
  // POST /clientes/registrar_login
  // ------------------------------
  registrarLogin: (cliente_id) =>
    apiFetch('/registrar_login', { method: 'POST', body: { cliente_id } })
};
