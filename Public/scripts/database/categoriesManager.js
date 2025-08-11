(() => {
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"'`=\/]/g, s =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s])
    );
  }

  async function fetchCategories() {
    try {
      const res = await fetch('/categories/get_list', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        console.error('HTTP error', res.status, await res.text());
        return [];
      }

      const raw = await res.text();
      let payload;
      try { payload = JSON.parse(raw); }
      catch {
        console.warn('Respuesta no-JSON (primeros 200 chars):', raw.slice(0, 200));
        return [];
      }

      if (payload?.success === false) {
        console.warn('API respondió con error:', payload?.message);
      }

      const rows = Array.isArray(payload?.data) ? payload.data
                 : Array.isArray(payload)       ? payload
                 : [];

      // Ordenar alfabéticamente (opcional)
      rows.sort((a, b) =>
        String(a?.nombre_categoria ?? '').localeCompare(String(b?.nombre_categoria ?? ''), 'es', { sensitivity: 'base' })
      );

      return rows.map(r => ({
        categoria_id: r.categoria_id,
        nombre_categoria: r.nombre_categoria ?? '(Sin nombre)'
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
      opt.value = String(row.categoria_id);
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
    console.debug('Categorías normalizadas:', rows); // útil para verificar
    renderSelect(rows, 'categoryFilter');
    renderDropdown(rows, '.subnavbar .dropdown-menu');
  });
})();
