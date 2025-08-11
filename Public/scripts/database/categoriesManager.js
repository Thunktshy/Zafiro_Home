document.addEventListener('DOMContentLoaded', () => {
  populateCategoryFilter();
});

async function populateCategoryFilter(selectId = 'categoryFilter') {
  const select = document.getElementById(selectId);
  if (!select) return;

  // Placeholder inicial
  select.innerHTML = '<option value="">Selecciona una categoría</option>';

  try {
    const res = await fetch('/categories/get_list', { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
      console.error('HTTP error', res.status, await safeText(res));
      return;
    }

    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload
               : Array.isArray(payload?.data) ? payload.data
               : [];

    // Agrega las opciones
    for (const row of rows) {
      const opt = document.createElement('option');
      opt.value = row.categoria_id;                 // value = id
      opt.textContent = row.nombre_categoria;       // texto visible
      select.appendChild(opt);
    }
  } catch (e) {
    console.error('Error cargando categorías:', e);
  }
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}