// categorias-service.js

// Exporta: categoriasAPI

const BASE = '/categorias';

function extractErrorMessage(data, res) {
  if (data && typeof data === 'object') {
    return data.message || data.error || `Error ${res.status}`;
  }
  return typeof data === 'string' && data.trim() ? data : `Error ${res.status}`;
}

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
      opts.body = body; // FormData / raw
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(extractErrorMessage(data, res));
  return data;
}

export const categoriasAPI = {
  getAll: () => apiFetch('/get_all'),
  getList: () => apiFetch('/get_list'),
  getOne: (id) => apiFetch(`/by_id/${encodeURIComponent(id)}`),
  insert: ({ nombre_categoria, descripcion }) =>
    apiFetch('/insert', { method: 'POST', body: { nombre_categoria, descripcion: descripcion || null } }),
  update: ({ categoria_id, nombre_categoria, descripcion }) =>
    apiFetch('/update', { method: 'POST', body: { categoria_id, nombre_categoria, descripcion: descripcion || null } }),
  remove: (categoria_id) =>
    apiFetch('/delete', { method: 'POST', body: { categoria_id } })
};

export default categoriasAPI;