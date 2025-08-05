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
const dbInstance = require('./db/dbconnector.js');

const app = express();

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

app.use(express.static("Public"));

app.post('/login', async (req, res) => {
  const { user, password } = req.body;
  try {
    // Llamada al genérico que retorna el recordset directamente
    const rows = await dbInstance.queryWithParams(
      'EXEC Iniciarsesion @cuenta, @password',
      {
        cuenta:   { type: sql.NVarChar(50), value: user },
        password: { type: sql.NVarChar(255), value: password }
      }
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Usuario no encontrado." });
    }

    const userRecord = rows[0];
    const passwordMatch = await bcrypt.compare(password, userRecord.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Contraseña incorrecta." });
    }

    req.session.userID = userRecord.Usuario_Id;
    return res.json({ success: true, message: "Inicio de sesión exitoso." });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({ success: false, message: "Error en el servidor." });
  }
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
