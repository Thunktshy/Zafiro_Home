// Envíos a la API de empleados (sesión admin requerida por /admin-resources)
const BASE = '/empleados';

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

export const empleadosAPI = {
  // GET /empleados/search?term=...&solo_activos=1
  search: (term, soloActivos = 1) =>
    apiFetch(`/search?term=${encodeURIComponent(term)}&solo_activos=${soloActivos}`),

  // GET /empleados/por_id/:id
  getById: (id) => apiFetch(`/por_id/${encodeURIComponent(id)}`),

  // POST /empleados/insert  { cuenta, contrasena, email, puesto }
  insert: (payload) => apiFetch('/insert', { method: 'POST', body: payload }),

  // POST /empleados/update  { empleado_id, cuenta, email, puesto }
  update: (payload) => apiFetch('/update', { method: 'POST', body: payload }),

  // POST /empleados/soft_delete { empleado_id }
  softDelete: (empleado_id) => apiFetch('/soft_delete', { method: 'POST', body: { empleado_id } }),

  // POST /empleados/reactivar { empleado_id }
  reactivate: (empleado_id) => apiFetch('/reactivar', { method: 'POST', body: { empleado_id } }),

  // POST /empleados/delete { empleado_id }
  remove: (empleado_id) => apiFetch('/delete', { method: 'POST', body: { empleado_id } }),
};
