// Server/routes/metodos_pagoRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js'); // ajusta si tu path difiere
const ValidationService = require('../validatorService.js');
const {
  InsertRules,
  UpdateRules,
  DeleteRules,
  SelectByClienteRules
} = require('../Validators/Rulesets/metodos_pago.js');

const { requireAdmin } = require('../routes/authRoute.js'); // asegúrate de exportarlo

const MetodosPagoRouter = express.Router();

// Helper: { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Mapear errores SQL → HTTP
function MapSqlErrorToHttp(err) {
  if (!err || typeof err.number !== 'number') return null;
  switch (err.number) {
    case 52000: return { code: 404, message: 'El cliente especificado no existe' };       // insert
    case 52001: return { code: 404, message: 'El método de pago especificado no existe' }; // update
    case 52002: return { code: 404, message: 'El método de pago especificado no existe' }; // delete
    default: return null;
  }
}

/* ============================================================================
   POST /metodos_pago/insert  -> SP: metodos_pago_insert
============================================================================ */
MetodosPagoRouter.post('/insert', requireAdmin, async (req, res) => {
  try {
    const Body = { ...req.body };

    // Coerción para BIT: permitir "0"/"1" o 0/1
    if (typeof Body.es_principal !== 'undefined') {
      const n = Number(Body.es_principal);
      Body.es_principal = Number.isNaN(n) ? undefined : n;
    }

    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (insert)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id',    type: sql.NVarChar(20),  value: Body.cliente_id },
      { name: 'tipo',          type: sql.NVarChar(20),  value: Body.tipo },
      { name: 'direccion',     type: sql.NVarChar(200), value: Body.direccion ?? null },
      { name: 'ciudad',        type: sql.NVarChar(50),  value: Body.ciudad ?? null },
      { name: 'codigo_postal', type: sql.NVarChar(10),  value: Body.codigo_postal ?? null },
      { name: 'pais',          type: sql.NVarChar(50),  value: Body.pais ?? null },
      { name: 'es_principal',  type: sql.Bit,           value: Body.es_principal ?? 0 }
    ]);

    await db.executeProc('metodos_pago_insert', Params);
    return res.status(201).json({ success: true, message: 'Método de pago creado correctamente' });
  } catch (Error_) {
    console.error('metodos_pago_insert error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al crear método de pago' });
  }
});

/* ============================================================================
   POST /metodos_pago/update  -> SP: metodos_pago_update
============================================================================ */
MetodosPagoRouter.post('/update', requireAdmin, async (req, res) => {
  try {
    const Body = {
      ...req.body,
      metodo_id: Number(req.body.metodo_id)
    };

    // BIT opcional (NULL mantiene valor)
    if (typeof Body.es_principal !== 'undefined') {
      const n = Number(Body.es_principal);
      Body.es_principal = Number.isNaN(n) ? undefined : n;
    }

    const { isValid } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (update)' });
    }

    const Params = BuildParams([
      { name: 'metodo_id',     type: sql.Int,          value: Body.metodo_id },
      { name: 'tipo',          type: sql.NVarChar(20), value: Body.tipo },
      { name: 'direccion',     type: sql.NVarChar(200),value: Body.direccion ?? null },
      { name: 'ciudad',        type: sql.NVarChar(50), value: Body.ciudad ?? null },
      { name: 'codigo_postal', type: sql.NVarChar(10), value: Body.codigo_postal ?? null },
      { name: 'pais',          type: sql.NVarChar(50), value: Body.pais ?? null },
      { name: 'es_principal',  type: sql.Bit,          value: (typeof Body.es_principal === 'number') ? Body.es_principal : null }
    ]);

    await db.executeProc('metodos_pago_update', Params);
    return res.status(200).json({ success: true, message: 'Método de pago actualizado correctamente' });
  } catch (Error_) {
    console.error('metodos_pago_update error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al actualizar método de pago' });
  }
});

/* ============================================================================
   POST /metodos_pago/delete  -> SP: metodos_pago_delete
============================================================================ */
MetodosPagoRouter.post('/delete', requireAdmin, async (req, res) => {
  try {
    const Body = { metodo_id: Number(req.body.metodo_id) };
    const { isValid } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (delete)' });
    }

    const Params = BuildParams([
      { name: 'metodo_id', type: sql.Int, value: Body.metodo_id }
    ]);

    await db.executeProc('metodos_pago_delete', Params);
    return res.status(200).json({ success: true, message: 'Método de pago eliminado correctamente' });
  } catch (Error_) {
    console.error('metodos_pago_delete error:', Error_);
    const mapped = MapSqlErrorToHttp(Error_);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message });
    return res.status(500).json({ success: false, message: 'Error al eliminar método de pago' });
  }
});

/* ============================================================================
   GET /metodos_pago/select_by_cliente/:cliente_id  -> SP: metodos_pago_select_by_cliente
============================================================================ */
MetodosPagoRouter.get('/select_by_cliente/:cliente_id', requireAdmin, async (req, res) => {
  try {
    const Body = { cliente_id: req.params.cliente_id };
    const { isValid } = await ValidationService.validateData(Body, SelectByClienteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (select_by_cliente)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('metodos_pago_select_by_cliente', Params);
    return res.status(200).json({ success: true, message: 'Métodos de pago obtenidos por cliente' });
  } catch (Error_) {
    console.error('metodos_pago_select_by_cliente error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al obtener métodos de pago por cliente' });
  }
});

/* ============================================================================
   GET /metodos_pago/select_all  -> SP: metodos_pago_select_all
============================================================================ */
MetodosPagoRouter.get('/select_all', requireAdmin, async (_req, res) => {
  try {
    await db.executeProc('metodos_pago_select_all', {});
    return res.status(200).json({ success: true, message: 'Métodos de pago listados' });
  } catch (Error_) {
    console.error('metodos_pago_select_all error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al listar métodos de pago' });
  }
});

module.exports = MetodosPagoRouter;
