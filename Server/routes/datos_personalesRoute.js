// Server/routes/datos_personalesRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const {
  InsertRules,
  UpdateRules,
  DeleteRules,
  SelectByClienteRules
} = require('../Validators/Rulesets/datos_personales.js');

const { requireAdmin } = require('./authRoute.js');
const { requireClient } = require('./authRoute.js'); 

const DatosPersonalesRouter = express.Router();

// Helper: { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Mapear números de error SQL de tus SP a HTTP
function MapSqlErrorToHttp(err) {
  // 51010: cliente no existe (insert)
  // 51011: ya existe datos_personales para cliente (insert)
  // 51012: no existe datos_personales (update)
  // 51013: no existe datos_personales (delete)
  if (!err || typeof err.number !== 'number') return null;
  switch (err.number) {
    case 51010: return { code: 404, message: 'El cliente especificado no existe' };
    case 51011: return { code: 409, message: 'Ya existen datos personales para este cliente' };
    case 51012: return { code: 404, message: 'No existen datos personales para este cliente' };
    case 51013: return { code: 404, message: 'No existen datos personales para este cliente' };
    default: return null;
  }
}

/* ============================================================================
   POST /datos_personales/insert  -> SP: datos_personales_insert
============================================================================ */
DatosPersonalesRouter.post('/insert', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (insert)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id',    type: sql.NVarChar(20),  value: Body.cliente_id },
      { name: 'nombre',        type: sql.NVarChar(50),  value: Body.nombre },
      { name: 'apellidos',     type: sql.NVarChar(100), value: Body.apellidos },
      { name: 'telefono',      type: sql.NVarChar(20),  value: Body.telefono ?? null },
      { name: 'direccion',     type: sql.NVarChar(200), value: Body.direccion ?? null },
      { name: 'ciudad',        type: sql.NVarChar(50),  value: Body.ciudad ?? null },
      { name: 'codigo_postal', type: sql.NVarChar(10),  value: Body.codigo_postal ?? null },
      { name: 'pais',          type: sql.NVarChar(50),  value: Body.pais ?? null }
    ]);

    await db.executeProc('datos_personales_insert', Params);
    return res.status(201).json({ success: true, message: 'Datos personales creados correctamente' });
  } catch (Error_) {
    console.error('datos_personales_insert error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al crear datos personales' });
  }
});

/* ============================================================================
   POST /datos_personales/update  -> SP: datos_personales_update
============================================================================ */
DatosPersonalesRouter.post('/update', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (update)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id',    type: sql.NVarChar(20),  value: Body.cliente_id },
      { name: 'nombre',        type: sql.NVarChar(50),  value: Body.nombre },
      { name: 'apellidos',     type: sql.NVarChar(100), value: Body.apellidos },
      { name: 'telefono',      type: sql.NVarChar(20),  value: Body.telefono ?? null },
      { name: 'direccion',     type: sql.NVarChar(200), value: Body.direccion ?? null },
      { name: 'ciudad',        type: sql.NVarChar(50),  value: Body.ciudad ?? null },
      { name: 'codigo_postal', type: sql.NVarChar(10),  value: Body.codigo_postal ?? null },
      { name: 'pais',          type: sql.NVarChar(50),  value: Body.pais ?? null }
    ]);

    await db.executeProc('datos_personales_update', Params);
    return res.status(200).json({ success: true, message: 'Datos personales actualizados correctamente' });
  } catch (Error_) {
    console.error('datos_personales_update error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al actualizar datos personales' });
  }
});

/* ============================================================================
   POST /datos_personales/delete  -> SP: datos_personales_delete
============================================================================ */
DatosPersonalesRouter.post('/delete', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (delete)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('datos_personales_delete', Params);
    return res.status(200).json({ success: true, message: 'Datos personales eliminados correctamente' });
  } catch (Error_) {
    console.error('datos_personales_delete error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al eliminar datos personales' });
  }
});

/* ============================================================================
   GET /datos_personales/select_by_cliente/:cliente_id  -> SP: datos_personales_select_by_cliente
   (Solo status + message; sin data en la respuesta, como acordamos)
============================================================================ */
DatosPersonalesRouter.get('/select_by_cliente/:cliente_id', requireClient, async (req, res) => {
  try {
    const Body = { cliente_id: req.params.cliente_id };
    const { isValid } = await ValidationService.validateData(Body, SelectByClienteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (select_by_cliente)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('datos_personales_select_by_cliente', Params);
    const data = await db.executeProc('datos_personales_select_by_cliente', Params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Datos personales obtenidos por cliente' : 'Sin datos personales para este cliente',
      data
    });

  } catch (Error_) {
    console.error('datos_personales_select_by_cliente error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al obtener datos personales por cliente' });
  }
});

/* ============================================================================
   GET /datos_personales/select_all  -> SP: datos_personales_select_all
============================================================================ */
DatosPersonalesRouter.get('/select_all', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('datos_personales_select_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Datos personales listados' : 'Sin registros',
      data
    });
  } catch (Error_) {
    console.error('datos_personales_select_all error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al listar datos personales' });
  }
});

module.exports = DatosPersonalesRouter;
