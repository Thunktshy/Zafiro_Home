// Server/routes/imagenesRoute.js
'use strict';
const express = require('express');
const multer  = require('multer');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const { requireAdmin } = require('./authRoute.js');
const {
  UploadProductoRules, UploadCategoriaRules,
  GetByProductoRules, GetByCategoriaRules, DeleteRules
} = require('../Validators/Rulesets/imagenes.js');
const ImageService = require('../services/imageService.js');

const ImagenesRouter = express.Router();

// Helper params { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Multer en MEMORIA (10MB) + filtro mimetype/ext
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const okName = /\.(jpe?g|png|gif)$/i.test(file.originalname || '');
    const okMime = /^(image\/jpeg|image\/png|image\/gif)$/i.test(file.mimetype || '');
    if (!okName || !okMime) return cb(new Error('Please upload a valid image file (jpg/png/gif)'));
    cb(null, true);
  }
});

/* ============================================================================
   POST /imagenes/productos/upload
============================================================================ */
ImagenesRouter.post('/productos/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const Body = { producto_id: String(req.body?.producto_id || '').trim() };
    const { isValid, errors } = await ValidationService.validateData(Body, UploadProductoRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (upload producto)', errors });
    if (!req.file) return res.status(400).json({ success:false, message:'Archivo requerido' });

    const { canonicalPath } = await ImageService.processAndSave({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      type: 'producto',
      ownerId: Body.producto_id
    });

    const Params = BuildParams([
      { name: 'producto_id', type: sql.NVarChar(20),  value: Body.producto_id },
      { name: 'image_path',  type: sql.NVarChar(255), value: canonicalPath }
    ]);
    const data = await db.executeProc('imagenes_productos_insert', Params);

    return res.status(200).json({ success:true, message:'Imagen de producto guardada', data: { ...data, image_path: canonicalPath } });
  } catch (err) {
    console.error('productos/upload error:', err);
    return res.status(500).json({ success:false, message:'Error al subir imagen de producto' });
  }
});

/* ============================================================================
   POST /imagenes/categorias/upload
============================================================================ */
ImagenesRouter.post('/categorias/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const Body = { categoria_id: Number(req.body?.categoria_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, UploadCategoriaRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (upload categoría)', errors });
    if (!req.file) return res.status(400).json({ success:false, message:'Archivo requerido' });

    const { canonicalPath } = await ImageService.processAndSave({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      type: 'categoria',
      ownerId: Body.categoria_id
    });

    const Params = BuildParams([
      { name: 'categoria_id', type: sql.Int,          value: Body.categoria_id },
      { name: 'image_path',   type: sql.NVarChar(255), value: canonicalPath }
    ]);
    const data = await db.executeProc('imagenes_categorias_insert', Params);

    return res.status(200).json({ success:true, message:'Imagen de categoría guardada', data: { ...data, image_path: canonicalPath } });
  } catch (err) {
    console.error('categorias/upload error:', err);
    return res.status(500).json({ success:false, message:'Error al subir imagen de categoría' });
  }
});

/* ============================================================================
   GET /imagenes/productos/:producto_id
============================================================================ */
ImagenesRouter.get('/productos/:producto_id', async (req, res) => {
  try {
    const Body = { producto_id: String(req.params.producto_id || '').trim() };
    const { isValid, errors } = await ValidationService.validateData(Body, GetByProductoRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (get por producto)', errors });

    const Params = BuildParams([{ name:'producto_id', type: sql.NVarChar(20), value: Body.producto_id }]);
    const data = await db.executeProc('imagenes_productos_get_by_producto', Params);

    return res.status(200).json({ success:true, message: data.length ? 'Imágenes obtenidas' : 'Sin imágenes', data });
  } catch (err) {
    console.error('get productos error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener imágenes' });
  }
});

/* ============================================================================
   GET /imagenes/categorias/:categoria_id
============================================================================ */
ImagenesRouter.get('/categorias/:categoria_id', async (req, res) => {
  try {
    const Body = { categoria_id: Number(req.params.categoria_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, GetByCategoriaRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (get por categoría)', errors });

    const Params = BuildParams([{ name:'categoria_id', type: sql.Int, value: Body.categoria_id }]);
    const data = await db.executeProc('imagenes_categorias_get_by_categoria', Params);

    return res.status(200).json({ success:true, message: data.length ? 'Imágenes obtenidas' : 'Sin imágenes', data });
  } catch (err) {
    console.error('get categorias error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener imágenes' });
  }
});

/* ============================================================================
   DELETE /imagenes/productos/:id
============================================================================ */
ImagenesRouter.delete('/productos/:id', requireAdmin, async (req, res) => {
  try {
    const Body = { id: Number(req.params.id) };
    const { isValid, errors } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (delete producto)', errors });

    // Recupera registro para conocer image_path canónico
    const current = await db.executeProc('imagenes_productos_get_by_id', BuildParams([{ name:'id', type: sql.Int, value: Body.id }]));
    const row = Array.isArray(current) ? current[0] : null;

    if (row?.image_path) await ImageService.removeByCanonical(row.image_path);
    await db.executeProc('imagenes_productos_delete', BuildParams([{ name:'id', type: sql.Int, value: Body.id }]));

    return res.status(200).json({ success:true, message:'Imagen de producto eliminada' });
  } catch (err) {
    console.error('delete productos error:', err);
    return res.status(500).json({ success:false, message:'No se pudo eliminar la imagen' });
  }
});

/* ============================================================================
   DELETE /imagenes/categorias/:id
============================================================================ */
ImagenesRouter.delete('/categorias/:id', requireAdmin, async (req, res) => {
  try {
    const Body = { id: Number(req.params.id) };
    const { isValid, errors } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (delete categoría)', errors });

    const current = await db.executeProc('imagenes_categorias_get_by_id', BuildParams([{ name:'id', type: sql.Int, value: Body.id }]));
    const row = Array.isArray(current) ? current[0] : null;

    if (row?.image_path) await ImageService.removeByCanonical(row.image_path);
    await db.executeProc('imagenes_categorias_delete', BuildParams([{ name:'id', type: sql.Int, value: Body.id }]));

    return res.status(200).json({ success:true, message:'Imagen de categoría eliminada' });
  } catch (err) {
    console.error('delete categorias error:', err);
    return res.status(500).json({ success:false, message:'No se pudo eliminar la imagen' });
  }
});

module.exports = ImagenesRouter;
