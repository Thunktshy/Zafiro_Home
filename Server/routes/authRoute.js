// routes/auth.routes.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt     = require('bcrypt');

// adjust the path to where your db.js lives
const { db, sql } = require('../../db/dbconnector.js');

const router = express.Router();
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'connect.sid';

const ADMIN_HOME  = '/admin-resources/pages/admin.html';
const CLIENT_HOME = '/client-resources/pages/miCuenta.html';

// Helper: ensure session is saved before responding
function saveSession(req) {
  return new Promise((resolve, reject) =>
    req.session.save(err => (err ? reject(err) : resolve()))
  );
}

// Login

router.post('/login', [
  body('username').trim().notEmpty().isLength({ max: 150 }),
  body('password').notEmpty().isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, message: 'Errores de validación', errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
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

    // Normalize and decide by tipo only
    const normTipo = String(tipo || '').trim().toLowerCase(); // 'cliente' | 'empleado'
    req.session.userID   = id;
    req.session.userType = normTipo;
    req.session.isClient = (normTipo === 'cliente');
    req.session.isAdmin  = (normTipo === 'empleado');

    await saveSession(req);

    const redirect = req.session.isAdmin ? ADMIN_HOME : CLIENT_HOME;

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso.', 
      //Devolver tipo de sesion
      isAdmin: req.session.isAdmin === true,
      isClient: req.session.isClient === true,
      userID:  req.session.userID || null,
      username: req.session.username || 'Bienvenido',
      redirect,
      userType: normTipo
    });

  } catch (err) {
    console.error('Error en el login:', err);
    return res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
});


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
    isClient: !!req.session?.isClient,
    userID:  authenticated ? (req.session.userID || null) : null,
    username: authenticated ? (req.session.username || null) : null
  });
});

// --- Helpers comunes para respuestas coherentes (HTML vs JSON) ---
function wantsHtml(req) {
  return (req.headers.accept || '').includes('text/html');
}

function deny(res, status, message) {
  // Usa 401 para no autenticado, 403 para autenticado sin permisos
  return res.status(status).json({ success: false, message });
}

// --- Middleware: requiere estar autenticado (admin O cliente) ---
function requireAuth(req, res, next) {
  const s = req.session || {};
  if (s.isAdmin || s.isClient) return next();

  if (wantsHtml(req)) {
    // Usuario no autenticado: redirige a inicio
    return res.redirect('/index.html');
  }
  return deny(res, 401, 'No autenticado');
}

// --- Middleware de roles flexible: requireAnyRole('admin', 'cliente') ---
function requireAnyRole(...roles) {
  // Normaliza lista de roles a flags de sesión
  const map = {
    admin:   'isAdmin',
    cliente: 'isClient',
    empleado: 'isAdmin',
    user:    null,
  };

  // Devuelve el middleware real
  return function (req, res, next) {
    const s = req.session || {};

    // Primero: ¿está autenticado?
    if (!(s.isAdmin || s.isClient)) {
      if (wantsHtml(req)) return res.redirect('/index.html');
      return deny(res, 401, 'No autenticado');
    }

    // Si no se pasó ningún rol, basta con estar autenticado
    if (!roles || roles.length === 0) return next();

    // ¿Cumple alguno de los roles permitidos?
    const ok = roles.some(r => {
      const flag = map[r?.toString().toLowerCase()];
      return flag ? !!s[flag] : false;
    });

    if (ok) return next();

    // Autenticado pero sin permisos suficientes
    if (wantsHtml(req)) return res.redirect('/index.html');
    return deny(res, 403, 'Prohibido: permisos insuficientes');
  };
}

// --- Especializaciones prácticas ---
const requireAdmin         = requireAnyRole('admin');
const requireClient        = requireAnyRole('cliente');
const requireAdminOrClient = requireAnyRole('admin', 'cliente');

module.exports.requireAuth          = requireAuth;
module.exports.requireAnyRole       = requireAnyRole;
module.exports.requireAdmin         = requireAdmin;
module.exports.requireClient        = requireClient;
module.exports.requireAdminOrClient = requireAdminOrClient;

