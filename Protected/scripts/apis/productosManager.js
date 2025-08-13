// scripts/apis/productosManager.js
// Envíos a la API de Productos (usa cookies de sesión)
// BASE debe coincidir con el montaje del server: app.use('/productos', ProductosRouter)
const BASE = '/productos';

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

/** Ayuda opcional: permite pasar '123' o 'prd-123' indistintamente. */
const normId = (id) => String(id ?? '').trim();

/** Coerciones suaves para campos numéricos. */
const toNumberOr = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const productosAPI = {
  // ---------------------------------------------------------
  // LISTA COMPLETA
  // requiere : nada
  // devuelve : Array<{ producto_id, nombre_producto, descripcion, precio_unitario, stock, categoria_id, fecha_creacion, estado_producto }>
  // GET /productos/get_all
  // ---------------------------------------------------------
  getAll: () => apiFetch('/get_all'),

  // ---------------------------------------------------------
  // LISTA LIGERA (para selects)
  // requiere : nada
  // devuelve : Array<{ producto_id, nombre_producto }>
  // GET /productos/get_list
  // ---------------------------------------------------------
  getList: () => apiFetch('/get_list'),

  // ---------------------------------------------------------
  // OBTENER POR ID
  // requiere : id (string o number; acepta 'prd-123' o '123')
  // devuelve : { success:true, data:{...} } | 404 si no existe
  // GET /productos/by_id/:id
  // ---------------------------------------------------------
  getOne: (id) => apiFetch(`/by_id/${encodeURIComponent(normId(id))}`),

  // ---------------------------------------------------------
  // BUSCAR POR NOMBRE (match exacto)
  // requiere : nombre (string <= 50)
  // devuelve : Array de productos
  // GET /productos/by_name?nombre=...
  // ---------------------------------------------------------
  getByName: (nombre) => apiFetch(`/by_name?nombre=${encodeURIComponent(String(nombre ?? '').trim())}`),

  // ---------------------------------------------------------
  // LISTAR POR CATEGORÍA
  // requiere : categoria_id (number)
  // devuelve : Array de productos
  // GET /productos/by_categoria/:categoria_id
  // ---------------------------------------------------------
  getByCategoria: (categoria_id) => apiFetch(`/by_categoria/${encodeURIComponent(toNumberOr(categoria_id, NaN))}`),

  // ---------------------------------------------------------
  // ALTA (ingresa) — ADMIN
  // requiere : {
  //   nombre_producto:string<=50,
  //   descripcion?:string<=150|null,
  //   precio_unitario:number,
  //   stock:number,
  //   categoria_id:number,
  //   estado_producto?:'activo'|'inactivo'    // si no se envía, backend usa 'activo'
  // }
  // ingresa  : Crea registro
  // devuelve : { success:true, message } | 404 si categoría no existe
  // POST /productos/insert
  // ---------------------------------------------------------
  insert: ({ nombre_producto, descripcion, precio_unitario, stock, categoria_id, estado_producto }) =>
    apiFetch('/insert', {
      method: 'POST',
      body: {
        nombre_producto: String(nombre_producto ?? '').trim(),
        descripcion: descripcion ?? null,
        precio_unitario: toNumberOr(precio_unitario, null),
        stock: toNumberOr(stock, null),
        categoria_id: toNumberOr(categoria_id, null),
        estado_producto: String(estado_producto ?? '').trim()
      }
    }),

  // ---------------------------------------------------------
  // ACTUALIZACIÓN — ADMIN
  // requiere : {
  //   producto_id:string<=20 ('prd-123' o '123'),
  //   nombre_producto:string<=50,
  //   descripcion?:string<=150|null,
  //   precio_unitario:number,
  //   stock:number,
  //   categoria_id:number,
  //   estado_producto:'activo'|'inactivo'
  // }
  // devuelve : { success:true, message } | 404 si producto/categoría no existen
  // POST /productos/update
  // ---------------------------------------------------------
  update: ({ producto_id, nombre_producto, descripcion, precio_unitario, stock, categoria_id, estado_producto }) =>
    apiFetch('/update', {
      method: 'POST',
      body: {
        producto_id: normId(producto_id),
        nombre_producto: String(nombre_producto ?? '').trim(),
        descripcion: descripcion ?? null,
        precio_unitario: toNumberOr(precio_unitario, null),
        stock: toNumberOr(stock, null),
        categoria_id: toNumberOr(categoria_id, null),
        estado_producto: String(estado_producto ?? '').trim()
      }
    }),

  // ---------------------------------------------------------
  // BAJA (elimina) — ADMIN (hard delete)
  // requiere : { producto_id:string }
  // elimina  : Borra el registro
  // devuelve : { success:true, message } | 404 si no existe
  // POST /productos/delete
  // ---------------------------------------------------------
  remove: (producto_id) =>
    apiFetch('/delete', { method: 'POST', body: { producto_id: normId(producto_id) } }),

  // ---------------------------------------------------------
  // DESACTIVAR (soft delete) — ADMIN
  // requiere : { id:string }  // 'prd-123' o '123'
  // devuelve : { success:true, message } | 404 si no existe
  // POST /productos/soft_delete
  // ---------------------------------------------------------
  softDelete: (id) =>
    apiFetch('/soft_delete', { method: 'POST', body: { id: normId(id) } }),

  // ---------------------------------------------------------
  // REACTIVAR — ADMIN
  // requiere : { id:string }
  // devuelve : { success:true, message } | 404 si no existe
  // POST /productos/restore
  // ---------------------------------------------------------
  restore: (id) =>
    apiFetch('/restore', { method: 'POST', body: { id: normId(id) } })
};
