'use strict';
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const { requireAdmin } = require('../routes/authRoute.js');
const ReportesRouter = express.Router();

const BuildParams = (arr=[]) => arr.reduce((o, e) => (o[e.name] = { type: e.type, value: e.value }, o), {});
const parseDT = (v) => { if (v==null) return null; const d=new Date(String(v)); return isNaN(d) ? null : d; };
const ensureRange = (d,h) => { if (d && h && d>h) { const e = new Error('Rango inválido'); e.status=400; throw e; } };

// GET /reportes/ventas_mensual_pivot?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
ReportesRouter.get('/ventas_mensual_pivot', requireAdmin, async (req, res) => {
  try {
    const d = parseDT(req.query.desde), h = parseDT(req.query.hasta); ensureRange(d,h);
    const params = BuildParams([
      { name:'desde', type: sql.DateTime2, value: d },
      { name:'hasta', type: sql.DateTime2, value: h },
    ]);
    const data = await db.executeProc('reporte_ventas_mensual_pivot', params);
    res.json({ success:true, message:'Ventas mensual (pivot)', data });
  } catch (err) {
    res.status(err.status || 500).json({ success:false, message: err.message || 'Error' });
  }
});

// GET /reportes/top_ventas?desde=...&hasta=...&limit=10   (acepta también ?top=10)
ReportesRouter.get('/top_ventas', requireAdmin, async (req, res) => {
  try {
    const d = parseDT(req.query.desde), h = parseDT(req.query.hasta); ensureRange(d,h);
    let n = Number(req.query.limit ?? req.query.top ?? 10);
    if (!Number.isFinite(n) || n<=0) n=10; if (n>100) n=100;
    const params = BuildParams([
      { name:'desde', type: sql.DateTime2, value: d },
      { name:'hasta', type: sql.DateTime2, value: h },
      { name:'limit', type: sql.Int,      value: n },
    ]);
    const data = await db.executeProc('reporte_top_ventas', params);
    res.json({ success:true, message:'Top ventas', data });
  } catch (err) {
    res.status(err.status || 500).json({ success:false, message: err.message || 'Error' });
  }
});

// GET /reportes/clientes_frecuencia_compra?desde=...&hasta=...
ReportesRouter.get('/clientes_frecuencia_compra', requireAdmin, async (req, res) => {
  try {
    const d = parseDT(req.query.desde), h = parseDT(req.query.hasta); ensureRange(d,h);
    const params = BuildParams([
      { name:'desde', type: sql.DateTime2, value: d },
      { name:'hasta', type: sql.DateTime2, value: h },
    ]);
    const data = await db.executeProc('clientes_frecuencia_compra', params);
    res.json({ success:true, message:'Clientes por frecuencia', data });
  } catch (err) {
    res.status(err.status || 500).json({ success:false, message: err.message || 'Error' });
  }
});

// GET /reportes/historial_cliente?cliente_id=cl-#|#&desde=...&hasta=...
ReportesRouter.get('/historial_cliente', requireAdmin, async (req, res) => {
  try {
    const cliente_id = String(req.query.cliente_id || '').trim();
    if (!cliente_id) return res.status(400).json({ success:false, message:'cliente_id requerido' });
    const d = parseDT(req.query.desde), h = parseDT(req.query.hasta); ensureRange(d,h);
    const params = BuildParams([
      { name:'cliente_id', type: sql.NVarChar(20), value: cliente_id },
      { name:'desde',      type: sql.DateTime2,    value: d },
      { name:'hasta',      type: sql.DateTime2,    value: h },
    ]);
    const data = await db.executeProc('historial_compras_por_cliente', params);
    res.json({ success:true, message:'Historial del cliente', data });
  } catch (err) {
    res.status(err.status || 500).json({ success:false, message: err.message || 'Error' });
  }
});

module.exports = ReportesRouter;
