// Server/routes/datos_personalesRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const {
  InsertRules, UpdateRules, DeleteRules, SelectByClienteRules
} = require('../Validators/Rulesets/datos_personales.js');

const { requireAdmin } = require('../routes/authRoute.js');
const { requireClient } = require('../routes/authRoute.js');
const { requireAuth } = require('../routes/authRoute.js');


const DatosPersonalesRouter = express.Router();

// Helper: { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Mapea números de error SQL -> HTTP (congruentes con tus SP 59xxx)
function MapSqlErrorToHttp(err) {
  if (!err || typeof err.number !== 'number') return null;
  switch (err.number) {
    case 59000: return { code: 404, message: 'El cliente especificado no existe' }; // insert
    case 59001: return { code: 409, message: 'Ya existen datos personales para este cliente' }; // insert
    case 59002: return { code: 404, message: 'No existen datos personales para este cliente' }; // update
    case 59003: return { code: 404, message: 'No existen datos personales para este cliente' }; // delete
    default: return null;
  }
}

/* INSERT -> datos_personales_insert */
DatosPersonalesRouter.post('/insert', requireAuth, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (insert)', errors });

    const Params = BuildParams([
      { name:'cliente_id',    type: sql.NVarChar(20),  value: Body.cliente_id },
      { name:'nombre',        type: sql.NVarChar(50),  value: Body.nombre },
      { name:'apellidos',     type: sql.NVarChar(100), value: Body.apellidos },
      { name:'telefono',      type: sql.NVarChar(20),  value: Body.telefono ?? null },
      { name:'direccion',     type: sql.NVarChar(200), value: Body.direccion ?? null },
      { name:'ciudad',        type: sql.NVarChar(50),  value: Body.ciudad ?? null },
      { name:'codigo_postal', type: sql.NVarChar(10),  value: Body.codigo_postal ?? null },
      { name:'pais',          type: sql.NVarChar(50),  value: Body.pais ?? null }
    ]);

    await db.executeProc('datos_personales_insert', Params);
    return res.status(201).json({ success:true, message:'Datos personales creados correctamente' });
  } catch (err) {
    console.error('datos_personales_insert error:', err);
    const mapped = MapSqlErrorToHttp(err);
    if (mapped) return res.status(mapped.code).json({ success:false, message: mapped.message });
    return res.status(500).json({ success:false, message:'Error al crear datos personales' });
  }
});

/* UPDATE -> datos_personales_update */
DatosPersonalesRouter.post('/update', requireAuth, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (update)', errors });

    const Params = BuildParams([
      { name:'cliente_id',    type: sql.NVarChar(20),  value: Body.cliente_id },
      { name:'nombre',        type: sql.NVarChar(50),  value: Body.nombre },
      { name:'apellidos',     type: sql.NVarChar(100), value: Body.apellidos },
      { name:'telefono',      type: sql.NVarChar(20),  value: Body.telefono ?? null },
      { name:'direccion',     type: sql.NVarChar(200), value: Body.direccion ?? null },
      { name:'ciudad',        type: sql.NVarChar(50),  value: Body.ciudad ?? null },
      { name:'codigo_postal', type: sql.NVarChar(10),  value: Body.codigo_postal ?? null },
      { name:'pais',          type: sql.NVarChar(50),  value: Body.pais ?? null }
    ]);

    await db.executeProc('datos_personales_update', Params);
    return res.status(200).json({ success:true, message:'Datos personales actualizados correctamente' });
  } catch (err) {
    console.error('datos_personales_update error:', err);
    const mapped = MapSqlErrorToHttp(err);
    if (mapped) return res.status(mapped.code).json({ success:false, message: mapped.message });
    return res.status(500).json({ success:false, message:'Error al actualizar datos personales' });
  }
});

/* DELETE -> datos_personales_delete */
DatosPersonalesRouter.post('/delete', requireAuth, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (delete)', errors });

    const Params = BuildParams([{ name:'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }]);
    await db.executeProc('datos_personales_delete', Params);
    return res.status(200).json({ success:true, message:'Datos personales eliminados correctamente' });
  } catch (err) {
    console.error('datos_personales_delete error:', err);
    const mapped = MapSqlErrorToHttp(err);
    if (mapped) return res.status(mapped.code).json({ success:false, message: mapped.message });
    return res.status(500).json({ success:false, message:'Error al eliminar datos personales' });
  }
});

/* GET por cliente -> datos_personales_select_by_cliente */
DatosPersonalesRouter.get('/select_by_cliente/:cliente_id', requireAuth, async (req, res) => {
  try {
    const Body = { cliente_id: String(req.params.cliente_id) };
    const { isValid } = await ValidationService.validateData(Body, SelectByClienteRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (select_by_cliente)' });

    const Params = BuildParams([{ name:'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }]);
    const data = await db.executeProc('datos_personales_select_by_cliente', Params);

    return res.status(200).json({
      success: true,
      message: data.length ? 'Datos personales obtenidos por cliente' : 'Sin datos personales para este cliente',
      data
    });
  } catch (err) {
    console.error('datos_personales_select_by_cliente error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener datos personales por cliente' });
  }
});

/* GET por PK -> datos_personales_por_id (backoffice) */
DatosPersonalesRouter.get('/por_id/:datos_id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.datos_id);
    if (!Number.isInteger(id)) return res.status(400).json({ success:false, message:'datos_id inválido' });

    const data = await db.executeProc('datos_personales_por_id', {
      datos_id: { type: sql.Int, value: id }
    });
    if (!data.length) return res.status(404).json({ success:false, message:'Registro no encontrado' });

    return res.status(200).json({ success:true, message:'Registro obtenido', data: data[0] });
  } catch (err) {
    console.error('datos_personales_por_id error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener el registro' });
  }
});

/* GET all -> datos_personales_select_all (admin) */
DatosPersonalesRouter.get('/select_all', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('datos_personales_select_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Datos personales listados' : 'Sin registros',
      data
    });
  } catch (err) {
    console.error('datos_personales_select_all error:', err);
    return res.status(500).json({ success:false, message:'Error al listar datos personales' });
  }
});

module.exports = DatosPersonalesRouter;
