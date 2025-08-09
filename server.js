// =============================
// Importaciones y configuración del entorno
// =============================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
//const dbInstance = require('./db/dbconnector.js');
const app = express();
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;

// =============================
// Leer constantes para la base de datos desde .env
// =============================
const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    acquireTimeout: 300
};

// Configurar Multer para mantener las cargas en memoria y así poder transformarlas antes de guardarlas
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // p.ej. máximo 10 MB en bruto
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpe?g|png|gif)$/i)) {
      return cb(new Error('Please upload a valid image file'));
    }
    cb(null, true);
  }
});

// Configurar almacenamiento de Multer para guardar imágenes de productos en Protected/img/products
const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Asegúrate de que la carpeta de destino exista en tu sistema de archivos.
      cb(null, path.join(__dirname, 'Protected', 'img', 'products'));
    },
    filename: function (req, file, cb) {
      // Crear un nombre único añadiendo la marca de tiempo actual al nombre original.
      cb(null, Date.now() + '-' + file.originalname);
    }
});
  
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpe?g|png|gif)$/i)) {
      return cb(new Error('Please upload a valid image file'));
    }
    cb(null, true);
  }
});

// =============================
// Middleware
// =============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Cambia esto en producción y usa .env
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 60 * 60 * 1000 // 1 hora
    }
}));

// =============================
// Middleware para gestionar sesión
// =============================
function requireLogin(req, res, next) {
    if (req.session && req.session.userID) {
        return next();
    }
    // Si la solicitud acepta HTML, redirigir a la página de inicio de sesión.
    if (req.headers.accept && req.headers.accept.indexOf('text/html') !== -1) {
        return res.redirect('/index.html');
    }
    // De lo contrario, responder con un error en JSON.
    return res.status(401).json({ error: "Unauthorized" });
}

// Middleware for User authentication
function requireUser(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/user-login.html');
    }
    return res.status(403).json({ error: "User access required" });
}

// Middleware for Admin authentication
function requireAdmin(req, res, next) {
    if (req.session.userId && req.session.puesto === 'Administrador') {
        return next();
    }
    
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/admin-login.html');
    }
    return res.status(403).json({ error: "Admin access required" });
}
// =============================
// Rutas públicas
// =============================

// Servir contenido público
app.use(express.static("Public"));

// =============================
// Rutas privadas
// =============================

// Proteger el acceso a la carpeta `Protected`
app.use(
    '/admin-resources',
    requireLogin,
    //requireadmin(),
    express.static(path.join(__dirname, 'Protected'))
);

// Proteger panel y ruta de administración
app.get('/admin', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'Protected', 'admin.html'));
});

/*-- Ruta para guardar una nueva categoría --*/
app.post('/categories/submitForm', uploadImage.single('imageFile'), async (req, res) => {
  try {
    // Procesar imagen
    let imagePath = null;
    if (req.file) {
      const timestamp = Date.now();
      const ext       = path.extname(req.file.originalname);
      const filename  = `${timestamp}${ext}`;
      const destPath  = path.join(__dirname, 'Protected', 'img', 'categories', filename);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await sharp(req.file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .toFile(destPath);
      imagePath = `Protected/img/categories/${filename}`;
    }

    // — Ejecutar la consulta —
    const { nombre_categoria, descripcion } = req.body;
    const pool = await dbInstance.poolReady;
    await pool.request()
      .input('Nombre',      sql.NVarChar(50),  nombre_categoria)
      .input('Descripcion', sql.NVarChar(255), descripcion)
      .input('Image_Path',  sql.NVarChar(255), imagePath)
      .execute('Insert_Categorias');

    // — Manejo de errores —
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    const ErrorMsg = err.message === 'Por favor ingresa una imagen válida'
      ? 'Por favor ingresa una imagen válida'
      : 'Error interno del servidor';
    res.status(400).json({ success: false, error: ErrorMsg });
  }
});

// =============================
// Rutas para gestionar sesión
// =============================
app.get('/session', (req, res) => {
    if (req.session.userID) {
        res.json({ loggedIn: true, userID: req.session.userID });
    } else {
        res.json({ loggedIn: false });
    }
});

// --- Ruta de administración ---
app.get('/admin', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'Protected', 'admin.html'));
});


// =============================
// Configuraciones del servidor
// =============================

// Leer el puerto desde la variable de entorno PORT (por ejemplo, establecida por tu proveedor de hosting),
// o usar 4000 por defecto al ejecutar localmente.
const PORT = process.env.PORT || 4000;

// Iniciar el servidor y enlazar a todas las interfaces de red IPv4 (0.0.0.0).
// Enlazar a 0.0.0.0 en lugar de 'localhost' (127.0.0.1) hace que la app sea accesible
// desde otros dispositivos dentro de una LAN.
//dbInstance.poolReady
  //.then(() => {
    // Sólo arrancamos el servidor si la BBDD respondió OK
    app.listen(PORT, '127.0.0.1', () =>
      console.log(`Almacen-Zafiro listening on http://127.0.0.1:${PORT}`)
    );
  //})
  //.catch(() => {
    //console.error('No hay conexión con la base de datos. Apagando servidor.');
    //process.exit(1);
  //});

// =============================
// Apagado del servidor
// =============================
process.on('SIGINT', async () => {
    console.log("\nServer is stopping...");
    console.log("Clearing sessions and closing database pool...");

    if (dbInstance?.dbconnector) {
        await dbInstance.dbconnector.end();
        console.log("Database pool closed.");
    }

    process.exit(0);
});
