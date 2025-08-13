// scripts/apis/categoriesManager.js
// Envíos a la API de categorías (usa cookies de sesión)
// BASE apunta al router montado en el server: app.use('/categorias', CategoriasRouter)
const BASE = '/categorias';

/**
 * Extrae el mensaje de error más útil de distintas formas de respuesta.
 * - Soporta { message }, { error }, { success:false, message }, o texto plano.
 */
function extractErrorMessage(data, res) {
  if (data && typeof data === 'object') {
    return data.message || data.error || `Error ${res.status}`;
  }
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

/**
 * apiFetch: envoltura de fetch con:
 * - credentials: 'include' para enviar cookies de sesión (requerido por rutas protegidas)
 * - Content-Type automático (JSON por defecto)
 * - Parse seguro de JSON o fallback a texto
 * - Lanzar Error con mensaje claro extraído del backend
 *
 * @param {string} path - Ruta relativa al BASE (p. ej. '/get_all')
 * @param {Object} [options]
 * @param {'GET'|'POST'|'PUT'|'DELETE'} [options.method='GET']
 * @param {any} [options.body] - Objeto que se serializa a JSON salvo que bodyType indique lo contrario
 * @param {'json'|'raw'} [options.bodyType='json'] - 'raw' para enviar FormData/etc.
 * @returns {Promise<any>} - Respuesta ya parseada (JSON o texto)
 */
async function apiFetch(path, { method = 'GET', body, bodyType } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json' }
  };

  if (body != null) {
    if (!bodyType || bodyType === 'json') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      // p.ej. multipart/form-data (FormData) o binario
      opts.body = body;
    }
  }

  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = extractErrorMessage(data, res);
    throw new Error(msg);
  }
  return data;
}

export const categoriasAPI = {
  // ------------------------------
  // CONSULTA: obtener todas las categorías (detalle completo)
  // requiere : nada
  // devuelve : Array de objetos { categoria_id, nombre_categoria, descripcion, fecha_creacion, ... }
  // GET /categorias/get_all
  // ------------------------------
  getAll: () => apiFetch('/get_all'),

  // ------------------------------
  // CONSULTA: lista ligera para selects/dropdowns
  // requiere : nada
  // devuelve : Array de objetos { categoria_id, nombre_categoria }
  // GET /categorias/get_list
  // ------------------------------
  getList: () => apiFetch('/get_list'),

  // ------------------------------
  // CONSULTA: una categoría por id
  // requiere : id (number | string convertible a número)
  // devuelve : Objeto de categoría o 404 si no existe
  // GET /categorias/by_id/:id
  // ------------------------------
  getOne: (id) => apiFetch(`/by_id/${encodeURIComponent(id)}`),

  // ------------------------------
  // ALTA (ingresa): crear categoría (requiere sesión ADMIN)
  // requiere : { nombre_categoria: string (<=50, no vacío), descripcion?: string|null (<=255) }
  // ingresa  : Crea registro en DB
  // devuelve : { success: true, message } | lanza Error 409 si ya existe
  // POST /categorias/insert
  // ------------------------------
  insert: ({ nombre_categoria, descripcion }) =>
    apiFetch('/insert', {
      method: 'POST',
      body: { nombre_categoria, descripcion: descripcion || null }
    }),

  // ------------------------------
  // ACTUALIZACIÓN: modificar categoría (requiere sesión ADMIN)
  // requiere : { categoria_id: number, nombre_categoria: string, descripcion?: string|null }
  // devuelve : { success: true, message } | 404 si no existe | 409 si nombre duplicado
  // POST /categorias/update
  // ------------------------------
  update: ({ categoria_id, nombre_categoria, descripcion }) =>
    apiFetch('/update', {
      method: 'POST',
      body: { categoria_id, nombre_categoria, descripcion: descripcion || null }
    }),

  // ------------------------------
  // BAJA (elimina): borrar categoría por id (requiere sesión ADMIN)
  // requiere : categoria_id (number)
  // elimina  : Eliminación lógica/física según backend (aquí es física en SP)
  // devuelve : { success: true, message } | 404 si no existe
  // POST /categorias/delete
  // ------------------------------
  remove: (categoria_id) =>
    apiFetch('/delete', {
      method: 'POST',
      body: { categoria_id }
    })
};

