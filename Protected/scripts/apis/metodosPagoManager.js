// scripts/apis/metodosPagoManager.js
// Envíos a la API de Métodos de Pago (usa cookies de sesión)
// Debe coincidir con el montaje del server: app.use('/metodos_pago', MetodosPagoRouter)
const BASE = '/metodos_pago';

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

/** Convierte bit-like (true/'1'/1) a 1; falsy a 0. */
const toBit = v => (Number(v) ? 1 : 0);

/** Acepta datos string u objeto y retorna string JSON. */
function normalizeDatos(datos) {
  if (datos == null) return datos; // deja null/undefined tal cual (backend lo validará)
  if (typeof datos === 'string') return datos;
  try { return JSON.stringify(datos); } catch { return String(datos); }
}

export const metodosPagoAPI = {
  // ---------------------------------------------------------
  // CONSULTA (cliente): listar por cliente (CLIENTE)
  // requiere : cliente_id (string, con o sin 'cl-')
  // devuelve : { success:true, data:Array<{...}> } (ordenado: principal primero)
  // GET /metodos_pago/select_by_cliente/:cliente_id
  // ---------------------------------------------------------
  getByCliente: (cliente_id) =>
    apiFetch(`/select_by_cliente/${encodeURIComponent(cliente_id)}`),

  // ---------------------------------------------------------
  // CONSULTA (admin): listar todos (ADMIN)
  // requiere : nada
  // devuelve : { success:true, data:Array }
  // GET /metodos_pago/select_all
  // ---------------------------------------------------------
  getAll: () => apiFetch('/select_all'),

  // ---------------------------------------------------------
  // CONSULTA (admin): obtener por id (ADMIN)
  // requiere : metodo_id (int)
  // devuelve : { success:true, data:{...} } | 404 si no existe
  // GET /metodos_pago/por_id/:metodo_id
  // ---------------------------------------------------------
  getById: (metodo_id) =>
    apiFetch(`/por_id/${encodeURIComponent(metodo_id)}`),

  // ---------------------------------------------------------
  // ALTA (ingresa): crear método de pago (CLIENTE)
  // requiere : {
  //   cliente_id:string<=20, tipo:string<=20,
  //   datos:string|object(JSON), // requerido por el SP
  //   direccion?:string<=200|null, ciudad?:string<=50|null,
  //   codigo_postal?:string<=10|null, pais?:string<=50|null, es_principal?:0|1|boolean
  // }
  // ingresa  : Crea registro; si es_principal=1, apaga otros del cliente
  // devuelve : { success:true, message } | 404 si cliente no existe
  // POST /metodos_pago/insert
  // ---------------------------------------------------------
  insert: ({ cliente_id, tipo, datos, direccion, ciudad, codigo_postal, pais, es_principal }) =>
    apiFetch('/insert', {
      method: 'POST',
      body: {
        cliente_id,
        tipo,
        datos: normalizeDatos(datos),        // <— importante para el SP
        direccion: direccion ?? null,
        ciudad: ciudad ?? null,
        codigo_postal: codigo_postal ?? null,
        pais: pais ?? null,
        es_principal: toBit(es_principal)
      }
    }),

  // ---------------------------------------------------------
  // ALTA derivada: crear desde datos_personales (CLIENTE)
  // requiere : { cliente_id:string, tipo:string<=20, es_principal?:0|1|boolean }
  // ingresa  : Crea registro construyendo JSON en DB con datos_personales
  // devuelve : { success:true, message } | 404 si cliente/sin datos_personales
  // POST /metodos_pago/from_personales
  // ---------------------------------------------------------
  insertFromPersonales: ({ cliente_id, tipo, es_principal }) =>
    apiFetch('/from_personales', {
      method: 'POST',
      body: {
        cliente_id,
        tipo,
        es_principal: toBit(es_principal)
      }
    }),

  // ---------------------------------------------------------
  // ACTUALIZACIÓN: modificar método (CLIENTE)
  // requiere : {
  //   metodo_id:int, tipo:string<=20,
  //   datos:string|object(JSON), // requerido por el SP
  //   direccion?:string<=200|null, ciudad?:string<=50|null,
  //   codigo_postal?:string<=10|null, pais?:string<=50|null, es_principal?:0|1|boolean|null
  // }
  // devuelve : { success:true, message } | 404 si no existe
  // POST /metodos_pago/update
  // ---------------------------------------------------------
  update: ({ metodo_id, tipo, datos, direccion, ciudad, codigo_postal, pais, es_principal }) =>
    apiFetch('/update', {
      method: 'POST',
      body: {
        metodo_id: Number(metodo_id),
        tipo,
        datos: normalizeDatos(datos),        // <— importante para el SP
        direccion: direccion ?? null,
        ciudad: ciudad ?? null,
        codigo_postal: codigo_postal ?? null,
        pais: pais ?? null,
        // null = mantener; número = setear
        es_principal: typeof es_principal === 'undefined' ? null : toBit(es_principal)
      }
    }),

  // ---------------------------------------------------------
  // BAJA (elimina): eliminar por id (CLIENTE)
  // requiere : metodo_id (int)
  // elimina  : Borra el registro
  // devuelve : { success:true, message } | 404 si no existe
  // POST /metodos_pago/delete
  // ---------------------------------------------------------
  remove: (metodo_id) =>
    apiFetch('/delete', {
      method: 'POST',
      body: { metodo_id: Number(metodo_id) }
    })
};
