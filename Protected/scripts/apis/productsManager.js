// Envíos a la API de productos (usa cookies de sesión)
const BASE = '/productos';

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
      // p.ej. multipart/form-data (FormData)
      opts.body = body;
    }
  }

  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.message) || `Error ${res.status}`);
  return data;
}

export const productosAPI = {
  getAll: () => apiFetch('/get_all'),
  getOne: (id) => apiFetch(`/get_one?id=${encodeURIComponent(id)}`),
  insert: ({ nombre_producto, descripcion, precio_unitario, stock, categoria_id, estado_producto }) =>
    apiFetch('/insert', { method: 'POST', body: { nombre_producto, descripcion: descripcion ?? null, precio_unitario, stock, categoria_id, estado_producto } }),
  update: ({ producto_id, nombre_producto, descripcion, precio_unitario, stock, categoria_id, estado_producto }) =>
    apiFetch('/update', { method: 'POST', body: { producto_id, nombre_producto, descripcion: descripcion ?? null, precio_unitario, stock, categoria_id, estado_producto } }),
  remove: (producto_id) => apiFetch('/delete', { method: 'POST', body: { producto_id } })
};