// /admin-resources/scripts/apis/imagenesManager.js
const BASE = '/imagenes';

async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE + path, { credentials: 'include', ...opts });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok || data?.success === false) {
    const msg = (data && (data.message || data.error)) || `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const imagenesAPI = {
  uploadProducto: (producto_id, file) => {
    const fd = new FormData();
    fd.append('producto_id', String(producto_id));
    fd.append('file', file);
    return apiFetch('/productos/upload', { method: 'POST', body: fd });
  },
  uploadCategoria: (categoria_id, file) => {
    const fd = new FormData();
    fd.append('categoria_id', Number(categoria_id));
    fd.append('file', file);
    return apiFetch('/categorias/upload', { method: 'POST', body: fd });
  },
  getByProducto: (pid) => apiFetch(`/productos/${encodeURIComponent(String(pid))}`),
  getByCategoria: (cid) => apiFetch(`/categorias/${encodeURIComponent(Number(cid))}`),
  deleteProducto: (id) => apiFetch(`/productos/${Number(id)}`, { method: 'DELETE' }),
  deleteCategoria: (id) => apiFetch(`/categorias/${Number(id)}`, { method: 'DELETE' })
};
