// Server/routes/reportesRoute.js
'use strict';

const express = require('express');

// Usa la ruta real de tu conector.
// Si tu archivo es "../../db/dbconnector.js" déjalo así; si es "../../db/db.js", cámbialo.
const { db, sql } = require('../../db/dbconnector.js');
// const { db, sql } = require('../../db/db.js');

const ValidationService = require('../validatorService.js');
const { requireAdmin } = require('../routes/authRoute.js');

const {
  VentasMensualRules,
  TopVentasRules,
  ClientesFrecuenciaRules
  // Si tienes reglas para historial, impórtalas aquí (p. ej. HistorialClienteRules)
} = require('../Validators/Rulesets/reportes.js');

const ReportesRouter = express.Router();

const BuildParams = (entries = []) =>
  entries.reduce((o, e) => (o[e.name] = { type: e.type, value: e.value }, o), {});

// Acepta "YYYY-MM-DD" o fecha con hora; devuelve Date válido o null.
function parseDateTime(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ensureRangoOK(desde, hasta) {
  if (desde && hasta && desde > hasta) {
    const e = new Error('Rango de fechas inválido: "desde" no puede ser mayor que "hasta"');
    e.status = 400;
    throw e;
  }
}

/* ============================================================================
   GET /reportes/ventas_mensual_pivot?desde=YYYY-MM-DD[THH:mm:ss]&hasta=YYYY-MM-DD[THH:mm:ss]
   SP: reporte_ventas_mensual_pivot(@desde DATETIME = NULL, @hasta DATETIME = NULL)
   ============================================================================ */
ReportesRouter.get('/ventas_mensual_pivot', requireAdmin, async (req, res) => {
  try {
    const Body = { desde: req.query.desde ?? null, hasta: req.query.hasta ?? null };
    const { isValid, errors } = await ValidationService.validateData(Body, VentasMensualRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const fDesde = parseDateTime(Body.desde);
    const fHasta = parseDateTime(Body.hasta);
    ensureRangoOK(fDesde, fHasta);

    const params = BuildParams([
      ...(fDesde ? [{ name: 'desde', type: sql.DateTime2, value: fDesde }] : []),
      ...(fHasta ? [{ name: 'hasta', type: sql.DateTime2, value: fHasta }] : []),
    ]);

    const data = await db.executeProc('reporte_ventas_mensual_pivot', params);
    return res.status(200).json({ success: true, message: 'Ventas mensuales (pivot)', data });
  } catch (err) {
    console.error('reportes/ventas_mensual_pivot error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Error al obtener reporte' });
  }
});

/* ============================================================================
   GET /reportes/top_ventas?desde=...&hasta=...&limit=10
   (Acepta también ?top=10 por compatibilidad)
   SP: reporte_top_ventas(@desde DATETIME, @hasta DATETIME, @limit INT = 10)
   ============================================================================ */
ReportesRouter.get('/top_ventas', requireAdmin, async (req, res) => {
  try {
    // Compat: si llega ?top usa ese valor; preferimos ?limit
    const rawTop = req.query.limit ?? req.query.top;
    const Body = {
      desde: req.query.desde,
      hasta: req.query.hasta,
      // Conservamos "top" para pasar validación existente (TopVentasRules),
      // pero más abajo lo convertimos a "limit" para el SP.
      top: rawTop == null ? undefined : Number(rawTop)
    };

    const { isValid, errors } = await ValidationService.validateData(Body, TopVentasRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const fDesde = parseDateTime(Body.desde);
    const fHasta = parseDateTime(Body.hasta);
    ensureRangoOK(fDesde, fHasta);

    const limitVal = (Number.isFinite(Body.top) && Body.top > 0) ? Body.top : 10;

    const params = BuildParams([
      { name: 'desde', type: sql.DateTime2, value: fDesde },
      { name: 'hasta', type: sql.DateTime2, value: fHasta },
      // 👇 el SP espera @limit (no @top)
      { name: 'limit', type: sql.Int, value: limitVal }
    ]);

    const data = await db.executeProc('reporte_top_ventas', params);
    return res.status(200).json({ success: true, message: 'Top productos por ventas', data });
  } catch (err) {
    console.error('reportes/top_ventas error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Error al obtener reporte' });
  }
});

/* ============================================================================
   GET /reportes/clientes_frecuencia_compra?desde=...&hasta=...
   SP: clientes_frecuencia_compra(@desde DATETIME, @hasta DATETIME)
   ============================================================================ */
ReportesRouter.get('/clientes_frecuencia_compra', requireAdmin, async (req, res) => {
  try {
    const Body = { desde: req.query.desde, hasta: req.query.hasta };
    const { isValid, errors } = await ValidationService.validateData(Body, ClientesFrecuenciaRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos', errors });

    const fDesde = parseDateTime(Body.desde);
    const fHasta = parseDateTime(Body.hasta);
    ensureRangoOK(fDesde, fHasta);

    const params = BuildParams([
      { name: 'desde', type: sql.DateTime2, value: fDesde },
      { name: 'hasta', type: sql.DateTime2, value: fHasta }
    ]);

    const data = await db.executeProc('clientes_frecuencia_compra', params);
    return res.status(200).json({ success: true, message: 'Clientes por frecuencia de compra', data });
  } catch (err) {
    console.error('reportes/clientes_frecuencia_compra error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Error al obtener reporte' });
  }
});

/* ============================================================================
   GET /reportes/historial_cliente?cliente_id=cl-0001&desde=...&hasta=...
   SP: historial_compras_por_cliente(@cliente_id NVARCHAR(..), @desde DATETIME, @hasta DATETIME)
   ============================================================================ */
ReportesRouter.get('/historial_cliente', requireAdmin, async (req, res) => {
  try {
    const Body = {
      cliente_id: (req.query.cliente_id ?? '').toString().trim(),
      desde: req.query.desde,
      hasta: req.query.hasta
    };

    // Validación simple inline (opcional: reemplazar por ValidationService si tienes reglas).
    if (!Body.cliente_id) {
      return res.status(400).json({ success: false, message: 'cliente_id requerido' });
    }

    const fDesde = parseDateTime(Body.desde);
    const fHasta = parseDateTime(Body.hasta);
    ensureRangoOK(fDesde, fHasta);

    const params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(50), value: Body.cliente_id },
      { name: 'desde', type: sql.DateTime2, value: fDesde },
      { name: 'hasta', type: sql.DateTime2, value: fHasta }
    ]);

    const data = await db.executeProc('historial_compras_por_cliente', params);
    return res.status(200).json({ success: true, message: 'Historial de compras por cliente', data });
  } catch (err) {
    console.error('reportes/historial_cliente error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Error al obtener historial' });
  }
});

module.exports = ReportesRouter;
