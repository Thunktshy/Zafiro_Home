// Server/routes/datos_facturacionRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const {
  InsertRules,
  UpdateRules,
  DeleteRules,
  SelectByClienteRules
} = require('../Validators/Rulesets/datos_facturacion.js');

const { requireAdmin } = require('../routes/authRoute.js');
const { requireClient } = require('../routes/authRoute.js'); 

const DatosFacturacionRouter = express.Router();

// Helper: { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Mapear números de error SQL → HTTP
function MapSqlErrorToHttp(err){
  if(!err || typeof err.number !== 'number') return null;
  switch(err.number){
    case 58000: return { code: 404, message: 'El cliente especificado no existe' };
    case 58001: return { code: 409, message: 'Ya existen datos de facturación para este cliente' };
    case 58002: return { code: 404, message: 'No existen datos de facturación para este cliente' };
    case 58003: return { code: 404, message: 'No existen datos de facturación para este cliente' };
    default: return null;
  }
}

/* ============================================================================
   POST /datos_facturacion/insert  -> SP: datos_facturacion_insert
============================================================================ */
DatosFacturacionRouter.post('/insert', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (insert)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id',       type: sql.NVarChar(20),  value: Body.cliente_id },
      { name: 'rfc',              type: sql.NVarChar(13),  value: Body.rfc },
      { name: 'razon_social',     type: sql.NVarChar(100), value: Body.razon_social },
      { name: 'direccion_fiscal', type: sql.NVarChar(200), value: Body.direccion_fiscal ?? null }
    ]);

    await db.executeProc('datos_facturacion_insert', Params);
    return res.status(201).json({ success: true, message: 'Datos de facturación creados correctamente' });
  } catch (Error_) {
    console.error('datos_facturacion_insert error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al crear datos de facturación' });
  }
});

/* ============================================================================
   POST /datos_facturacion/update  -> SP: datos_facturacion_update
============================================================================ */
DatosFacturacionRouter.post('/update', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (update)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id',       type: sql.NVarChar(20),  value: Body.cliente_id },
      { name: 'rfc',              type: sql.NVarChar(13),  value: Body.rfc },
      { name: 'razon_social',     type: sql.NVarChar(100), value: Body.razon_social },
      { name: 'direccion_fiscal', type: sql.NVarChar(200), value: Body.direccion_fiscal ?? null }
    ]);

    await db.executeProc('datos_facturacion_update', Params);
    return res.status(200).json({ success: true, message: 'Datos de facturación actualizados correctamente' });
  } catch (Error_) {
    console.error('datos_facturacion_update error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al actualizar datos de facturación' });
  }
});

/* ============================================================================
   POST /datos_facturacion/delete  -> SP: datos_facturacion_delete
============================================================================ */
DatosFacturacionRouter.post('/delete', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (delete)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('datos_facturacion_delete', Params);
    return res.status(200).json({ success: true, message: 'Datos de facturación eliminados correctamente' });
  } catch (Error_) {
    console.error('datos_facturacion_delete error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al eliminar datos de facturación' });
  }
});

// GET /datos_facturacion/select_by_cliente/:cliente_id
DatosFacturacionRouter.get('/select_by_cliente/:cliente_id', requireClient, async (req, res) => {
  try {
    const Body = { cliente_id: req.params.cliente_id };
    const { isValid } = await ValidationService.validateData(Body, SelectByClienteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (select_by_cliente)', data: [] });
    }
    const Params = { cliente_id: { type: sql.NVarChar(20), value: Body.cliente_id } };
    const data = await db.executeProc('datos_facturacion_select_by_cliente', Params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Datos de facturación obtenidos' : 'Sin datos de facturación',
      data
    });
  } catch (Error_) {
    console.error('datos_facturacion_select_by_cliente error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al obtener datos de facturación', data: [] });
  }
});

// GET /datos_facturacion/select_all
DatosFacturacionRouter.get('/select_all', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('datos_facturacion_select_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Datos de facturación listados' : 'Sin registros',
      data
    });
  } catch (Error_) {
    console.error('datos_facturacion_select_all error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al listar datos de facturación', data: [] });
  }
});

DatosFacturacionRouter.get('/por_id/:id', requireAdmin, async (req,res)=>{
  try{
    const id = Number(req.params.id);
    if(!Number.isInteger(id)) return res.status(400).json({success:false,message:'id inválido'});
    const data = await db.executeProc('datos_facturacion_por_id', {
      datos_facturacion_id: { type: sql.Int, value: id }
    });
    if(!data.length) return res.status(404).json({success:false,message:'No encontrado'});
    return res.status(200).json({success:true, message:'OK', data: data[0]});
  }catch(e){
    return res.status(500).json({success:false,message:'Error al obtener el registro'});
  }
});

module.exports = DatosFacturacionRouter;
