// /Server/routes/categoriesRoute.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const sharp = require('sharp');
const sql = require('mssql');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Dependencias del proyecto
// ─────────────────────────────────────────────────────────────
const ValidationService = require('../validatorService.js');
const categoriasRulesRaw = require('../Validators/Rulesets/categorias.js');
const dbInstance = require('../../db/dbconnector.js');

// ─────────────────────────────────────────────────────────────
// Middleware requireAdmin (usa el de tu app si ya lo exportas)
// ─────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res
      .status(403)
      .json({ success: false, message: 'Prohibido: se requieren privilegios de administrador' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────
// Multer en memoria (acepta imageFile)
// ─────────────────────────────────────────────────────────────
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpe?g|png|gif)$/i)) {
      return cb(new Error('Please upload a valid image file'));
    }
    cb(null, true);
  }
});

// ─────────────────────────────────────────────────────────────
const IMAGES_DIR = path.join(process.cwd(), 'Protected', 'img', 'products');
const PUBLIC_PATH_PREFIX = 'Protected/img/products'; // lo que guardarás en image_path

async function ensureImagesDir() {
  try {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
  } catch (_) {}
}

// Guarda buffer -> JPEG comprimido (quality 80, máx 800px ancho)
async function saveCompressedImageToDisk(file) {
  await ensureImagesDir();
  const timestamp = Date.now();
  // Siempre guardamos .jpg para cumplir el regex del ruleset
  const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
  const filename = `${timestamp}-${safeName}`.replace(/\.(png|gif|jpeg)$/i, '.jpg');
  const absPath = path.join(IMAGES_DIR, filename);

  await sharp(file.buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(absPath);

  return `${PUBLIC_PATH_PREFIX}/${filename}`;
}

// ─────────────────────────────────────────────────────────────
// Normalización de reglas para ValidationService
//   - convierte type 'integer' -> 'number'
//   - elimina claves no soportadas: exists, unique, trim
// ─────────────────────────────────────────────────────────────
function normalizeRules(rules) {
  const out = {};
  for (const [field, rule] of Object.entries(rules)) {
    const r = { ...rule };
    if (r.type === 'integer') r.type = 'number';
    delete r.exists;
    delete r.unique;
    delete r.trim;
    out[field] = r;
  }
  return out;
}
const categoriasRules = normalizeRules(categoriasRulesRaw);

// Coerción básica de tipos desde multipart/form-urlencoded
function coerceBody(body) {
  const data = { ...body };

  if (data.categoria_id !== undefined) {
    const n = Number(data.categoria_id);
    data.categoria_id = Number.isNaN(n) ? data.categoria_id : n;
  }
  if (typeof data.nombre_categoria === 'string') {
    data.nombre_categoria = data.nombre_categoria.trim();
  }
  if (typeof data.descripcion === 'string') {
    data.descripcion = data.descripcion.trim();
  }
  if (typeof data.image_path === 'string') {
    data.image_path = data.image_path.trim();
  }

  return data;
}

// Handler genérico de errores SQL (basado en tus códigos del .sql)
function mapSqlError(err) {
  // err.number puede venir de MSSQL cuando se lanza THROW 5100X
  const code = err && (err.number || err.code || err.errno);
  switch (code) {
    case 51001: // nombre empty (insert)
    case 51004: // nombre empty (update)
      return { status: 422, message: 'El nombre de categoría no puede estar vacío.' };
    case 51002: // ya existe (insert)
    case 51005: // nombre en uso (update)
      return { status: 409, message: 'La categoría ya existe con ese nombre.' };
    case 51003: // no existe para update
    case 51006: // no existe para delete
      return { status: 404, message: 'La categoría ya no se encuentra en la base de datos.' };
    default:
      return { status: 500, message: 'Error en el servidor.' };
  }
}

// ─────────────────────────────────────────────────────────────
// GET /categories/getAll  → categorias_get_all
// ─────────────────────────────────────────────────────────────
router.get('/getAll', requireAdmin, async (_req, res) => {
  try {
    const rows = await dbInstance.queryWithParams('EXEC categorias_get_all', {});
    return res.json(rows);
  } catch (err) {
    console.error('Error al obtener categorías:', err);
    return res.status(500).json({ success: false, error: 'Error al obtener categorías' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /categories/insert  → categorias_insert
// campos esperados: nombre_categoria, descripcion?, imageFile?(multipart)
// ─────────────────────────────────────────────────────────────
router.post('/insert', requireAdmin, uploadImage.single('imageFile'), async (req, res) => {
  try {
    const bodyData = coerceBody(req.body);

    // Procesar imagen si viene
    if (req.file) {
      bodyData.image_path = await saveCompressedImageToDisk(req.file); // e.g. Protected/img/products/xxxxx.jpg
    }

    // Validación (usa ruleset completo)
    const { isValid, errors } = await ValidationService.validateData(bodyData, categoriasRules);
    if (!isValid) {
      return res.status(422).json({ success: false, message: 'Errores de validación', errors });
    }

    // Ejecutar SP
    await dbInstance.queryWithParams(
      'EXEC categorias_insert @nombre_categoria, @descripcion, @image_path',
      {
        nombre_categoria: { type: sql.NVarChar(50), value: bodyData.nombre_categoria },
        descripcion: { type: sql.NVarChar(255), value: bodyData.descripcion || null },
        image_path: { type: sql.NVarChar(255), value: bodyData.image_path || null }
      }
    );

    return res.status(201).json({ success: true, message: 'Categoría insertada correctamente' });
  } catch (err) {
    console.error('Error al insertar categoría:', err);
    const mapped = mapSqlError(err);
    return res.status(mapped.status).json({ success: false, error: mapped.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /categories/update  → categorias_update
// campos esperados: categoria_id, nombre_categoria, descripcion?, imageFile?(multipart)
// ─────────────────────────────────────────────────────────────
router.post('/update', requireAdmin, uploadImage.single('imageFile'), async (req, res) => {
  try {
    const bodyData = coerceBody(req.body);

    if (req.file) {
      bodyData.image_path = await saveCompressedImageToDisk(req.file);
    }

    // Validar con el ruleset completo (categoria_id, etc.)
    const { isValid, errors } = await ValidationService.validateData(bodyData, categoriasRules);
    if (!isValid) {
      return res.status(422).json({ success: false, message: 'Errores de validación', errors });
    }

    await dbInstance.queryWithParams(
      'EXEC categorias_update @categoria_id, @nombre_categoria, @descripcion, @image_path',
      {
        categoria_id: { type: sql.Int, value: bodyData.categoria_id },
        nombre_categoria: { type: sql.NVarChar(50), value: bodyData.nombre_categoria },
        descripcion: { type: sql.NVarChar(255), value: bodyData.descripcion || null },
        image_path: { type: sql.NVarChar(255), value: bodyData.image_path || null }
      }
    );

    return res.json({ success: true, message: 'Categoría actualizada correctamente' });
  } catch (err) {
    console.error('Error al actualizar categoría:', err);
    const mapped = mapSqlError(err);
    return res.status(mapped.status).json({ success: false, error: mapped.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /categories/delete  → categorias_delete
// campos esperados: categoria_id
// ─────────────────────────────────────────────────────────────
router.post('/delete', requireAdmin, async (req, res) => {
  try {
    const bodyData = coerceBody(req.body);

    // Validar SOLO el id usando el sub-ruleset
    const { isValid, errors } = await ValidationService.validateData(
      { categoria_id: bodyData.categoria_id },
      normalizeRules({ categoria_id: categoriasRulesRaw.categoria_id })
    );
    if (!isValid) {
      return res.status(422).json({ success: false, message: 'Errores de validación', errors });
    }

    await dbInstance.queryWithParams(
      'EXEC categorias_delete @categoria_id',
      { categoria_id: { type: sql.Int, value: bodyData.categoria_id } }
    );

    return res.json({ success: true, message: 'Categoría eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar categoría:', err);
    const mapped = mapSqlError(err);
    return res.status(mapped.status).json({ success: false, error: mapped.message });
  }
});

module.exports = router;
