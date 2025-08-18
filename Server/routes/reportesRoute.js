'use strict';

const express = require('express');
const ReportesRouter = express.Router();
const { db, sql } = require('../../db/dbconnector.js');
const validator = require('../validatorService.js');
const {
  VentasMensualRules,
  TopVentasRules,
  ClientesFrecuenciaRules,
  HistorialClienteRules
} = require('../Validators/Rulesets/reportes.js');

// Si usas auth en estas rutas, mantenlo:
let requireAdmin = (req, res, next) => next();
try {
  ({ requireAdmin } = require('../routes/authRoute.js'));
} catch { /* opcional */ }

// ————————————————————————————————————————————————————————————————
// Helpers: solo validación de formato, sin construir Date ni horas

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valida y devuelve la misma cadena YYYY-MM-DD; null si inválida */
const keepISODate = (v) => (typeof v === 'string' && ISO.test(v)) ? v : null;

/** Compara rango usando orden lexicográfico (YYYY-MM-DD) */
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
    const { isValid, errors } = await validator.validateData(req.query, VentasMensualRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos', errors });
    }

    const d = req.query.desde ? keepISODate(req.query.desde) : null;
    const h = req.query.hasta ? keepISODate(req.query.hasta) : null;
    ensureRange(d, h);

    const params = BuildParams([
      { name: 'desde', type: sql.Date, value: d },
      { name: 'hasta', type: sql.Date, value: h },
    ]);

    const data = await db.executeProc('reporte_ventas_mensual_pivot', params);
    res.json({ success: true, message: 'Ventas mensual (pivot)', data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Error' });
  }
});

// ————————————————————————————————————————————————————————————————
// /reportes/top_ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&limit=10
ReportesRouter.get('/top_ventas', requireAdmin, async (req, res) => {
  try {
    const rawLimit = (req.query.limit ?? req.query.top);
    if (rawLimit != null && req.query.limit == null) req.query.limit = rawLimit;

    const { isValid, errors } = await validator.validateData(req.query, TopVentasRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos', errors });
    }

    const d = keepISODate(req.query.desde);
    const h = keepISODate(req.query.hasta);
    ensureRange(d, h);

    let n = Number(req.query.limit ?? 10);
    if (!Number.isFinite(n) || n <= 0) n = 10;
    if (n > 100) n = 100;

    const params = BuildParams([
      { name: 'desde', type: sql.Date, value: d },
      { name: 'hasta', type: sql.Date, value: h },
      { name: 'limit', type: sql.Int,  value: n },
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

    const d = keepISODate(req.query.desde);
    const h = keepISODate(req.query.hasta);
    ensureRange(d, h);

    const params = BuildParams([
      { name: 'desde', type: sql.Date, value: d },
      { name: 'hasta', type: sql.Date, value: h },
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

    let cliente_id = String(req.query.cliente_id).trim();
    if (!cliente_id.startsWith('cl-')) cliente_id = 'cl-' + cliente_id;

    const d = keepISODate(req.query.desde);
    const h = keepISODate(req.query.hasta);
    ensureRange(d, h);

    const params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: cliente_id },
      { name: 'desde',      type: sql.Date,         value: d },
      { name: 'hasta',      type: sql.Date,         value: h },
    ]);

    const data = await db.executeProc('historial_compras_por_cliente', params);
    res.json({ success: true, message: 'Historial del cliente', data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Error' });
  }
});

module.exports = ReportesRouter;
