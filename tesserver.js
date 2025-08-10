// server.js
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const session    = require('express-session');
const path       = require('path');

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


// --- static mounts (keep your existing admin mount) ---
const PROTECTED_DIR = path.resolve(process.cwd(), 'Protected');
const USERS_DIR     = path.resolve(process.cwd(), 'Users'); // <- adjust if your users area lives elsewhere

const adminStatic = express.static(PROTECTED_DIR, {
  index: false,
  maxAge: '1h',
  setHeaders: (res) => res.setHeader('Cache-Control', 'private, max-age=3600')
});

const userStatic = express.static(USERS_DIR, {
  index: false,
  maxAge: '1h',
  setHeaders: (res) => res.setHeader('Cache-Control', 'private, max-age=3600')
});

// Require these middlewares from your auth routes file
const { requireAdmin, requireClient } = require('./routes/auth.routes');

// Mounts
app.use('/admin-resources', requireAdmin, adminStatic);
app.use('/user-resources',  requireClient, userStatic);

// Rutas
const categoriesRoutes = require('./Server/routes/categoriesRoute.js');
app.use('/categories', categoriesRoutes);

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