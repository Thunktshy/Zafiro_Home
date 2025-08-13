// Server/routes/pedidosRoute.js
'use strict';

const express = require('express');
const { db, sql } = require('././db/dbconnector.js');
const ValidationService = require('./validatorService.js');
const {
  InsertRules,
  GetByIdRules,
  GetByClienteRules,
  PorEstadoRules,
  ConfirmarRules,
  CancelarRules
} = require('./Validators/Rulesets/pedidos.js');

const { requireAdmin, requireClient } = require('./authRoute.js');
const PedidosRouter = express.Router();

// Helper: { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Mapear números de error SQL → HTTP (5300x según tus SP)
function MapSqlError(err) {
  if (!err || typeof err.number !== 'number') return null;
  const map = {
    53001: { code: 404, message: 'El cliente no existe' },                         // insert
    53002: { code: 404, message: 'El pedido no existe' },                          // confirmar
    53003: { code: 409, message: 'No se puede confirmar un pedido sin artículos' },
    53004: { code: 409, message: 'El total debe ser > 0 para confirmar' },
    53005: { code: 404, message: 'El pedido no existe' },                          // cancelar
    53008: { code: 409, message: 'El pedido no es editable en su estado actual' },// confirmar
    53009: { code: 404, message: 'Producto no existe o inactivo' }, // confirmar (revalidación)
    53012: { code: 409, message: 'Stock insuficiente' }  // confirmar (revalidación)
  };
  return map[err.number] || null;
}

// Utilidad: traer encabezado + detalles en un solo objeto
async function GetPedidoYDetalles(pedido_id) {
  const header = await db.executeProc('pedidos_get_by_id', {
    id: { type: sql.NVarChar(20), value: pedido_id }
  });
  const detalles = await db.executeProc('pedidos_join_detalles_by_pedido', {
    id_pedido: { type: sql.NVarChar(20), value: pedido_id }
  });
  return { pedido: header?.[0] || null, detalles: detalles || [] };
}

/* ============================================================================
   POST /pedidos/insert  -> SP: pedidos_insert (devuelve pedido_id)
   ============================================================================ */
PedidosRouter.post('/insert', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (insert)', data: {} });
    }

    const Params = BuildParams([
      { name: 'cliente_id',  type: sql.NVarChar(20), value: Body.cliente_id }, // <= 20
      { name: 'metodo_pago', type: sql.NVarChar(20), value: Body.metodo_pago ?? null }
    ]);

    const rows = await db.executeProc('pedidos_insert', Params);
    const pedidoId = rows?.[0]?.pedido_id || null;
    const data = pedidoId ? await GetPedidoYDetalles(pedidoId) : { pedido: null, detalles: [] };

    return res.status(201).json({
      success: true,
      message: 'Pedido creado correctamente',
      data: { pedido_id: pedidoId, ...data }
    });
  } catch (err) {
    console.error('pedidos_insert error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: {} });
    return res.status(500).json({ success: false, message: 'Error al crear el pedido', data: {} });
  }
});

/* ============================================================================
   POST /pedidos/confirmar  -> SP: pedidos_confirmar
   ============================================================================ */
PedidosRouter.post('/confirmar', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, ConfirmarRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (confirmar)' });

    const Params = BuildParams([{ name: 'id', type: sql.NVarChar(20), value: Body.pedido_id }]);
    await db.executeProc('pedidos_confirmar', Params);

    const data = await GetPedidoYDetalles(Body.pedido_id);
    return res.status(200).json({ success: true, message: 'Pedido confirmado', data });
  } catch (err) {
    console.error('pedidos_confirmar error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: {} });
    return res.status(500).json({ success: false, message: 'Error al confirmar el pedido', data: {} });
  }
});

/* ============================================================================
   POST /pedidos/cancelar  -> SP: pedidos_cancelar
   ============================================================================ */
PedidosRouter.post('/cancelar', requireClient, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, CancelarRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (cancelar)' });

    const Params = BuildParams([{ name: 'id', type: sql.NVarChar(20), value: Body.pedido_id }]);
    await db.executeProc('pedidos_cancelar', Params);

    const data = await GetPedidoYDetalles(Body.pedido_id);
    return res.status(200).json({ success: true, message: 'Pedido cancelado', data });
  } catch (err) {
    console.error('pedidos_cancelar error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: {} });
    return res.status(500).json({ success: false, message: 'Error al cancelar el pedido', data: {} });
  }
});

/* ============================================================================
   GET /pedidos/get/:pedido_id  -> SP: pedidos_get_by_id
   ============================================================================ */
PedidosRouter.get('/get/:pedido_id', requireClient, async (req, res) => {
  try {
    const Body = { pedido_id: req.params.pedido_id };
    const { isValid } = await ValidationService.validateData(Body, GetByIdRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (get)', data: {} });

    const data = await db.executeProc('pedidos_get_by_id', {
      id: { type: sql.NVarChar(20), value: Body.pedido_id }
    });
    return res.status(200).json({
      success: true,
      message: data.length ? 'Pedido obtenido' : 'Pedido no encontrado',
      data: data[0] || null
    });
  } catch (err) {
    console.error('pedidos_get_by_id error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener pedido', data: {} });
  }
});

/* ============================================================================
   GET /pedidos/get_detalles/:pedido_id  -> SP: pedidos_join_detalles_by_pedido
   ============================================================================ */
PedidosRouter.get('/get_detalles/:pedido_id', requireClient, async (req, res) => {
  try {
    const Body = { pedido_id: req.params.pedido_id };
    const { isValid } = await ValidationService.validateData(Body, GetByIdRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (get_detalles)', data: [] });

    const data = await db.executeProc('pedidos_join_detalles_by_pedido', {
      id_pedido: { type: sql.NVarChar(20), value: Body.pedido_id }
    });
    return res.status(200).json({
      success: true,
      message: data.length ? 'Detalles obtenidos' : 'Sin detalles',
      data
    });
  } catch (err) {
    console.error('pedidos_join_detalles_by_pedido error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener detalles', data: [] });
  }
});

/* ============================================================================
   GET /pedidos/por_cliente/:cliente_id  -> SP: pedidos_get_by_cliente_id
   ============================================================================ */
PedidosRouter.get('/por_cliente/:cliente_id', requireClient, async (req, res) => {
  try {
    const Body = { cliente_id: req.params.cliente_id };
    const { isValid } = await ValidationService.validateData(Body, GetByClienteRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (por_cliente)', data: [] });

    const data = await db.executeProc('pedidos_get_by_cliente_id', {
      cliente_id: { type: sql.NVarChar(20), value: Body.cliente_id }
    });
    return res.status(200).json({
      success: true,
      message: Array.isArray(data) && data.length ? 'Pedidos del cliente obtenidos' : 'Este cliente no tiene pedidos',
      data
    });
  } catch (err) {
    console.error('pedidos_get_by_cliente_id error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos del cliente', data: [] });
  }
});

/* ============================================================================
   GET /pedidos/por_estado/:estado  -> SP: pedidos_get_by_estado
   ============================================================================ */
PedidosRouter.get('/por_estado/:estado', requireAdmin, async (req, res) => {
  try {
    const Body = { estado: req.params.estado };
    const { isValid } = await ValidationService.validateData(Body, PorEstadoRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (por_estado)', data: [] });

    const data = await db.executeProc('pedidos_get_by_estado', {
      estado: { type: sql.NVarChar(20), value: Body.estado }
    });
    return res.status(200).json({ success: true, message: 'Pedidos por estado obtenidos', data });
  } catch (err) {
    console.error('pedidos_get_by_estado error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos por estado', data: [] });
  }
});

/* ============================================================================
   GET /pedidos/por_confirmar  -> SP: pedidos_get_por_confirmar
   ============================================================================ */
PedidosRouter.get('/por_confirmar', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('pedidos_get_por_confirmar', {});
    return res.status(200).json({ success: true, message: 'Pedidos por confirmar', data });
  } catch (err) {
    console.error('pedidos_get_por_confirmar error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos por confirmar', data: [] });
  }
});

module.exports = PedidosRouter;
