// Server/routes/productosRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const {
  InsertRules, UpdateRules, DeleteRules,
  GetByIdRules, GetByNameRules, GetByCategoriaRules,
  SoftDeleteRules, RestoreRules
} = require('../Validators/Rulesets/productos.js');
const { requireAdmin } = require('./authRoute.js');

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
    case 52005: return { code: 404, message: 'El producto especificado no existe' };  // soft_delete
    case 52006: return { code: 404, message: 'El producto especificado no existe' };  // restore
    default: return null;
  }
}

/* ============================================================================
   GET /productos/get_all  -> SP: productos_get_all
============================================================================ */
ProductosRouter.get('/get_all', requireAdmin ,async (_req, res) => {
  try {
    const data = await db.executeProc('productos_get_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos obtenidos' : 'Sin productos',
      data
    });
  } catch (err) {
    console.error('productos_get_all error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener productos', data: [] });
  }
});

/* ============================================================================
   GET /productos/get_list  -> SP: productos_get_list
============================================================================ */
ProductosRouter.get('/get_list', async (_req, res) => {
  try {
    const data = await db.executeProc('productos_get_list', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Lista de productos obtenida' : 'Sin productos',
      data
    });
  } catch (err) {
    console.error('productos_get_list error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener la lista de productos', data: [] });
  }
});

/* ============================================================================
   GET /productos/by_id/:id  -> SP: productos_get_by_id
   (El SP admite 'prd-123' o '123' y normaliza) 
============================================================================ */
ProductosRouter.get('/by_id/:id', async (req, res) => {
  try {
    const Body = { id: String(req.params.id || '').trim() };
    const { isValid, errors } = await ValidationService.validateData(Body, GetByIdRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_id)', errors });

    const Params = BuildParams([{ name: 'id', type: sql.NVarChar(20), value: Body.id }]);
    const data = await db.executeProc('productos_get_by_id', Params);
    if (!data.length) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

    return res.status(200).json({ success: true, message: 'Producto obtenido', data: data[0] });
  } catch (err) {
    console.error('productos_get_by_id error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener el producto' });
  }
});

/* ============================================================================
   GET /productos/by_name?nombre=...  -> SP: productos_get_by_name
============================================================================ */
ProductosRouter.get('/by_name', async (req, res) => {
  try {
    const Body = { nombre: String(req.query.nombre || '').trim() };
    const { isValid, errors } = await ValidationService.validateData(Body, GetByNameRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_name)', errors });

    const Params = BuildParams([{ name: 'nombre', type: sql.NVarChar(50), value: Body.nombre }]);
    const data = await db.executeProc('productos_get_by_name', Params);
    return res.status(200).json({ success: true, message: 'Búsqueda por nombre', data });
  } catch (err) {
    console.error('productos_get_by_name error:', err);
    return res.status(500).json({ success: false, message: 'Error al buscar por nombre', data: [] });
  }
});

/* ============================================================================
   GET /productos/by_categoria/:categoria_id  -> SP: productos_get_by_categoria
============================================================================ */
ProductosRouter.get('/by_categoria/:categoria_id', async (req, res) => {
  try {
    const Body = { categoria_id: Number(req.params.categoria_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, GetByCategoriaRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_categoria)', errors });

    const Params = BuildParams([{ name: 'categoria_id', type: sql.Int, value: Body.categoria_id }]);
    const data = await db.executeProc('productos_get_by_categoria', Params);
    return res.status(200).json({ success: true, message: 'Productos por categoría', data });
  } catch (err) {
    console.error('productos_get_by_categoria error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener por categoría', data: [] });
  }
});

/* ============================================================================
   POST /productos/insert  -> SP: productos_insert
============================================================================ */
ProductosRouter.post('/insert', requireAdmin, async (req, res) => {
  try {
    const Body = {
      nombre_producto: (req.body?.nombre_producto || '').trim(),
      descripcion: req.body?.descripcion ?? null,
      precio_unitario: Number(req.body.precio_unitario),
      stock: Number(req.body.stock),
      categoria_id: Number(req.body.categoria_id),
      estado_producto: (req.body?.estado_producto || '').trim()
    };

    const { isValid, errors } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (insert)', errors });

    const Params = BuildParams([
      { name: 'nombre_producto', type: sql.NVarChar(50),  value: Body.nombre_producto },
      { name: 'descripcion',     type: sql.NVarChar(150), value: Body.descripcion },
      { name: 'precio_unitario', type: sql.Decimal(10,2), value: Body.precio_unitario },
      { name: 'stock',           type: sql.Int,           value: Body.stock },
      { name: 'categoria_id',    type: sql.Int,           value: Body.categoria_id },
      { name: 'estado_producto', type: sql.NVarChar(20),  value: Body.estado_producto || 'activo' }
    ]);

    await db.executeProc('productos_insert', Params);
    return res.status(201).json({ success: true, message: 'Producto creado correctamente' });
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
      producto_id: (req.body?.producto_id || '').trim(),
      nombre_producto: (req.body?.nombre_producto || '').trim(),
      descripcion: req.body?.descripcion ?? null,
      precio_unitario: Number(req.body.precio_unitario),
      stock: Number(req.body.stock),
      categoria_id: Number(req.body.categoria_id),
      estado_producto: (req.body?.estado_producto || '').trim()
    };

    const { isValid, errors } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (update)', errors });

    const Params = BuildParams([
      { name: 'producto_id',     type: sql.NVarChar(20),  value: Body.producto_id },
      { name: 'nombre_producto', type: sql.NVarChar(50),  value: Body.nombre_producto },
      { name: 'descripcion',     type: sql.NVarChar(150), value: Body.descripcion },
      { name: 'precio_unitario', type: sql.Decimal(10,2), value: Body.precio_unitario },
      { name: 'stock',           type: sql.Int,           value: Body.stock },
      { name: 'categoria_id',    type: sql.Int,           value: Body.categoria_id },
      { name: 'estado_producto', type: sql.NVarChar(20),  value: Body.estado_producto }
    ]);

    await db.executeProc('productos_update', Params);
    return res.status(200).json({ success: true, message: 'Producto actualizado correctamente' });
  } catch (err) {
    console.error('productos_update error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al actualizar el producto', data: [] });
  }
});

/* ============================================================================
   POST /productos/delete  -> SP: productos_delete (hard delete)
============================================================================ */
ProductosRouter.post('/delete', requireAdmin, async (req, res) => {
  try {
    const Body = { producto_id: (req.body?.producto_id || '').trim() };
    const { isValid, errors } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (delete)', errors });

    const Params = BuildParams([{ name: 'producto_id', type: sql.NVarChar(20), value: Body.producto_id }]);
    await db.executeProc('productos_delete', Params);
    return res.status(200).json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (err) {
    console.error('productos_delete error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al eliminar el producto', data: [] });
  }
});

/* ============================================================================
   POST /productos/soft_delete  -> SP: productos_soft_delete (estado → inactivo)
============================================================================ */
ProductosRouter.post('/soft_delete', requireAdmin, async (req, res) => {
  try {
    const Body = { id: (req.body?.id || '').trim() };
    const { isValid, errors } = await ValidationService.validateData(Body, SoftDeleteRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (soft_delete)', errors });

    const Params = BuildParams([{ name: 'id', type: sql.NVarChar(20), value: Body.id }]);
    await db.executeProc('productos_soft_delete', Params);
    return res.status(200).json({ success: true, message: 'Producto desactivado' });
  } catch (err) {
    console.error('productos_soft_delete error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al desactivar el producto', data: [] });
  }
});

/* ============================================================================
   POST /productos/restore  -> SP: productos_restore (estado → activo)
============================================================================ */
ProductosRouter.post('/restore', requireAdmin, async (req, res) => {
  try {
    const Body = { id: (req.body?.id || '').trim() };
    const { isValid, errors } = await ValidationService.validateData(Body, RestoreRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (restore)', errors });

    const Params = BuildParams([{ name: 'id', type: sql.NVarChar(20), value: Body.id }]);
    await db.executeProc('productos_restore', Params);
    return res.status(200).json({ success: true, message: 'Producto reactivado' });
  } catch (err) {
    console.error('productos_restore error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al reactivar el producto', data: [] });
  }
});

module.exports = ProductosRouter;
