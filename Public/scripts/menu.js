// scripts/menu.js
(() => {
  const menuBtn = document.getElementById('menu');       // bars icon <li id="menu">
  const drawer  = document.getElementById('hm-drawer');
  const overlay = document.getElementById('hm-overlay');
  const closeBtn = drawer?.querySelector('.hm-close');

  if (!menuBtn || !drawer || !overlay || !closeBtn) return;

  // Make the bars icon act like a button (a11y)
  menuBtn.setAttribute('role', 'button');
  menuBtn.setAttribute('tabindex', '0');
  menuBtn.setAttribute('aria-label', 'Abrir menú');

  let lastFocused = null;

  const focusableSelector = [
    'a[href]','button:not([disabled])','input:not([disabled])',
    '[tabindex]:not([tabindex="-1"])','select:not([disabled])','textarea:not([disabled])'
  ].join(',');

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const nodes = drawer.querySelectorAll(focusableSelector);
    if (!nodes.length) return;

    const first = nodes[0];
    const last  = nodes[nodes.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function openDrawer() {
    lastFocused = document.activeElement;
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    overlay.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('hm-locked');

    // Focus first interactive element inside drawer
    const firstFocusable = drawer.querySelector(focusableSelector) || closeBtn;
    firstFocusable.focus();

    document.addEventListener('keydown', onKeyDown);
    drawer.addEventListener('keydown', trapFocus);
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('hm-locked');

    // Hide overlay for screen readers after animation
    setTimeout(() => { overlay.hidden = true; }, 200);

    document.removeEventListener('keydown', onKeyDown);
    drawer.removeEventListener('keydown', trapFocus);

    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closeDrawer();
  }

  // Toggle handlers
  menuBtn.addEventListener('click', openDrawer);
  menuBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(); }
  });
  overlay.addEventListener('click', closeDrawer);
  closeBtn.addEventListener('click', closeDrawer);

  // Submenu toggles
  drawer.querySelectorAll('.hm-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = btn.nextElementSibling;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      if (sub) sub.hidden = expanded;
    });
  });

  // ---- Username placeholder population (optional) ----
  // Replace this logic with your real session/user source if you have one.
  try {
    const name =
      window.currentUser?.nombre ||
      sessionStorage.getItem('username') ||
      localStorage.getItem('username') ||
      'username';  // <- placeholder asked in the template

    const u = document.getElementById('hm-username');
    if (u && name) u.textContent = name;
  } catch { /* ignore */ }
})();
