// Server/routes/reportesRoute.js
'use strict';

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const { requireAdmin } = require('../routes/authRoute.js');

const {
  VentasMensualRules,
  TopVentasRules,
  ClientesFrecuenciaRules
} = require('../Validators/Rulesets/reportes.js');

const ReportesRouter = express.Router();

const BuildParams = (entries=[]) =>
  entries.reduce((o, e) => (o[e.name] = { type: e.type, value: e.value }, o), {});

const parseDate = (v) => {
  if (v == null) return null;
  const d = new Date(String(v).trim());
  return Number.isNaN(d.getTime()) ? null : d;
};

function ensureRangoOK(desde, hasta) {
  if (desde && hasta && desde > hasta) {
    const e = new Error('Rango de fechas inválido: "desde" no puede ser mayor que "hasta"');
    e.status = 400;
    throw e;
  }
}

/* ============================================================================
   GET /reportes/ventas_mensual_pivot?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   SP: reporte_ventas_mensual_pivot(@desde DATE = NULL, @hasta DATE = NULL)
   ============================================================================ */
ReportesRouter.get('/ventas_mensual_pivot', requireAdmin, async (req, res) => {
  try {
    const Body = { desde: req.query.desde ?? null, hasta: req.query.hasta ?? null };
    const { isValid, errors } = await ValidationService.validateData(Body, VentasMensualRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos', errors });

    const fDesde = parseDate(Body.desde);
    const fHasta = parseDate(Body.hasta);
    ensureRangoOK(fDesde, fHasta);

    const params = BuildParams([
      ...(fDesde ? [{ name: 'desde', type: sql.Date, value: fDesde }] : []),
      ...(fHasta ? [{ name: 'hasta', type: sql.Date, value: fHasta }] : []),
    ]);

    const data = await db.executeProc('reporte_ventas_mensual_pivot', params);
    return res.status(200).json({ success:true, message:'Ventas mensuales (pivot)', data });
  } catch (err) {
    console.error('reportes/ventas_mensual_pivot error:', err);
    return res.status(err.status || 500).json({ success:false, message: err.message || 'Error al obtener reporte' });
  }
});

/* ============================================================================
   GET /reportes/top_ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&top=10
   SP: reporte_top_ventas(@desde DATE, @hasta DATE, @top INT = 10)
   ============================================================================ */
ReportesRouter.get('/top_ventas', requireAdmin, async (req, res) => {
  try {
    const Body = {
      desde: req.query.desde,
      hasta: req.query.hasta,
      top:   req.query.top == null ? undefined : Number(req.query.top)
    };
    const { isValid, errors } = await ValidationService.validateData(Body, TopVentasRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos', errors });

    const fDesde = parseDate(Body.desde);
    const fHasta = parseDate(Body.hasta);
    ensureRangoOK(fDesde, fHasta);

    const params = BuildParams([
      { name: 'desde', type: sql.Date, value: fDesde },
      { name: 'hasta', type: sql.Date, value: fHasta },
      { name: 'top',   type: sql.Int,  value: Body.top ?? 10 }
    ]);

    const data = await db.executeProc('reporte_top_ventas', params);
    return res.status(200).json({ success:true, message:'Top productos por ventas', data });
  } catch (err) {
    console.error('reportes/top_ventas error:', err);
    return res.status(err.status || 500).json({ success:false, message: err.message || 'Error al obtener reporte' });
  }
});

/* ============================================================================
   GET /reportes/clientes_frecuencia_compra?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   SP: clientes_frecuencia_compra(@desde DATE, @hasta DATE)
   ============================================================================ */
ReportesRouter.get('/clientes_frecuencia_compra', requireAdmin, async (req, res) => {
  try {
    const Body = { desde: req.query.desde, hasta: req.query.hasta };
    const { isValid, errors } = await ValidationService.validateData(Body, ClientesFrecuenciaRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos', errors });

    const fDesde = parseDate(Body.desde);
    const fHasta = parseDate(Body.hasta);
    ensureRangoOK(fDesde, fHasta);

    const params = BuildParams([
      { name: 'desde', type: sql.Date, value: fDesde },
      { name: 'hasta', type: sql.Date, value: fHasta }
    ]);

    const data = await db.executeProc('clientes_frecuencia_compra', params);
    return res.status(200).json({ success:true, message:'Clientes por frecuencia de compra', data });
  } catch (err) {
    console.error('reportes/clientes_frecuencia_compra error:', err);
    return res.status(err.status || 500).json({ success:false, message: err.message || 'Error al obtener reporte' });
  }
});

module.exports = ReportesRouter;
