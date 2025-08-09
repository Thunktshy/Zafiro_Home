// /scripts/menu.js
// Builds a role-aware hamburger menu using the icon already inside
// <li class="nav-item" id="user-menu-mount"><i class="fa-solid fa-bars"></i></li>

async function getStatus() {
  try {
    const r = await fetch('/auth/status', { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error('status ' + r.status);
    return await r.json(); // { authenticated, userType, isAdmin, username? }
  } catch {
    return { authenticated: false, userType: 'guest', isAdmin: false, username: null };
  }
}

function createEl(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function buildMenuHTML({ username, isAdmin }) {
  const safeName = (username && String(username).trim()) || 'Invitado';
  return `
    <div class="user-menu">
      <button class="user-menu-button" id="userMenuButton" aria-haspopup="true" aria-expanded="false">
        <!-- icon will be injected here if present in mount -->
        <span class="username" title="${safeName}">${safeName}</span>
      </button>

      <div class="user-menu-dropdown" role="menu" aria-label="Menú de usuario">
        ${
          username
            ? `
        <div class="user-menu-section">
          <span class="user-menu-label">Compras</span>
          <a class="user-menu-item" href="/pages/mis-pedidos.html"><i class="fa-solid fa-box"></i> Mis pedidos</a>
          <a class="user-menu-item" href="/pages/carrito.html"><i class="fa-solid fa-cart-shopping"></i> Ver Carrito</a>
          <a class="user-menu-item" href="/pages/compras-recientes.html"><i class="fa-solid fa-clock-rotate-left"></i> Compras Recientes</a>
        </div>

        <div class="user-menu-section">
          <span class="user-menu-label">Mi cuenta</span>
          <a class="user-menu-item" href="/pages/mi-cuenta.html"><i class="fa-solid fa-id-badge"></i> Mi cuenta</a>
          <a class="user-menu-item" href="/pages/direcciones-envio.html"><i class="fa-solid fa-location-dot"></i> Direcciones de envío</a>
          <a class="user-menu-item" href="/pages/datos-fiscales.html"><i class="fa-solid fa-file-invoice"></i> Datos fiscales</a>
          <a class="user-menu-item" href="/pages/metodos-pago.html"><i class="fa-solid fa-credit-card"></i> Mis métodos de pago</a>
        </div>

        ${isAdmin ? `
        <div class="user-menu-section">
          <span class="user-menu-label">Administración</span>
          <a class="user-menu-item" href="/admin-resources/admin.html"><i class="fa-solid fa-gauge-high"></i> Panel Admin</a>
        </div>` : ''}

        <div class="user-menu-section">
          <a class="user-menu-item" href="/logout"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</a>
        </div>
        `
            : `
        <div class="user-menu-section">
          <a href="#" class="user-menu-item" id="openLogin"><i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión</a>
        </div>
        `
        }
      </div>
    </div>
  `;
}

function wireMenu(root) {
  const btn = root.querySelector('#userMenuButton');
  const menu = root.querySelector('.user-menu');
  const dropdown = root.querySelector('.user-menu-dropdown');

  function open() {
    menu.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.contains('open') ? close() : open();
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Open login modal if present
  const loginLink = root.querySelector('#openLogin');
  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      const modalEl = document.getElementById('loginmodal');
      if (modalEl && window.bootstrap?.Modal) {
        new bootstrap.Modal(modalEl).show();
      } else {
        modalEl?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

(async function mount() {
  const mount = document.getElementById('user-menu-mount');
  if (!mount) return;

  const status = await getStatus();
  const state = {
    username: status.authenticated ? (status.username || 'Usuario') : null,
    isAdmin: !!status.isAdmin
  };

  // Build menu shell
  const wrapper = createEl(buildMenuHTML(state));

  // If an icon exists inside the mount <li>, move it into the button (first child)
  const existingIcon = mount.querySelector('i');
  if (existingIcon) {
    // Ensure icon is the first element inside the button
    const btn = wrapper.querySelector('#userMenuButton');
    btn.prepend(existingIcon);
    // optional: add spacing if needed
    existingIcon.style.marginRight = '8px';
  } else {
    // If no icon present in HTML and you still want one, uncomment next line:
    // wrapper.querySelector('#userMenuButton').insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-bars" style="margin-right:8px;"></i>');
  }

  mount.replaceChildren(wrapper);
  wireMenu(mount);
})();
