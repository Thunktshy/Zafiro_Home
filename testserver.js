// server.js
require('dotenv').config();               // 1

const express      = require('express');
const helmet       = require('helmet');   // 2
const morgan       = require('morgan');   // 3
const cors         = require('cors');
const session      = require('express-session');
const rateLimit    = require('express-rate-limit'); // 4
const path         = require('path');
const multer       = require('multer');   // 5
//const dbInstance   = require('./db/dbconnector.js');

const app = express();

// —–– Security headers + logging —––
app.use(helmet());                        // 2
app.use(morgan('combined'));              // 3
const { body, validationResult } = require('express-validator');

// —–– CORS —––
const whitelist = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(u => u.trim())
  .filter(u => u);
app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || whitelist.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed'));
  },
  credentials: true
}));


// —–– Body parsers —––
app.use(express.json({ limit: '10kb' }));              // 6
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// —–– Rate limiting (apply to auth routes) —––
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,           // 15 minutes
  max: 20,                            // limit each IP to 20 requests per window
  message: { success: false, message: 'Too many requests, try again later.' }
});
app.use('/login', authLimiter);

// —–– Session management —––
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 522656,
  resave: false,
  saveUninitialized: false,
  rolling: true,                      // refresh session on each request
  cookie: {
    httpOnly: true,                   // no client-side JS access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000            // 1 hour
  }
}));

// —–– Static files —––
app.use(express.static(path.join(__dirname, 'Public'), {
  index: 'index.html',
  extensions: ['html']
}));

// —–– Multer (file-upload) setup —––
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo JPG/PNG permitidos'));
    }
  }
});

// Example route that uses `upload` + image processing:
// app.post('/upload-avatar',
//   upload.single('avatar'),
//   async (req, res, next) => {
//     try {
//       const bufferResized = await sharp(req.file.buffer)
//         .resize(256, 256)
//         .png()
//         .toBuffer();
//       // …save bufferResized to disk or database…
//–     res.json({ success: true });
//     } catch (err) {
//       next(err);
//     }
//   }
// );

// —–– Your API routes go here —––
// app.use('/api', require('./routes/api'));

// --- Login endpoint ---
app.post('/login', body('username')
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Usuario inválido')
    .isAlphanumeric().withMessage('Usuario solo permite letras y números'),
  body('password')
    .isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres'),
  async (req, res) => {
    // 2) Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ success: false, errors: errors.array().map(e => e.msg) });
    }

    const { username, password } = req.body;

    try {
      // 3) Call stored proc
      const pool = await db.poolReady;
      const { recordset } = await pool.request()
        .input('cuenta',   sql.NVarChar(50),  username)
        .execute('Iniciarsesion');

      // 4) No user?
      if (!recordset.length) {
        return res
          .status(401)
          .json({ success: false, message: 'Usuario o contraseña incorrectos.' });
      }

      const user = recordset[0];
      // 5) Compare hashes
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res
          .status(401)
          .json({ success: false, message: 'Usuario o contraseña incorrectos.' });
      }

      // 6) Authenticated!
      req.session.userID = user.Usuario_Id;
      return res.json({
        success: true,
        message: 'Inicio de sesión exitoso.',
        user: { id: user.Usuario_Id, name: user.Nombre }
      });
    } catch (err) {
      console.error('Error en /login:', err);
      return res
        .status(500)
        .json({ success: false, message: 'Error interno del servidor.' });
    }
  }
);

// —–– 404 handler —––
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'No encontrado' });
});

// —–– Global error handler —––
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message || 'Error interno' });
});

// —–– Start server —––
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
