// server.js
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const session    = require('express-session');
const path       = require('path');
const bcrypt     = require('bcrypt');
const multer     = require('multer');
const sharp      = require('sharp');
const fs         = require('fs').promises;
const { body, validationResult } = require('express-validator');

const dbInstance = require('./db/dbconnector.js');
//Servir index y contenido principal Publico
const app = express();
app.use(express.static("Public"));



// —–– Middleware —––
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

// Middleware para verificar si el usuario está autenticado
const requireAuth = (req, res, next) => {
  if (!req.session.userID) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.redirect('/index.html');
    }
    return res.status(401).json({ success: false, message: "No autorizado: sesión no iniciada" });
  }
  next();
};

// Middleware para verificar si es administrador
const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.redirect('/index.html');
    }
    return res.status(403).json({ success: false, message: "Prohibido: se requieren privilegios de administrador" });
  }
  next();
};

// Middleware para verificar si es cliente
const requireClient = (req, res, next) => {
  if (!req.session.isClient) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return res.redirect('/index.html');
    }
    return res.status(403).json({ success: false, message: "Prohibido: solo para clientes" });
  }
  next();
};


// Middleware de validacion
const PROTECTED_DIR = path.resolve(process.cwd(), 'Protected');

// static con cache privado (el cliente no compartirá en cachés públicas)
const adminStatic = express.static(PROTECTED_DIR, {
  index: false,                // evita servir un index por defecto
  maxAge: '1h',                // ajusta según necesidad
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'private, max-age=3600');
  }
});

// Servir servicios protegidos
app.use('/admin-resources', requireAdmin, adminStatic);

const ValidationService = require('./Server/validatorService.js');
//Reglas
const personalInfoRules = require('./Server/Validators/Rulesets/personalinfo.js');


// Rutas
const categoriesRoutes = require('./Server/routes/categoriesRoute.js');
app.use('/categories', categoriesRoutes);


//Ruta para login
app.post('/login',
  // 1) Middleware de validación
  [
    body('username')
      .trim()
      .notEmpty().withMessage('El nombre de usuario es obligatorio')
      .isLength({ max: 50 }).withMessage('El nombre de usuario debe tener como máximo 50 caracteres'),
    body('password')
      .notEmpty().withMessage('La contraseña es obligatoria')
      .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
  ],
  // 2) Controlador asíncrono
  async (req, res) => {
    // Validar los errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, message: "Errores de validación", errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      // 1) Buscar la cuenta del usuario (cliente o empleado)
      const searchId = await dbInstance.queryWithParams(
        'EXEC buscar_id_para_login @cuenta, @email',
        {
          cuenta: { type: sql.NVarChar(50), value: username },
          email: { type: sql.NVarChar(150), value: username }  // Permitir búsqueda por email también
        }
      );

      // Verificar si se encontraron resultados
      const users = searchId;
      if (!users || users.length === 0) {
        return res.status(404).json({ success: false, message: "Credenciales inválidas." });
      }

      // 2) Comprobar la contraseña
      const user = users[0];  // Suponiendo que sólo se devuelve un resultado
      const hashedPassword = user.contrasena;

      // Comparar la contraseña enviada con la almacenada en la base de datos
      const passwordMatch = await bcrypt.compare(password, hashedPassword);
      if (!passwordMatch) {
        return res.status(401).json({ success: false, message: "Credenciales inválidas." });
      }

      // 3) Configurar la sesión
      req.session.userID = user.cliente_id || user.empleado_id;  // Usar cliente_id o empleado_id según corresponda
      req.session.isClient = !!user.cliente_id;  // Si es cliente, establecer isClient
      req.session.isAdmin = !!user.empleado_id && user.puesto === 'Administrador';  // Si es administrador, establecer isAdmin

      return res.json({ success: true, message: "Inicio de sesión exitoso." });

    } catch (error) {
      console.error("Error en el login:", error);
      return res.status(500).json({ success: false, message: "Error en el servidor." });
    }
  }
);

//Ruta para cerra sesion
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error al cerrar sesión" });
    }
    res.clearCookie('connect.sid'); // Nombre de la cookie de sesión (puede variar)
    res.json({ success: true, message: "Sesión cerrada correctamente" });
  });
});

//Rutas para Clientes

app.post('/users/submitpersonalInformation',
  requireClient,
  async (req, res) => {
    // Validar información recibida
    const { isValid, errors } = await ValidationService.validateData(req.body, personalInfoRules);
    if (!isValid) {
      return res.status(422).json({ success: false, message: 'Errores de validación', errors });
    }

    const {
      cliente_id,
      nombre,
      apellidos,
      telefono,
      direccion,
      ciudad,
      codigo_postal,
      pais
    } = req.body;

    // Factorizar parámetros
    const params = {
      cliente_id: { type: sql.NVarChar(20), value: cliente_id },
      nombre:       { type: sql.NVarChar(50), value: nombre },
      apellidos:    { type: sql.NVarChar(100), value: apellidos },
      telefono:     { type: sql.NVarChar(20), value: telefono || null },
      direccion:    { type: sql.NVarChar(200), value: direccion || null },
      ciudad:       { type: sql.NVarChar(50), value: ciudad || null },
      codigo_postal:{ type: sql.NVarChar(10), value: codigo_postal || null },
      pais:         { type: sql.NVarChar(50), value: pais || null }
    };

    // Función para intentar insertar
    async function intentoInsertar() {
      return dbInstance.queryWithParams(
        'EXEC datos_personales_insert @cliente_id, @nombre, @apellidos, @telefono, @direccion, @ciudad, @codigo_postal, @pais',
        params
      );
    }

    // Función para intentar actualizar
    async function intentoActualizar() {
      return dbInstance.queryWithParams(
        'EXEC datos_personales_update @cliente_id, @nombre, @apellidos, @telefono, @direccion, @ciudad, @codigo_postal, @pais',
        params
      );
    }

    try {
      await intentoInsertar();
      return res.status(201).json({ success: true, message: 'Información personal guardada correctamente' });
    } catch (error) {
      console.error('Error al guardar información personal:', error);

      if (error.number === 51011) {
        // Si ya existe, intentamos actualizar
        try {
          await intentoActualizar();
          return res.json({ success: true, message: 'Información personal actualizada correctamente' });
        } catch (updateError) {
          console.error('Error al actualizar información personal:', updateError);
          if (updateError.number === 51012) {
            return res.status(404).json({
              success: false,
              message: 'No se encontró información personal para actualizar (inconsistencia en la base de datos)'
            });
          }
          return res.status(500).json({ success: false, message: 'Error al actualizar la información personal' });
        }
      }

      if (error.number === 51010) {
        return res.status(404).json({ success: false, message: 'El cliente especificado no existe' });
      }

      return res.status(500).json({ success: false, message: 'Error al procesar la información personal' });
    }
  }
);


// Iniciar el servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});



// —–– Start & Graceful Shutdown —––
const PORT = process.env.PORT || 4000;
app.listen(PORT, '127.0.0.1', () =>
  console.log(`Listening on http://127.0.0.1:${PORT}`)
);

process.on('SIGINT', async () => {
  console.log('Shutting down…');
  if (db?.dbconnector) {
    await db.dbconnector.end();
  }
  process.exit(0);
});
