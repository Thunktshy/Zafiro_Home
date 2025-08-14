// scripts/apis/datosPersonalesManager.js
// Envíos a la API de Datos Personales (usa cookies de sesión)
// Debe coincidir con el montaje del server: app.use('/datos_personales', DatosPersonalesRouter)
const BASE = '/datos_personales';

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

export const datosPersonalesAPI = {
  // ---------------------------------------------------------
  // ALTA (ingresa): crear datos personales (CLIENTE)
  // requiere : {
  //   cliente_id:string<=20, nombre:string<=50, apellidos:string<=100,
  //   telefono?:string<=20|null, direccion?:string<=200|null,
  //   ciudad?:string<=50|null, codigo_postal?:string<=10|null, pais?:string<=50|null
  // }
  // ingresa  : Crea registro; si ya existe para el cliente → 409 (según backend)
  // devuelve : { success:true, message }
  // POST /datos_personales/insert
  // ---------------------------------------------------------
  insert: ({ cliente_id, nombre, apellidos, telefono, direccion, ciudad, codigo_postal, pais }) =>
    apiFetch('/insert', {
      method: 'POST',
      body: {
        cliente_id, nombre, apellidos,
        telefono: telefono ?? null,
        direccion: direccion ?? null,
        ciudad: ciudad ?? null,
        codigo_postal: codigo_postal ?? null,
        pais: pais ?? null
      }
    }),

  // ---------------------------------------------------------
  // ACTUALIZACIÓN: modificar datos personales (CLIENTE)
  // requiere : mismos campos que insert
  // devuelve : { success:true, message } | 404 si no existían previos
  // POST /datos_personales/update
  // ---------------------------------------------------------
  update: ({ cliente_id, nombre, apellidos, telefono, direccion, ciudad, codigo_postal, pais }) =>
    apiFetch('/update', {
      method: 'POST',
      body: {
        cliente_id, nombre, apellidos,
        telefono: telefono ?? null,
        direccion: direccion ?? null,
        ciudad: ciudad ?? null,
        codigo_postal: codigo_postal ?? null,
        pais: pais ?? null
      }
    }),

  // ---------------------------------------------------------
  // BAJA (elimina): borrar datos personales del cliente (CLIENTE)
  // requiere : { cliente_id }
  // elimina  : Borra el registro de datos personales de ese cliente
  // devuelve : { success:true, message } | 404 si no existe
  // POST /datos_personales/delete
  // ---------------------------------------------------------
  remove: (cliente_id) =>
    apiFetch('/delete', { method: 'POST', body: { cliente_id } }),

  // ---------------------------------------------------------
  // CONSULTA (cliente): obtener datos personales por cliente (CLIENTE)
  // requiere : cliente_id (string, con o sin prefijo 'cl-')
  // devuelve : { success:true, message, data:Array<{...}> } | data:[] si vacío
  // GET /datos_personales/select_by_cliente/:cliente_id
  // ---------------------------------------------------------
  getByCliente: (cliente_id) =>
    apiFetch(`/select_by_cliente/${encodeURIComponent(cliente_id)}`),

  // ---------------------------------------------------------
  // CONSULTA (admin): obtener un registro por PK (ADMIN)
  // requiere : datos_id (number)
  // devuelve : { success:true, message:'Registro obtenido', data:{...} } | 404 si no existe
  // GET /datos_personales/por_id/:datos_id
  // ---------------------------------------------------------
  getById: (datos_id) =>
    apiFetch(`/por_id/${encodeURIComponent(datos_id)}`),

  // ---------------------------------------------------------
  // CONSULTA (admin): listar todos (ADMIN)
  // requiere : nada
  // devuelve : { success:true, message, data:Array }
  // GET /datos_personales/select_all
  // ---------------------------------------------------------
  getAll: () => apiFetch('/select_all')
};
