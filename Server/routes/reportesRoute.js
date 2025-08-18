'use strict';

const express = require('express');
const ReportesRouter = express.Router();
const { db, sql } = require('../../db/dbconnector.js');
const validator = require('../../services/validatorService.js');
const {
  VentasMensualRules,
  TopVentasRules,
  ClientesFrecuenciaRules,
  HistorialClienteRules
} = require('../Validators/Rulesets/reportes.js');

// Si usas auth en estas rutas, mantenlo:
let requireAdmin = (req, res, next) => next(); // no-op por si no lo tienes
try {
  ({ requireAdmin } = require('../routes/authRoute.js'));
} catch { /* opcional */ }

// ————————————————————————————————————————————————————————————————
// Helpers

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const parseISODate = (v) => {
  if (typeof v !== 'string' || !ISO.test(v)) return null;
  // new Date('YYYY-MM-DD') -> fecha local a 00:00:00
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

const endOfDay = (d) => {
  if (!(d instanceof Date) || isNaN(d)) return null;
  const x = new Date(d);
  x.setHours(23, 59, 59, 997);
  return x;
};

const ensureRange = (d, h) => {
  if (d && h && d > h) {
    const e = new Error('Rango inválido: "desde" no puede ser mayor que "hasta"');
    e.status = 400;
    throw e;
  }
};

const BuildParams = (arr = []) =>
  arr.reduce((o, e) => {
    o[e.name] = { type: e.type, value: e.value };
    return o;
  }, {});

// ————————————————————————————————————————————————————————————————
// /reportes/ventas_mensual_pivot?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
ReportesRouter.get('/ventas_mensual_pivot', requireAdmin, async (req, res) => {
  try {
    // 1) valida shape (opcional/ambos válidos)
    const { isValid, errors } = await validator.validateData(req.query, VentasMensualRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos', errors });
    }

    // 2) parsea fechas
    const d = req.query.desde ? parseISODate(req.query.desde) : null;
    const h = req.query.hasta ? endOfDay(parseISODate(req.query.hasta)) : null;
    ensureRange(d, h);

    // 3) llama SP
    const params = BuildParams([
      { name: 'desde', type: sql.DateTime, value: d },
      { name: 'hasta', type: sql.DateTime, value: h },
    ]);
    const data = await db.executeProc('reporte_ventas_mensual_pivot', params);
    res.json({ success: true, message: 'Ventas mensual (pivot)', data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Error' });
  }
});

// ————————————————————————————————————————————————————————————————
// /reportes/top_ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&limit=10
// Acepta alias ?top=10 por retro-compatibilidad
ReportesRouter.get('/top_ventas', requireAdmin, async (req, res) => {
  try {
    // Normalizamos limit/top -> limit
    const rawLimit = (req.query.limit ?? req.query.top);
    if (rawLimit != null && req.query.limit == null) req.query.limit = rawLimit;

    const { isValid, errors } = await validator.validateData(req.query, TopVentasRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos', errors });
    }

    const d = parseISODate(req.query.desde);
    const h = endOfDay(parseISODate(req.query.hasta));
    ensureRange(d, h);

    let n = Number(req.query.limit ?? 10);
    if (!Number.isFinite(n) || n <= 0) n = 10;
    if (n > 100) n = 100;

    const params = BuildParams([
      { name: 'desde', type: sql.DateTime, value: d },
      { name: 'hasta', type: sql.DateTime, value: h },
      { name: 'limit', type: sql.Int,      value: n },
    ]);

    const data = await db.executeProc('reporte_top_ventas', params);
    res.json({ success: true, message: 'Top ventas', data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Error' });
  }
});

// ————————————————————————————————————————————————————————————————
// /reportes/clientes_frecuencia_compra?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
ReportesRouter.get('/clientes_frecuencia_compra', requireAdmin, async (req, res) => {
  try {
    const { isValid, errors } = await validator.validateData(req.query, ClientesFrecuenciaRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos', errors });
    }

    const d = parseISODate(req.query.desde);
    const h = endOfDay(parseISODate(req.query.hasta));
    ensureRange(d, h);

    const params = BuildParams([
      { name: 'desde', type: sql.DateTime, value: d },
      { name: 'hasta', type: sql.DateTime, value: h },
    ]);
    const data = await db.executeProc('clientes_frecuencia_compra', params);
    res.json({ success: true, message: 'Clientes por frecuencia', data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Error' });
  }
});

// ————————————————————————————————————————————————————————————————
// /reportes/historial_cliente?cliente_id=cl-123&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
ReportesRouter.get('/historial_cliente', requireAdmin, async (req, res) => {
  try {
    const { isValid, errors } = await validator.validateData(req.query, HistorialClienteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos', errors });
    }

    // Normaliza prefijo cl-
    let cliente_id = String(req.query.cliente_id).trim();
    if (!cliente_id.startsWith('cl-')) cliente_id = 'cl-' + cliente_id;

    const d = parseISODate(req.query.desde);
    const h = endOfDay(parseISODate(req.query.hasta));
    ensureRange(d, h);

    const params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: cliente_id },
      { name: 'desde',      type: sql.DateTime,     value: d },
      { name: 'hasta',      type: sql.DateTime,     value: h },
    ]);
    const data = await db.executeProc('historial_compras_por_cliente', params);
    res.json({ success: true, message: 'Historial del cliente', data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Error' });
  }
});

module.exports = ReportesRouter;
