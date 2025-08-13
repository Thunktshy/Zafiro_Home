// Server/routes/reportesRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const { requireAdmin } = require('./authRoute.js');

const {
  PivotRules,
  TopVentasRules,
  FrecuenciaRules,
  HistorialClienteRules
} = require('../Validators/Rulesets/reportes.js');

const Router = express.Router();
const BuildParams = (arr) => arr.reduce((o, e) => (o[e.name] = { type: e.type, value: e.value }, o), {});
const parseDate = (v) => { const d = new Date(String(v||'').trim()); return isNaN(d) ? null : d; };

/* =======================
   PIVOT mensual
   GET /reportes/ventas_mensual_pivot?desde=...&hasta=...
   ======================= */
Router.get('/ventas_mensual_pivot', requireAdmin, async (req, res) => {
  try {
    const Body = { desde: req.query.desde, hasta: req.query.hasta };
    const { isValid, errors } = await ValidationService.validateData(Body, PivotRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (pivot)', errors });

    const d = parseDate(Body.desde), h = parseDate(Body.hasta);
    if (!d || !h) return res.status(400).json({ success:false, message:'Fechas inválidas' });

    const Params = BuildParams([
      { name:'desde', type: sql.DateTime, value: d },
      { name:'hasta', type: sql.DateTime, value: h }
    ]);
    const data = await db.executeProc('reporte_ventas_mensual_pivot', Params);
    return res.status(200).json({ success:true, message:'Pivot mensual', data });
  } catch (err) {
    console.error('ventas_mensual_pivot error:', err);
    return res.status(500).json({ success:false, message:'Error al generar pivot', data: [] });
  }
});

/* =======================
   Top ventas (ranking)
   GET /reportes/top_ventas?desde=...&hasta=...&limit=10
   ======================= */
Router.get('/top_ventas', requireAdmin, async (req, res) => {
  try {
    const Body = { desde:req.query.desde, hasta:req.query.hasta, limit:Number(req.query.limit ?? 10) };
    const { isValid, errors } = await ValidationService.validateData(Body, TopVentasRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (top_ventas)', errors });

    const d = parseDate(Body.desde), h = parseDate(Body.hasta);
    if (!d || !h) return res.status(400).json({ success:false, message:'Fechas inválidas' });

    const Params = BuildParams([
      { name:'desde', type: sql.DateTime, value: d },
      { name:'hasta', type: sql.DateTime, value: h },
      { name:'limit', type: sql.Int,      value: Body.limit }
    ]);
    const data = await db.executeProc('reporte_top_ventas', Params);
    return res.status(200).json({ success:true, message:'Top ventas', data });
  } catch (err) {
    console.error('top_ventas error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener top ventas', data: [] });
  }
});

/* =======================
   Frecuencia de compra (CASE)
   GET /reportes/clientes_frecuencia?desde=...&hasta=...
   ======================= */
Router.get('/clientes_frecuencia', requireAdmin, async (req, res) => {
  try {
    const Body = { desde:req.query.desde, hasta:req.query.hasta };
    const { isValid, errors } = await ValidationService.validateData(Body, FrecuenciaRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (clientes_frecuencia)', errors });

    const d = parseDate(Body.desde), h = parseDate(Body.hasta);
    if (!d || !h) return res.status(400).json({ success:false, message:'Fechas inválidas' });

    const Params = BuildParams([
      { name:'desde', type: sql.DateTime, value: d },
      { name:'hasta', type: sql.DateTime, value: h }
    ]);
    const data = await db.executeProc('clientes_frecuencia_compra', Params);
    return res.status(200).json({ success:true, message:'Frecuencia de compra', data });
  } catch (err) {
    console.error('clientes_frecuencia error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener frecuencia', data: [] });
  }
});

/* =======================
   Historial por cliente (JOINs)
   GET /reportes/historial_cliente/:cliente_id?desde=...&hasta=...
   ======================= */
Router.get('/historial_cliente/:cliente_id', requireAdmin, async (req, res) => {
  try {
    const Body = { cliente_id: String(req.params.cliente_id||'').trim(), desde:req.query.desde, hasta:req.query.hasta };
    const { isValid, errors } = await ValidationService.validateData(Body, HistorialClienteRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (historial_cliente)', errors });

    const d = parseDate(Body.desde), h = parseDate(Body.hasta);
    if (!d || !h) return res.status(400).json({ success:false, message:'Fechas inválidas' });

    const Params = BuildParams([
      { name:'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id },
      { name:'desde',      type: sql.DateTime,     value: d },
      { name:'hasta',      type: sql.DateTime,     value: h }
    ]);
    const data = await db.executeProc('historial_compras_por_cliente', Params);
    return res.status(200).json({ success:true, message:'Historial del cliente', data });
  } catch (err) {
    console.error('historial_cliente error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener historial', data: [] });
  }
});

module.exports = Router;
