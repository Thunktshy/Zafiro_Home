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

// POST /promociones/insert  (crea y aplica promo por CATEGORÍA)
const { PromosActivasRules, PromosCreateRules } = require('../Validators/Rulesets/promociones.js');

PromocionesRouter.post('/insert', requireAdmin, async (req, res) => {
  try {
    //  la BD soporta SOLO por CATEGORÍA 
    const Body = {
      categoria_id: req.body.categoria_id ?? null,
      tipo_descuento: String(req.body.tipo_descuento || '').toLowerCase(), // 'porcentaje' | 'monto'
      valor_descuento: req.body.valor_descuento,
      fecha_inicio: req.body.fecha_inicio,
      fecha_fin: req.body.fecha_fin, // si viene vacío, lo ajustamos a inicio
      solo_activos: req.body.solo_activos ?? 1
    };

    const { isValid, errors } = await ValidationService.validateData(Body, PromosCreateRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (crear promoción)', errors });

    const fIni = parseDate(Body.fecha_inicio);
    let  fFin = parseDate(Body.fecha_fin);
    if (!fFin) fFin = fIni; // si no mandan fin, usamos mismo día

    if (!fIni || !fFin || fFin < fIni) {
      return res.status(400).json({ success:false, message:'Rango de fechas inválido' });
    }

    // Armar parámetros comunes para los SPs
    const BaseParams = BuildParams([
      { name:'categoria_id', type: sql.Int, value: Number(Body.categoria_id) },
      { name:'fecha_inicio', type: sql.Date, value: fIni },
      { name:'fecha_fin',    type: sql.Date, value: fFin },
      { name:'solo_activos', type: sql.Bit,  value: Body.solo_activos ? 1 : 0 },
    ]);

    let data;
    if (Body.tipo_descuento.includes('porc')) {
      data = await db.executeProc('promociones_aplicar_porcentaje', {
        ...BaseParams,
        porcentaje: { type: sql.Decimal(5,2), value: Number(Body.valor_descuento) }
      });
    } else {
      data = await db.executeProc('promociones_aplicar_monto', {
        ...BaseParams,
        monto: { type: sql.Decimal(10,2), value: Number(Body.valor_descuento) }
      });
    }

    return res.status(200).json({ success:true, message:'Promoción aplicada', data });
  } catch (err) {
    console.error('promociones/insert error:', err);
    return res.status(500).json({ success:false, message:'Error al crear/aplicar promoción' });
  }
});


module.exports = PromocionesRouter;
