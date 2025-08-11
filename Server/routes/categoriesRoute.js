// Server/routes/categoriasRoute.js
const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs/promises');

const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const { InsertRules, UpdateRules, DeleteRules } = require('../Validators/Rulesets/categorias.js');
const { requireAdmin } = require('./authRoute.js');

const CategoriasRouter = express.Router();

/* ─────────────────────────────────────────────────────────────
   Multer en memoria: aceptamos ~10MB (pruebas ~6MB OK)
───────────────────────────────────────────────────────────── */
const UploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpe?g|png|gif)$/i)) {
      return cb(new Error('Please upload a valid image file'));
    }
    cb(null, true);
  }
});

/* ─────────────────────────────────────────────────────────────
   Directorios de imágenes: Protected/img/categorias
───────────────────────────────────────────────────────────── */
const IMAGES_DIR = path.join(process.cwd(), 'Protected', 'img', 'categorias');
const PUBLIC_PREFIX = path.join('Protected', 'img', 'categorias');

async function EnsureImagesDir() {
  try { await fs.mkdir(IMAGES_DIR, { recursive: true }); } catch (_) {}
}

// Guarda buffer -> JPEG comprimido (quality 80, máx 800px)
async function SaveCompressedImageToDisk(file) {
  await EnsureImagesDir();
  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
  const filename = `${timestamp}-${safeName}`.replace(/\.(png|gif|jpeg)$/i, '.jpg');
  const absPath = path.join(IMAGES_DIR, filename);

  await sharp(file.buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(absPath);

  return path.join(PUBLIC_PREFIX, filename).replace(/\\/g, '/');
}

// Helper para armar params { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

/* ============================================================================
   GET /categorias/get_all   -> SP: categorias_get_all
============================================================================ */
CategoriasRouter.get('/get_all', requireAdmin, async (req, res) => {
  try {
    const data = await db.executeProc('categorias_get_all', {});
    console.log(data);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Categorías obtenidas' : 'Sin categorías',
      data //Construccion de Resutado exitoso
    });
  } catch (err) {
    console.error('categorias_get_all error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener categorías',
      data: [] // keep response shape consistent
    });
  }
});


/* ============================================================================
   GET /categorias/get_list  -> SP: categorias_get_list
============================================================================ */
CategoriasRouter.get('/get_list', async (req, res) => {
  try {
    const data = await db.executeProc('categorias_get_list', {}); // <= OBTÉN LAS FILAS
    return res.status(200).json({
      success: true,
      message: data.length ? 'Lista de categorías obtenida' : 'Sin categorías',
      data  //Construccion de Resutado exitoso
    });
  } catch (err) {
    console.error('categorias_get_list error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener la lista de categorías', data: [] });
  }
});


/* ============================================================================
   POST /categorias/insert   -> SP: categorias_insert
   Acepta imageFile; si llega, comprimimos y guardamos en Protected/img/categorias
============================================================================ */
CategoriasRouter.post('/insert', requireAdmin, UploadImage.single('imageFile'), async (req, res) => {
  try {
    const Body = { ...req.body };

    // Si llega imagen, generamos image_path (esta tabla lo tiene)
    if (req.file) {
      Body.image_path = await SaveCompressedImageToDisk(req.file);
    }

    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (insert)' });
    }

    const Params = BuildParams([
      { name: 'nombre_categoria', type: sql.NVarChar(50),  value: Body.nombre_categoria },
      { name: 'descripcion',      type: sql.NVarChar(255), value: Body.descripcion ?? null },
      { name: 'image_path',       type: sql.NVarChar(255), value: Body.image_path ?? null }
    ]);

    await db.executeProc('categorias_insert', Params);
    return res.status(201).json({ success: true, message: 'Categoría creada correctamente' });
  } catch (Error_) {
    console.error('categorias_insert error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al crear la categoría' });
  }
});

/* ============================================================================
   POST /categorias/update   -> SP: categorias_update
   Si llega imageFile, actualizamos image_path con el nuevo archivo
============================================================================ */
CategoriasRouter.post('/update', requireAdmin, UploadImage.single('imageFile'), async (req, res) => {
  try {
    const Body = {
      ...req.body,
      categoria_id: Number(req.body.categoria_id)
    };

    if (req.file) {
      Body.image_path = await SaveCompressedImageToDisk(req.file);
      // (Opcional) borrar imagen anterior si tienes la ruta almacenada
    }

    const { isValid } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (update)' });
    }

    const Params = BuildParams([
      { name: 'categoria_id',     type: sql.Int,           value: Body.categoria_id },
      { name: 'nombre_categoria', type: sql.NVarChar(50),  value: Body.nombre_categoria },
      { name: 'descripcion',      type: sql.NVarChar(255), value: Body.descripcion ?? null },
      { name: 'image_path',       type: sql.NVarChar(255), value: Body.image_path ?? null }
    ]);

    await db.executeProc('categorias_update', Params);
    return res.status(200).json({ success: true, message: 'Categoría actualizada correctamente' });
  } catch (Error_) {
    console.error('categorias_update error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al actualizar la categoría' });
  }
});

/* ============================================================================
   POST /categorias/delete   -> SP: categorias_delete
============================================================================ */
CategoriasRouter.post('/delete', requireAdmin, async (req, res) => {
  try {
    const Body = { categoria_id: Number(req.body.categoria_id) };

    const { isValid } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (delete)' });
    }

    const Params = BuildParams([
      { name: 'categoria_id', type: sql.Int, value: Body.categoria_id }
    ]);

    await db.executeProc('categorias_delete', Params);
    return res.status(200).json({ success: true, message: 'Categoría eliminada correctamente' });
  } catch (Error_) {
    console.error('categorias_delete error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al eliminar la categoría' });
  }
});

module.exports = CategoriasRouter;
