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

const { db, sql } = require('./db/dbconnector.js');

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


// Middleware de validacion se carpetas de sesion
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

// Resuelve la carpeta física "Clientes"
const CLIENT_DIR = path.resolve(process.cwd(), 'Clientes');

// Static con caché privada (igual que admin)
const clientStatic = express.static(CLIENT_DIR, {
  index: false,
  maxAge: '1h',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'private, max-age=3600');
  }
});

// Monta los recursos del portal de clientes, protegidos
app.use('/client-resources', requireClient, clientStatic);

// Rutas

const authRouter = require('./Server/routes/authRoute.js'); 
app.use(authRouter);

//Rutas para Clientes
const ClientesRoutes = require('./Server/routes/clientesRoute.js');
app.use('/clientes', ClientesRoutes);

const BuscarRoutes = require('./Server/routes/buscarCliente.js');
app.use('/buscar', BuscarRoutes);

//Rutas Empleados
const EmpleadosRoutes = require('./Server/routes/empleadosRoute.js');
app.use('/empleados', EmpleadosRoutes);

//Rutas Categorias
const CategoriasRoutes = require('./Server/routes/categoriesRoute.js');
app.use('/categorias', CategoriasRoutes);

//Rutas datos personales
const DatosPersonalesRoutes = require('./Server/routes/datos_personalesRoute.js');
app.use('/datos_personales', DatosPersonalesRoutes);

//Rutas datos de facturacion
const DatosFacturacionRoutes = require('./Server/routes/datos_facturacionRoute.js');
app.use('/datos_facturacion', DatosFacturacionRoutes);

//Rutas Metodos de pago
const MetodosPagoRoutes = require('./Server/routes/metodos_pagoRoute.js');
app.use('/metodos_pago', MetodosPagoRoutes);

//Rutas Productos
const ProductosRoutes = require('./Server/routes/productosRoute.js');
app.use('/productos', ProductosRoutes);

// Consultas de pedidos
const pedidosRouter = require('./Server/routes/pedidosRoute.js');
app.use('/pedidos', pedidosRouter);

// Control de pedidos (mutaciones)
const controlPedidosRouter = require('./Server/routes/control_pedidosRoute.js');
app.use('/pedidos', controlPedidosRouter);

//Gestion stock y alertas
const GestionRoutes = require('./Server/routes/gestion_stock_y_alertasRoute.js');
app.use('/gestion_stock_y_alertas', GestionRoutes);

//Rutas reportes
const ReportesRoutes = require('./Server/routes/reportesRoute.js');
app.use('/reportes', ReportesRoutes);

//Rutas Promociones
const PromocionesRouter = require('./Server/routes/promocionesRoute.js')
app.use('/promociones', PromocionesRouter);


// Iniciar el servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down…');
  if (db?.dbconnector) {
    await db.dbconnector.end();
  }
  process.exit(0);
});