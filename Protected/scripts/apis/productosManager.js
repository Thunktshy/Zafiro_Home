// Envíos a la API de productos (usa cookies de sesión)
const BASE = '/productos';

async function apiFetch(path, { method = 'GET', body, bodyType } = {}) {
  const opts = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body != null) {
    if (!bodyType || bodyType === 'json') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else {
      opts.body = body; // FormData, etc.
    }
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const ct  = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.message) || `Error ${res.status}`);
  return data;
}

export const productosAPI = {
  getAll:  () => apiFetch('/get_all'),
  getList: () => apiFetch('/get_list'),
  getOne:  (id) => apiFetch(`/by_id/${encodeURIComponent(id)}`),
  insert:  (payload) => apiFetch('/insert', { method: 'POST', body: payload }),
  update:  (payload) => apiFetch('/update', { method: 'POST', body: payload }),
  remove:  (producto_id) => apiFetch('/delete', { method: 'POST', body: { producto_id } }),
};

export const categoriasAPI = {
  getList: () =>
    fetch('/categories/get_list', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(r => r.json())
};
