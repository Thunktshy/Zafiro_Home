// routes/auth.routes.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt     = require('bcrypt');

// adjust the path to where your db.js lives
const { db, sql } = require('../../db/dbconnector.js');

const router = express.Router();
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'connect.sid';

// Helper: ensure session is saved before responding
function saveSession(req) {
  return new Promise((resolve, reject) =>
    req.session.save(err => (err ? reject(err) : resolve()))
  );
}

/* ---------------------------
   POST /login
   Body: { username, password }
---------------------------- */
router.post(
  '/login',
  [
    body('username').trim().notEmpty().isLength({ max: 150 }),
    body('password').notEmpty().isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(422)
        .json({ success: false, message: 'Errores de validación', errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      // SP returns: [{ id, contrasena, tipo, (optional) puesto }]
      const rows = await db.executeProc('buscar_id_para_login', {
        termino_busqueda: { type: sql.NVarChar(150), value: username }
      });

      if (!rows?.length) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
      }

      const { id, contrasena, tipo, puesto } = rows[0] || {};
      if (!id || !contrasena || !tipo) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
      }

      const match = await bcrypt.compare(password, contrasena);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
      }

      // Set session
      req.session.userID   = id;                 // string OK
      req.session.userType = tipo;               // 'cliente' | 'empleado'
      req.session.isClient = (tipo === 'cliente');
      req.session.isAdmin  = (tipo === 'empleado' && puesto === 'Administrador'); // puesto may be null
      req.session.username = username;           // for /auth/status & menu

      await saveSession(req);
      return res.json({ success: true, message: 'Inicio de sesión exitoso.' });
    } catch (err) {
      console.error('Error en el login:', err);
      return res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
  }
);

/* ---------------------------
   POST /logout  &  GET /logout
---------------------------- */
function logoutHandler(req, res) {
  if (!req.session) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return res.json({ success: true, message: 'Sesión cerrada correctamente' });
  }

  req.session.destroy(err => {
    if (err) {
      console.error('Error al destruir la sesión:', err);
      return res.status(500).json({ success: false, message: 'Error al cerrar sesión.' });
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      return res.redirect(303, '/'); // for direct link clicks
    }
    return res.json({ success: true, message: 'Sesión cerrada correctamente' });
  });
}

router.post('/logout', logoutHandler);
router.get('/logout', logoutHandler);

/* ---------------------------
   GET /auth/status  (for menu.js)
---------------------------- */
router.get('/auth/status', (req, res) => {
  const authenticated = !!req.session?.userID;
  res.set('Cache-Control', 'no-store');
  return res.json({
    authenticated,
    userType: authenticated ? (req.session.userType || 'cliente') : 'guest',
    isAdmin: !!req.session?.isAdmin,
    username: authenticated ? (req.session.username || null) : null
  });
});

function requireAdmin(req, res, next) {
  if (!req.session?.isAdmin) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.redirect('/index.html');
    }
    return res.status(403).json({ success: false, message: "Prohibido: se requieren privilegios de administrador" });
  }
  next();
}

function requireClient(req, res, next) {
  if (!req.session?.isClient) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.redirect('/index.html');
    }
    return res.status(403).json({ success: false, message: "Prohibido: solo para clientes" });
  }
  next();
}

module.exports = router;
module.exports.requireAdmin  = requireAdmin;
module.exports.requireClient = requireClient;

module.exports = router;
