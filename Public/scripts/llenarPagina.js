  // Helpers
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"'`=\/]/g, s =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s])
    );
  }
  async function fetchJson(url) {
    const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' }});
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    // A veces el backend manda HTML cuando algo falla; tratamos de parsear seguro
    const raw = await res.text();
    let data; try { data = JSON.parse(raw); } catch { throw new Error('Respuesta no JSON'); }
    // Normaliza posible forma { success, data } o array directo
    return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  }

  // ===== CATEGORÍAS =====
  async function loadCategories() {
    const endpoints = ['/categorias/get_list', '/categories/get_list'];
    let rows = [];
    for (const url of endpoints) {
      try { rows = await fetchJson(url); break; } catch {}
    }
    if (!Array.isArray(rows)) rows = [];

    // Submenú "Categorías"
    const catDropdown = document.querySelector('.subnav-menu > li:first-child .dropdown-menu');
    if (catDropdown) {
      catDropdown.innerHTML = rows.map(r =>
        `<li><a href="#">${escapeHtml(r.nombre_categoria ?? r.nombre ?? '')}</a></li>`
      ).join('') || '<li><a href="#">(Sin categorías)</a></li>';
    }

    // Grilla "Explora por Categoría"
    const catGrid = document.getElementById('categories-list');
    if (catGrid) {
      catGrid.innerHTML = rows.slice(0, 8).map(r => `
        <div class="category-card">
          <!-- // todo: imagen de categoría -->
          <h3>${escapeHtml(r.nombre_categoria ?? r.nombre ?? '')}</h3>
        </div>
      `).join('') || `
        <div class="category-card">
          <!-- // todo: imagen de categoría -->
          <h3>(Sin categorías)</h3>
        </div>`;
    }

    // Filtro por categoría
    const catFilter = document.getElementById('categoryFilter');
    if (catFilter) {
      catFilter.innerHTML = `
        <option value="">Selecciona una categoría</option>
        ${rows.map(r => `<option value="${escapeHtml(String(r.categoria_id ?? ''))}">
            ${escapeHtml(r.nombre_categoria ?? r.nombre ?? '')}
          </option>`).join('')}
      `;
    }
  }

  // ===== OFERTAS =====
  async function loadOffers() {
    // Ideal: endpoint público de ofertas. Fallback: get_all (solo si hay sesión admin).
    const endpoints = ['/productos/ofertas_public', '/productos/get_all'];
    let rows = null, used = '';
    for (const url of endpoints) {
      try { rows = await fetchJson(url); used = url; break; } catch {}
    }
    if (!Array.isArray(rows)) rows = [];

    // Mapear a { nombre, descripcion, precio } y limitar a 8
    const offers = rows.slice(0, 8).map(p => ({
      nombre: p.nombre_producto ?? p.nombre ?? '',
      descripcion: p.descripcion ?? '',
      precio: Number(p.precio_unitario ?? p.precio ?? 0) || 0
    }));

    const grid = document.querySelector('.ofertas-grid');
    if (grid) {
      grid.innerHTML = offers.map(o => `
        <div class="offer-card">
          <!-- // todo: imagen del producto -->
          <div class="offer-details">
            <h3 class="offer-title">${escapeHtml(o.nombre)}</h3>
            <p>${escapeHtml(o.descripcion)}</p>
            <p class="offer-price">$${o.precio.toFixed(2)}</p>
            <button class="btn-buy">Comprar ahora</button>
            <button class="btn-ad-to-cart">Agregar al carrito</button>
          </div>
        </div>
      `).join('') || `
        <div class="offer-card">
          <div class="offer-details">
            <h3 class="offer-title">(Sin ofertas públicas)</h3>
            <p>Cuando exista el endpoint de ofertas públicas, se mostrarán aquí.</p>
            <p class="offer-price">$0.00</p>
          </div>
        </div>
      `;

      // Si estamos usando el fallback admin, muestra una notita en consola (no visible al usuario)
      if (used === '/productos/get_all') {
        console.info('[Aviso] Usando /productos/get_all (requiere admin). Recomiendo exponer /productos/ofertas_public.');
      }
    }
  }

  // Init
  (async () => {
    await Promise.all([loadCategories(), loadOffers()]);
  })();