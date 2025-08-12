// Envíos a la API de clientes (sesión admin requerida por /admin-resources)
const BASE = '/clientes';

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
  const res  = await fetch(`${BASE}${path}`, opts);
  const ct   = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.message) || `Error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }
  return data;
}

export const clientesAPI = {
  // GET /clientes/search?term=...&solo_activos=1
  search: (term, soloActivos = 1) => apiFetch(`/search?term=${encodeURIComponent(term)}&solo_activos=${soloActivos}`),

  // GET /clientes/por_id/:id   (acepta cl-123 o 123)
  getById: (id) => apiFetch(`/por_id/${encodeURIComponent(id)}`),

  // POST /clientes/insert  { cuenta, contrasena, email }
  insert: (payload) => apiFetch('/insert', { method: 'POST', body: payload }),

  // POST /clientes/update  { cliente_id, cuenta, email }
  // Nota: en tu router actual esta ruta exige requireClient
  update: (payload) => apiFetch('/update', { method: 'POST', body: payload }),

  // POST /clientes/soft_delete { cliente_id }
  softDelete: (cliente_id) => apiFetch('/soft_delete', { method: 'POST', body: { cliente_id } }),

  // POST /clientes/reactivar { cliente_id }
  reactivate: (cliente_id) => apiFetch('/reactivar', { method: 'POST', body: { cliente_id } }),

  // POST /clientes/delete { cliente_id }
  remove: (cliente_id) => apiFetch('/delete', { method: 'POST', body: { cliente_id } }),
};
