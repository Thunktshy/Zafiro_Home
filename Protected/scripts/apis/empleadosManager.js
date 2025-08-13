// scripts/apis/empleadosManager.js
// Envíos a la API de empleados (usa cookies de sesión)
// Debe coincidir con el montaje del server: app.use('/empleados', EmpleadosRouter)
const BASE = '/empleados';

/** Extrae un mensaje de error útil desde { message } | { error } | texto. */
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
 * @param {string} path   Ruta relativa (p.ej. '/por_id/1')
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

/** Convierte a entero seguro (o lanza). Útil porque el router espera Number() en backend. */
function toIntOrThrow(v, label = 'id') {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${label} inválido`);
  return n;
}

export const empleadosAPI = {
  // ---------------------------------------------------------
  // ALTA (ingresa): crear empleado (ADMIN)
  // requiere : { cuenta:string<=20, contrasena:string<=255, email:string<=150 }
  // ingresa  : Crea registro (puesto default = 'Administrador' en DB)
  // devuelve : { success:true, message } | 409 si cuenta/email ya usados
  // POST /empleados/insert
  // ---------------------------------------------------------
  insert: ({ cuenta, contrasena, email }) =>
    apiFetch('/insert', { method: 'POST', body: { cuenta, contrasena, email } }),

  // ---------------------------------------------------------
  // ACTUALIZACIÓN: modificar empleado (ADMIN)
  // requiere : { empleado_id:int, cuenta:string, email:string, puesto:string<=30 }
  // devuelve : { success:true, message } | 404 si id no existe | 409 si cuenta/email duplicados
  // POST /empleados/update
  // ---------------------------------------------------------
  update: ({ empleado_id, cuenta, email, puesto }) =>
    apiFetch('/update', {
      method: 'POST',
      body: { empleado_id: toIntOrThrow(empleado_id, 'empleado_id'), cuenta, email, puesto }
    }),

  // ---------------------------------------------------------
  // BAJA (elimina): físico (ADMIN)
  // requiere : { empleado_id:int }
  // elimina  : Borra registro
  // devuelve : { success:true, message } | 404 si no existe
  // POST /empleados/delete
  // ---------------------------------------------------------
  remove: (empleado_id) =>
    apiFetch('/delete', {
      method: 'POST',
      body: { empleado_id: toIntOrThrow(empleado_id, 'empleado_id') }
    }),

  // ---------------------------------------------------------
  // DESACTIVAR (soft delete): estado = 0 (ADMIN)
  // requiere : { empleado_id:int }
  // devuelve : { success:true, message } | 404 si no existe | 409 si ya está desactivado
  // POST /empleados/soft_delete
  // ---------------------------------------------------------
  softDelete: (empleado_id) =>
    apiFetch('/soft_delete', {
      method: 'POST',
      body: { empleado_id: toIntOrThrow(empleado_id, 'empleado_id') }
    }),

  // ---------------------------------------------------------
  // REACTIVAR: estado = 1 (ADMIN)
  // requiere : { empleado_id:int }
  // devuelve : { success:true, message } | 404 si no existe | 409 si ya activo
  // POST /empleados/reactivar
  // ---------------------------------------------------------
  reactivate: (empleado_id) =>
    apiFetch('/reactivar', {
      method: 'POST',
      body: { empleado_id: toIntOrThrow(empleado_id, 'empleado_id') }
    }),

  // ---------------------------------------------------------
  // REGISTRAR LOGIN (marca último acceso) (ADMIN)
  // requiere : { empleado_id:int }
  // devuelve : { success:true, message }
  // POST /empleados/registrar_login
  // ---------------------------------------------------------
  registrarLogin: (empleado_id) =>
    apiFetch('/registrar_login', {
      method: 'POST',
      body: { empleado_id: toIntOrThrow(empleado_id, 'empleado_id') }
    }),

  // ---------------------------------------------------------
  // CONSULTA: por id (ADMIN)
  // requiere : empleado_id:int
  // devuelve : { success:true, message, data:{...} } | 404 si no existe
  // GET /empleados/por_id/:empleado_id
  // ---------------------------------------------------------
  getOne: (empleado_id) =>
    apiFetch(`/por_id/${encodeURIComponent(toIntOrThrow(empleado_id, 'empleado_id'))}`),

  // ---------------------------------------------------------
  // BUSCAR: por cuenta/email (ADMIN)
  // requiere : term:string, solo_activos: 0|1 (default 1)
  // devuelve : { success:true, message, data:Array<{empleado_id}> }
  // GET /empleados/search?term=abc&solo_activos=1
  // ---------------------------------------------------------
  search: ({ term, solo_activos = 1 }) =>
    apiFetch(`/search?term=${encodeURIComponent(term ?? '')}&solo_activos=${solo_activos ? 1 : 0}`),

  // ---------------------------------------------------------
  // LISTAR TODOS (ADMIN)
  // requiere : nada
  // devuelve : { success:true, message, data:Array }
  // GET /empleados/select_all
  // ---------------------------------------------------------
  getAll: () => apiFetch('/select_all')
};
