// /client-resources/scripts/miCuenta.js
// Panel "Mi Cuenta" — usa sessionStorage, valida cliente y arma el panel general.

function getSessionFlag(key) {
  const v = sessionStorage.getItem(key);
  if (v === null || v === undefined) return false;
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  // intenta JSON
  try { return Boolean(JSON.parse(v)); } catch { return Boolean(v); }
}
function getParam(name) {
  const m = new URL(location.href).searchParams.get(name);
  return m ? decodeURIComponent(m) : '';
}

/* ========= Boot session ========= */
(function initSessionFromQuery() {
  const uidQ = getParam('uid');
  if (uidQ) sessionStorage.setItem('uid', uidQ);
})();

const isClient = getSessionFlag('isClient');
const uid      = sessionStorage.getItem('uid') || '';
const username = sessionStorage.getItem('username') || 'Cliente';

if (!isClient || !uid) {
  // sin sesión de cliente -> regreso a home
  location.replace('/index.html');
}

/* ========= UI header ========= */
const navUserLabel = document.getElementById('navUserLabel');
if (navUserLabel) navUserLabel.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${username}`;

/* ========= Welcome line ========= */
const welcomeLine = document.getElementById('welcomeLine');
if (welcomeLine) {
  welcomeLine.textContent = `Hola ${username} — ID: ${uid}`;
}

/* ========= Subnav categorías (opcional, simple) ========= */
async function loadSimpleCategorias() {
  const ul = document.getElementById('subnavCategorias');
  if (!ul) return;
  try {
    const res = await fetch('/categorias/get_list', { headers:{ Accept:'application/json' }});
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    ul.innerHTML = rows.slice(0,8).map(c => `<li><a href="/index.html#categories">${c.nombre_categoria || c.nombre}</a></li>`).join('') || '<li><a href="#">(sin datos)</a></li>';
  } catch {
    ul.innerHTML = '<li><a href="#">(sin datos)</a></li>';
  }
}
loadSimpleCategorias();

/* ========= Panel General ========= */
const grid = document.getElementById('accountGrid');

const CARDS = [
  {
    key: 'carrito',
    title: 'Mi carrito',
    desc: 'Revisa tu carrito y compras recientes',
    href: `/client-resources/pages/micarrito.html?uid=${encodeURIComponent(uid)}`,
    icon: 'fa-basket-shopping'
  },
  {
    key: 'facturacion',
    title: 'Facturación',
    desc: 'Descarga tus facturas o solicita CFDI',
    href: `/client-resources/pages/facturacion.html?uid=${encodeURIComponent(uid)}`,
    icon: 'fa-file-invoice-dollar'
  },
  {
    key: 'datos',
    title: 'Mis datos',
    desc: 'Direcciones, métodos de pago y datos personales',
    href: `/client-resources/pages/datos.html?uid=${encodeURIComponent(uid)}`,
    icon: 'fa-id-card'
  },
  {
    key: 'micuenta',
    title: 'Mi cuenta',
    desc: 'Resumen y configuración de tu cuenta',
    href: `/client-resources/pages/miCuenta.html?uid=${encodeURIComponent(uid)}`,
    icon: 'fa-user-circle'
  }
];

function renderCards() {
  if (!grid) return;
  grid.innerHTML = CARDS.map(c => `
    <div class="category-card" role="link" tabindex="0" aria-label="${c.title}" data-href="${c.href}">
      <div style="width:100%;height:150px;display:flex;align-items:center;justify-content:center;background:#f6f6f6;border-bottom:2px solid #f7f7f7;">
        <i class="fa-solid ${c.icon}" style="font-size:3rem;color:#2d4778;"></i>
      </div>
      <h3>${c.title}</h3>
      <p style="padding:0 1rem 1rem 1rem;color:#555;margin-top:-.6rem;">${c.desc}</p>
    </div>
  `).join('');
  // Accesibilidad / navegación
  grid.querySelectorAll('.category-card').forEach(card => {
    const go = () => location.href = card.dataset.href;
    card.addEventListener('click', go);
    card.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') go(); });
  });
}
renderCards();

/* ========= Newsletter (demo) ========= */
document.getElementById('newsletter-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = e.target.elements.email.value;
  alert(`¡Gracias por suscribirte, ${email}!`);
  e.target.reset();
});
