// Server/routes/productosRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js'); // ajusta si difiere
const ValidationService = require('../validatorService');
const { InsertRules, UpdateRules, DeleteRules } = require('../Validators/Rulesets/productos');
const { requireAdmin } = require('./auth.routes.js'); // asegúrate de exportarlo

const ProductosRouter = express.Router();

// Helper { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Mapear códigos SQL → HTTP
function MapSqlError(err) {
  if (!err || typeof err.number !== 'number') return null;
  switch (err.number) {
    case 52001: return { code: 404, message: 'La categoría especificada no existe' }; // insert
    case 52002: return { code: 404, message: 'El producto especificado no existe' };  // update
    case 52003: return { code: 404, message: 'La categoría especificada no existe' }; // update
    case 52004: return { code: 404, message: 'El producto especificado no existe' };  // delete
    default: return null;
  }
}

/* ============================================================================
   GET /productos/get_all  -> SP: productos_get_all
============================================================================ */
ProductosRouter.get('/get_all', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('productos_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos obtenidos' : 'Sin productos',
      data
    });
  } catch (err) {
    console.error('productos_get_all error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener productos',
      data: []
    });
  }
});

/* ============================================================================
   POST /productos/insert  -> SP: productos_insert
============================================================================ */
ProductosRouter.post('/insert', requireAdmin, async (req, res) => {
  try {
    // Coerciones numéricas (ValidationService exige number real)
    const Body = {
      ...req.body,
      precio_unitario: Number(req.body.precio_unitario),
      stock: Number(req.body.stock),
      categoria_id: Number(req.body.categoria_id)
    };
    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (insert)', data: [] });
    }

    const Params = BuildParams([
      { name: 'nombre_producto', type: sql.NVarChar(50),  value: Body.nombre_producto },
      { name: 'descripcion',     type: sql.NVarChar(150), value: Body.descripcion ?? null },
      { name: 'precio_unitario', type: sql.Decimal(10,2), value: Body.precio_unitario },
      { name: 'stock',           type: sql.Int,           value: Body.stock },
      { name: 'categoria_id',    type: sql.Int,           value: Body.categoria_id },
      { name: 'estado_producto', type: sql.NVarChar(20),  value: Body.estado_producto }
    ]);

    await db.executeProc('productos_insert', Params);
    return res.status(201).json({ success: true, message: 'Producto creado correctamente', data: [] });
  } catch (err) {
    console.error('productos_insert error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al crear el producto', data: [] });
  }
});

/* ============================================================================
   POST /productos/update  -> SP: productos_update
============================================================================ */
ProductosRouter.post('/update', requireAdmin, async (req, res) => {
  try {
    const Body = {
      ...req.body,
      precio_unitario: Number(req.body.precio_unitario),
      stock: Number(req.body.stock),
      categoria_id: Number(req.body.categoria_id)
    };
    const { isValid } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (update)', data: [] });
    }

    const Params = BuildParams([
      { name: 'producto_id',     type: sql.NVarChar(20),  value: Body.producto_id },
      { name: 'nombre_producto', type: sql.NVarChar(50),  value: Body.nombre_producto },
      { name: 'descripcion',     type: sql.NVarChar(150), value: Body.descripcion ?? null },
      { name: 'precio_unitario', type: sql.Decimal(10,2), value: Body.precio_unitario },
      { name: 'stock',           type: sql.Int,           value: Body.stock },
      { name: 'categoria_id',    type: sql.Int,           value: Body.categoria_id },
      { name: 'estado_producto', type: sql.NVarChar(20),  value: Body.estado_producto }
    ]);

    await db.executeProc('productos_update', Params);
    return res.status(200).json({ success: true, message: 'Producto actualizado correctamente', data: [] });
  } catch (err) {
    console.error('productos_update error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al actualizar el producto', data: [] });
  }
});

/* ============================================================================
   POST /productos/delete  -> SP: productos_delete
============================================================================ */
ProductosRouter.post('/delete', requireAdmin, async (req, res) => {
  try {
    const Body = { producto_id: req.body.producto_id };
    const { isValid } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (delete)', data: [] });
    }

    const Params = BuildParams([
      { name: 'producto_id', type: sql.NVarChar(20), value: Body.producto_id }
    ]);

    await db.executeProc('productos_delete', Params);
    return res.status(200).json({ success: true, message: 'Producto eliminado correctamente', data: [] });
  } catch (err) {
    console.error('productos_delete error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al eliminar el producto', data: [] });
  }
});

module.exports = ProductosRouter;
