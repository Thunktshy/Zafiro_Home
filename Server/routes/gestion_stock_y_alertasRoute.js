// Server/routes/gestion_stock_y_alertasRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const { requireAdmin } = require('./authRoute.js');

const {
  StockAddRules,
  StockReduceRules,
  GenerarAlertasRules,
  LogByProductoRules,
  LogByCategoriaRules,
  LogByRangoRules,
  LogByProductoRangoRules,
  LogByCategoriaRangoRules,
  PreciosIncrementarRules,
  PreciosReducirRules,
  PreciosDescuentoRules
} = require('../Validators/Rulesets/gestion_stock_y_alertas.js');

const Router = express.Router();

// Helper params { name, type, value }[] -> dict {name: {type, value}}
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Mapear errores SQL -> HTTP
function MapSqlError(err) {
  if (!err || typeof err.number !== 'number') return null;
  const map = {
    52007: { code: 400, message: 'Cantidad inválida (debe ser > 0)' }, // stock agregar/reducir
    52008: { code: 404, message: 'El producto no existe' },            // stock
    52021: { code: 400, message: 'Monto inválido (debe ser > 0)' },    // precios incrementar
    52022: { code: 400, message: 'Monto inválido (debe ser > 0)' },    // precios reducir
    52023: { code: 400, message: 'Porcentaje inválido (0 < % < 100)' } // descuento
  };
  return map[err.number] || null;
}

// Utilidad simple para validar fechas en query
function parseDateOrNull(s) {
  const d = new Date(String(s || '').trim());
  return isNaN(d.getTime()) ? null : d;
}

/* ============================================================================
   STOCK
   POST /gestion_stock_y_alertas/stock/agregar    -> SP: productos_stock_agregar
   POST /gestion_stock_y_alertas/stock/reducir    -> SP: productos_stock_reducir
============================================================================ */
Router.post('/stock/agregar', requireAdmin, async (req, res) => {
  try {
    const Body = {
      producto_id: String(req.body?.producto_id || '').trim(),
      cantidad: Number(req.body?.cantidad)
    };
    const { isValid, errors } = await ValidationService.validateData(Body, StockAddRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (stock/agregar)', errors });

    const Params = BuildParams([
      { name: 'producto_id', type: sql.NVarChar(20), value: Body.producto_id },
      { name: 'cantidad',    type: sql.Int,          value: Body.cantidad }
    ]);
    const data = await db.executeProc('productos_stock_agregar', Params);
    return res.status(200).json({ success: true, message: 'Stock agregado', data });
  } catch (err) {
    console.error('stock/agregar error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al agregar stock', data: [] });
  }
});

Router.post('/stock/reducir', requireAdmin, async (req, res) => {
  try {
    const Body = {
      producto_id: String(req.body?.producto_id || '').trim(),
      cantidad: Number(req.body?.cantidad)
    };
    const { isValid, errors } = await ValidationService.validateData(Body, StockReduceRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (stock/reducir)', errors });

    const Params = BuildParams([
      { name: 'producto_id', type: sql.NVarChar(20), value: Body.producto_id },
      { name: 'cantidad',    type: sql.Int,          value: Body.cantidad }
    ]);
    const data = await db.executeProc('productos_stock_reducir', Params);
    return res.status(200).json({ success: true, message: 'Stock reducido', data });
  } catch (err) {
    console.error('stock/reducir error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al reducir stock', data: [] });
  }
});

/* ============================================================================
   ALERTAS (opcional) — ejecuta SP de barrido si lo deseas
   POST /gestion_stock_y_alertas/alertas/generar  -> SP: alertas_inventario_generar
============================================================================ */
Router.post('/alertas/generar', requireAdmin, async (req, res) => {
  try {
    const Body = {
      umbral_global: Number(req.body?.umbral_global ?? 5),
      solo_activos: Number(req.body?.solo_activos ?? 1) ? 1 : 0
    };
    const { isValid, errors } = await ValidationService.validateData(Body, GenerarAlertasRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (alertas/generar)', errors });

    const Params = BuildParams([
      { name: 'umbral_global', type: sql.Int, value: Body.umbral_global },
      { name: 'solo_activos',  type: sql.Bit, value: Body.solo_activos }
    ]);
    await db.executeProc('alertas_inventario_generar', Params);
    return res.status(200).json({ success: true, message: 'Alertas generadas (si aplicaba)' });
  } catch (err) {
    console.error('alertas/generar error:', err);
    return res.status(500).json({ success: false, message: 'Error al generar alertas', data: [] });
  }
});

/* ============================================================================
   LOGS de productos_sin_stock_log
   GET /gestion_stock_y_alertas/logs/all
   GET /gestion_stock_y_alertas/logs/by_producto/:producto_id
   GET /gestion_stock_y_alertas/logs/by_categoria/:categoria_id
   GET /gestion_stock_y_alertas/logs/by_rango?desde=...&hasta=...
   GET /gestion_stock_y_alertas/logs/by_producto_rango/:producto_id?desde=...&hasta=...
   GET /gestion_stock_y_alertas/logs/by_categoria_rango?categoria_id=...&desde=...&hasta=...
============================================================================ */
Router.get('/logs/all', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('productos_sin_stock_log_get_all', {});
    return res.status(200).json({ success: true, message: 'Logs obtenidos', data });
  } catch (err) {
    console.error('logs/all error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener logs', data: [] });
  }
});

Router.get('/logs/by_producto/:producto_id', requireAdmin, async (req, res) => {
  try {
    const Body = { producto_id: String(req.params?.producto_id || '').trim() };
    const { isValid, errors } = await ValidationService.validateData(Body, LogByProductoRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_producto)', errors });

    const Params = BuildParams([{ name: 'producto_id', type: sql.NVarChar(20), value: Body.producto_id }]);
    const data = await db.executeProc('productos_sin_stock_log_get_by_producto', Params);
    return res.status(200).json({ success: true, message: 'Logs por producto', data });
  } catch (err) {
    console.error('logs/by_producto error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener logs', data: [] });
  }
});

Router.get('/logs/by_categoria/:categoria_id', requireAdmin, async (req, res) => {
  try {
    const Body = { categoria_id: Number(req.params?.categoria_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, LogByCategoriaRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_categoria)', errors });

    const Params = BuildParams([{ name: 'categoria_id', type: sql.Int, value: Body.categoria_id }]);
    const data = await db.executeProc('productos_sin_stock_log_get_by_categoria', Params);
    return res.status(200).json({ success: true, message: 'Logs por categoría', data });
  } catch (err) {
    console.error('logs/by_categoria error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener logs', data: [] });
  }
});

Router.get('/logs/by_rango', requireAdmin, async (req, res) => {
  try {
    const Body = { desde: req.query.desde, hasta: req.query.hasta };
    const { isValid, errors } = await ValidationService.validateData(Body, LogByRangoRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_rango)', errors });

    const d = parseDateOrNull(Body.desde), h = parseDateOrNull(Body.hasta);
    if (!d || !h) return res.status(400).json({ success: false, message: 'Fechas inválidas' });

    const Params = BuildParams([
      { name: 'desde', type: sql.DateTime, value: d },
      { name: 'hasta', type: sql.DateTime, value: h }
    ]);
    const data = await db.executeProc('productos_sin_stock_log_get_by_rango', Params);
    return res.status(200).json({ success: true, message: 'Logs por rango', data });
  } catch (err) {
    console.error('logs/by_rango error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener logs', data: [] });
  }
});

Router.get('/logs/by_producto_rango/:producto_id', requireAdmin, async (req, res) => {
  try {
    const Body = {
      producto_id: String(req.params?.producto_id || '').trim(),
      desde: req.query.desde, hasta: req.query.hasta
    };
    const { isValid, errors } = await ValidationService.validateData(Body, LogByProductoRangoRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_producto_rango)', errors });

    const d = parseDateOrNull(Body.desde), h = parseDateOrNull(Body.hasta);
    if (!d || !h) return res.status(400).json({ success: false, message: 'Fechas inválidas' });

    const Params = BuildParams([
      { name: 'producto_id', type: sql.NVarChar(20), value: Body.producto_id },
      { name: 'desde',       type: sql.DateTime,     value: d },
      { name: 'hasta',       type: sql.DateTime,     value: h }
    ]);
    const data = await db.executeProc('productos_sin_stock_log_get_by_producto_rango', Params);
    return res.status(200).json({ success: true, message: 'Logs por producto y rango', data });
  } catch (err) {
    console.error('logs/by_producto_rango error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener logs', data: [] });
  }
});

Router.get('/logs/by_categoria_rango', requireAdmin, async (req, res) => {
  try {
    const Body = { categoria_id: Number(req.query.categoria_id), desde: req.query.desde, hasta: req.query.hasta };
    const { isValid, errors } = await ValidationService.validateData(Body, LogByCategoriaRangoRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (by_categoria_rango)', errors });

    const d = parseDateOrNull(Body.desde), h = parseDateOrNull(Body.hasta);
    if (!d || !h) return res.status(400).json({ success: false, message: 'Fechas inválidas' });

    const Params = BuildParams([
      { name: 'categoria_id', type: sql.Int,       value: Body.categoria_id },
      { name: 'desde',        type: sql.DateTime,  value: d },
      { name: 'hasta',        type: sql.DateTime,  value: h }
    ]);
    const data = await db.executeProc('productos_sin_stock_log_get_by_categoria_rango', Params);
    return res.status(200).json({ success: true, message: 'Logs por categoría y rango', data });
  } catch (err) {
    console.error('logs/by_categoria_rango error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener logs', data: [] });
  }
});

/* ============================================================================
   PRECIOS MASIVOS
   POST /gestion_stock_y_alertas/precios/incrementar  -> productos_precio_incrementar
   POST /gestion_stock_y_alertas/precios/reducir      -> productos_precio_reducir
   POST /gestion_stock_y_alertas/precios/descuento    -> productos_agregar_descuento
============================================================================ */
Router.post('/precios/incrementar', requireAdmin, async (req, res) => {
  try {
    const Body = {
      monto: Number(req.body?.monto),
      categoria_id: req.body?.categoria_id == null ? null : Number(req.body?.categoria_id),
      solo_activos: Number(req.body?.solo_activos ?? 1) ? 1 : 0
    };
    const { isValid, errors } = await ValidationService.validateData(Body, PreciosIncrementarRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (precios/incrementar)', errors });

    const Params = BuildParams([
      { name: 'monto',        type: sql.Decimal(10, 2), value: Body.monto },
      { name: 'categoria_id', type: sql.Int,            value: Body.categoria_id },
      { name: 'solo_activos', type: sql.Bit,            value: Body.solo_activos }
    ]);
    await db.executeProc('productos_precio_incrementar', Params);
    return res.status(200).json({ success: true, message: 'Precios incrementados' });
  } catch (err) {
    console.error('precios/incrementar error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al incrementar precios', data: [] });
  }
});

Router.post('/precios/reducir', requireAdmin, async (req, res) => {
  try {
    const Body = {
      monto: Number(req.body?.monto),
      categoria_id: req.body?.categoria_id == null ? null : Number(req.body?.categoria_id),
      solo_activos: Number(req.body?.solo_activos ?? 1) ? 1 : 0
    };
    const { isValid, errors } = await ValidationService.validateData(Body, PreciosReducirRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (precios/reducir)', errors });

    const Params = BuildParams([
      { name: 'monto',        type: sql.Decimal(10, 2), value: Body.monto },
      { name: 'categoria_id', type: sql.Int,            value: Body.categoria_id },
      { name: 'solo_activos', type: sql.Bit,            value: Body.solo_activos }
    ]);
    await db.executeProc('productos_precio_reducir', Params);
    return res.status(200).json({ success: true, message: 'Precios reducidos' });
  } catch (err) {
    console.error('precios/reducir error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al reducir precios', data: [] });
  }
});

Router.post('/precios/descuento', requireAdmin, async (req, res) => {
  try {
    const Body = {
      porcentaje: Number(req.body?.porcentaje),
      categoria_id: req.body?.categoria_id == null ? null : Number(req.body?.categoria_id),
      solo_activos: Number(req.body?.solo_activos ?? 1) ? 1 : 0
    };
    const { isValid, errors } = await ValidationService.validateData(Body, PreciosDescuentoRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (precios/descuento)', errors });

    const Params = BuildParams([
      { name: 'porcentaje',   type: sql.Decimal(5, 2),  value: Body.porcentaje },
      { name: 'categoria_id', type: sql.Int,            value: Body.categoria_id },
      { name: 'solo_activos', type: sql.Bit,            value: Body.solo_activos }
    ]);
    await db.executeProc('productos_agregar_descuento', Params);
    return res.status(200).json({ success: true, message: 'Descuento aplicado' });
  } catch (err) {
    console.error('precios/descuento error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: [] });
    return res.status(500).json({ success: false, message: 'Error al aplicar descuento', data: [] });
  }
});

module.exports = Router;
