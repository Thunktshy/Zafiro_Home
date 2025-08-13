// Server/routes/promocionesRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const { requireAdmin } = require('./authRoute.js');
const { PromosActivasRules } = require('../Validators/Rulesets/promociones.js');

const PromocionesRouter = express.Router();
const BuildParams = (arr) => arr.reduce((o, e) => (o[e.name] = { type: e.type, value: e.value }, o), {});
const parseDate = (v) => { const d = new Date(String(v||'').trim()); return isNaN(d) ? null : d; };

/* =======================
   GET /promociones/activas_por_producto?fecha=YYYY-MM-DD
   ======================= */
PromocionesRouter.get('/activas_por_producto', requireAdmin, async (req, res) => {
  try {
    const Body = { fecha: req.query.fecha ?? null };
    const { isValid, errors } = await ValidationService.validateData(Body, PromosActivasRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (promociones)', errors });

    const f = Body.fecha ? parseDate(Body.fecha) : null;
    const Params = f
      ? BuildParams([{ name:'fecha', type: sql.Date, value: f }])
      : {};

    const data = await db.executeProc('promociones_activas_por_producto', Params);
    return res.status(200).json({ success:true, message:'Promociones activas por producto', data });
  } catch (err) {
    console.error('promociones/activas_por_producto error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener promociones', data: [] });
  }
});

module.exports = Router;
