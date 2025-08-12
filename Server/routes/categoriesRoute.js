// Server/routes/categoriasRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const { InsertRules, UpdateRules, DeleteRules, GetByIdRules } = require('../Validators/Rulesets/categorias.js');
const { requireAdmin } = require('../routes/authRoute.js');

const CategoriasRouter = express.Router();

// Helper para armar params { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

/* ============================================================================
   GET /categorias/get_all   -> SP: categorias_get_all
============================================================================ */
CategoriasRouter.get('/get_all', async (_req, res) => {
  try {
    const data = await db.executeProc('categorias_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Categorías obtenidas' : 'Sin categorías',
      data
    });
  } catch (err) {
    console.error('categorias_get_all error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener categorías', data: [] });
  }
});

/* ============================================================================
   GET /categorias/get_list  -> SP: categorias_get_list
============================================================================ */
CategoriasRouter.get('/get_list', async (_req, res) => {
  try {
    const data = await db.executeProc('categorias_get_list', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Lista de categorías obtenida' : 'Sin categorías',
      data
    });
  } catch (err) {
    console.error('categorias_get_list error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener la lista de categorías', data: [] });
  }
});

/* ============================================================================
   GET /categorias/by_id/:id  -> SP: categorias_por_id
============================================================================ */
CategoriasRouter.get('/by_id/:id', async (req, res) => {
  try {
    const Body = { categoria_id: Number(req.params.id) };
    const { isValid, errors } = await ValidationService.validateData(Body, GetByIdRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_id)', errors });

    const Params = BuildParams([{ name: 'categoria_id', type: sql.Int, value: Body.categoria_id }]);
    const data = await db.executeProc('categorias_por_id', Params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });

    return res.status(200).json({ success: true, message: 'Categoría obtenida', data: data[0] });
  } catch (err) {
    console.error('categorias_por_id error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener la categoría' });
  }
});

/* ============================================================================
   POST /categorias/insert   -> SP: categorias_insert
============================================================================ */
CategoriasRouter.post('/insert', requireAdmin, async (req, res) => {
  try {
    const Body = {
      nombre_categoria: (req.body?.nombre_categoria || '').trim(),
      descripcion: req.body?.descripcion ?? null
    };

    const { isValid, errors } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (insert)', errors });

    const Params = BuildParams([
      { name: 'nombre_categoria', type: sql.NVarChar(50),  value: Body.nombre_categoria },
      { name: 'descripcion',      type: sql.NVarChar(255), value: Body.descripcion }
    ]);

    await db.executeProc('categorias_insert', Params);
    return res.status(201).json({ success: true, message: 'Categoría creada correctamente' });
  } catch (err) {
    console.error('categorias_insert error:', err);
    return res.status(500).json({ success: false, message: 'Error al crear la categoría' });
  }
});

/* ============================================================================
   POST /categorias/update   -> SP: categorias_update
============================================================================ */
CategoriasRouter.post('/update', requireAdmin, async (req, res) => {
  try {
    const Body = {
      categoria_id: Number(req.body.categoria_id),
      nombre_categoria: (req.body?.nombre_categoria || '').trim(),
      descripcion: req.body?.descripcion ?? null
    };

    const { isValid, errors } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (update)', errors });

    const Params = BuildParams([
      { name: 'categoria_id',     type: sql.Int,           value: Body.categoria_id },
      { name: 'nombre_categoria', type: sql.NVarChar(50),  value: Body.nombre_categoria },
      { name: 'descripcion',      type: sql.NVarChar(255), value: Body.descripcion }
    ]);

    await db.executeProc('categorias_update', Params);
    return res.status(200).json({ success: true, message: 'Categoría actualizada correctamente' });
  } catch (err) {
    console.error('categorias_update error:', err);
    return res.status(500).json({ success: false, message: 'Error al actualizar la categoría' });
  }
});

/* ============================================================================
   POST /categorias/delete   -> SP: categorias_delete
============================================================================ */
CategoriasRouter.post('/delete', requireAdmin, async (req, res) => {
  try {
    const Body = { categoria_id: Number(req.body.categoria_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (delete)', errors });

    const Params = BuildParams([{ name: 'categoria_id', type: sql.Int, value: Body.categoria_id }]);
    await db.executeProc('categorias_delete', Params);

    return res.status(200).json({ success: true, message: 'Categoría eliminada correctamente' });
  } catch (err) {
    console.error('categorias_delete error:', err);
    return res.status(500).json({ success: false, message: 'Error al eliminar la categoría' });
  }
});

module.exports = CategoriasRouter;
