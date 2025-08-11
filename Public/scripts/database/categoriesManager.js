(() => {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"'`=\/]/g, s =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s])
    );
  }

  async function safeText(res) {
    try { return await res.text(); } catch { return ''; }
  }

  async function fetchCategories() {
    try {
      const res = await fetch('/categories/get_list', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      console.log(res);
      if (!res.ok) {
        console.error('HTTP error', res.status, await safeText(res));
        return [];
      }
      
      const payload = await res.Array.isArray(res?.data) ? res.data : [];
      // Soporta { success, data: [...] } o un array directo
      const rows = Array.isArray(payload?.data) ? payload.data
                 : Array.isArray(payload)       ? payload
                 : [];
      // Normaliza campos que necesitamos
      return rows.map(r => ({
        categoria_id: r.categoria_id,
        nombre_categoria: r.nombre_categoria
      }));
    } catch (e) {
      console.error('Error cargando categorías:', e);
      return [];
    }
  }

  function renderSelect(rows, selectId = 'categoryFilter') {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">Selecciona una categoría</option>';
    for (const row of rows) {
      const opt = document.createElement('option');
      opt.value = row.categoria_id;
      opt.textContent = row.nombre_categoria;
      select.appendChild(opt);
    }
  }

  function renderDropdown(rows, ulSelector = '.subnavbar .dropdown-menu') {
    const ul = document.querySelector(ulSelector);
    if (!ul) return;

    if (!rows.length) {
      ul.innerHTML = `<li><a href="#">Sin categorías</a></li>`;
      return;
    }

    ul.innerHTML = rows.map(r => `
      <li>
        <a href="/buscar?categoria=${encodeURIComponent(r.categoria_id)}">
          ${escapeHtml(r.nombre_categoria)}
        </a>
      </li>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const rows = await fetchCategories();
    renderSelect(rows, 'categoryFilter');               // llena el <select>
    renderDropdown(rows, '.subnavbar .dropdown-menu');  // llena el dropdown
  });
})();