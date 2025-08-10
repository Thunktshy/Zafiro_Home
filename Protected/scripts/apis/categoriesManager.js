// Envíos a la API de categorías (usa cookies de sesión)
const BASE = '/categories';

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

export const categoriasAPI = {
  getAll: () => apiFetch('/get_all'),
  getOne: (id) => apiFetch(`/get_one?id=${encodeURIComponent(id)}`),
  insert: ({ nombre_categoria, descripcion }) =>
    apiFetch('/insert', { method: 'POST', body: { nombre_categoria, descripcion: descripcion || null } }),
  update: ({ categoria_id, nombre_categoria, descripcion }) =>
    apiFetch('/update', { method: 'POST', body: { categoria_id, nombre_categoria, descripcion: descripcion || null } }),
  remove: (categoria_id) =>
    apiFetch('/delete', { method: 'POST', body: { categoria_id } })
};

