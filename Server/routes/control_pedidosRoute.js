// Server/routes/control_pedidosRoute.js
'use strict';

const express = require('express');
const controlPedidosRouter = express.Router();

const ValidationService = require('./validatorService.js');
const { db, sql } = require('././db/dbconnector.js');
const { requireAuth } = require('./authRoute.js');

const {
  AddItemRules, RemoveItemRules, SetEstadoRules, VerificarProductosRules
} = require('./Validators/Rulesets/control_pedidos.js');

// Mapea errores SQL → HTTP
function mapErr(err) {
  const m = {
    53002: { code: 404, msg: 'El pedido no existe' },
    53006: { code: 400, msg: 'Estado no soportado' },
    53008: { code: 409, msg: 'El pedido no es editable en su estado actual' },
    53009: { code: 404, msg: 'Producto no existe o inactivo' },
    53010: { code: 400, msg: 'Cantidad inválida' },
    53011: { code: 404, msg: 'El producto no está en el pedido' },
    53012: { code: 409, msg: 'Stock insuficiente' },
  };
  return m[err?.number] || null;
}

/* ============================================================================
   POST /pedidos/add_item  -> SP: pedido_add_item
   ============================================================================ */
controlPedidosRouter.post('/add_item', requireAuth, async (req, res) => {
  try {
    const { isValid } = await ValidationService.validateData(req.body, AddItemRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (add_item)' });

    const p = req.body;
    const params = {
      pedido_id:       { type: sql.NVarChar(20),  value: p.pedido_id },
      producto_id:     { type: sql.NVarChar(20),  value: p.producto_id },
      cantidad:        { type: sql.Int,           value: p.cantidad ?? 1 },
      precio_unitario: { type: sql.Decimal(10,2), value: p.precio_unitario ?? null },
    };

    const data = await db.executeProc('pedido_add_item', params);
    return res.status(200).json({ success: true, message: 'Artículo agregado', data });
  } catch (err) {
    console.error('add_item error:', err);
    const m = mapErr(err);
    if (m) return res.status(m.code).json({ success: false, message: m.msg });
    return res.status(500).json({ success: false, message: 'Error al agregar artículo' });
  }
});

/* ============================================================================
   POST /pedidos/remove_item  -> SP: pedido_remove_item
   ============================================================================ */
controlPedidosRouter.post('/remove_item', requireAuth, async (req, res) => {
  try {
    const { isValid } = await ValidationService.validateData(req.body, RemoveItemRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (remove_item)' });

    const p = req.body;
    const params = {
      pedido_id:   { type: sql.NVarChar(20), value: p.pedido_id },
      producto_id: { type: sql.NVarChar(20), value: p.producto_id },
      cantidad:    { type: sql.Int,          value: p.cantidad ?? null }, // null = eliminar línea completa
    };

    const data = await db.executeProc('pedido_remove_item', params);
    return res.status(200).json({ success: true, message: 'Artículo actualizado', data });
  } catch (err) {
    console.error('remove_item error:', err);
    const m = mapErr(err);
    if (m) return res.status(m.code).json({ success: false, message: m.msg });
    return res.status(500).json({ success: false, message: 'Error al actualizar artículo' });
  }
});

/* ============================================================================
   POST /pedidos/set_estado  -> SP: pedidos_set_estado
   ============================================================================ */
controlPedidosRouter.post('/set_estado', requireAuth, async (req, res) => {
  try {
    const { isValid } = await ValidationService.validateData(req.body, SetEstadoRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (set_estado)' });

    const p = req.body;
    await db.executeProc('pedidos_set_estado', {
      pedido_id: { type: sql.NVarChar(20), value: p.pedido_id },
      estado:    { type: sql.NVarChar(20), value: p.estado },
    });

    const header = await db.executeProc('pedidos_get_by_id', {
      id: { type: sql.NVarChar(20), value: p.pedido_id },
    });
    const detalles = await db.executeProc('pedidos_join_detalles_by_pedido', {
      id_pedido: { type: sql.NVarChar(20), value: p.pedido_id },
    });

    return res.status(200).json({
      success: true,
      message: 'Estado actualizado',
      data: { pedido: header?.[0] || null, detalles },
    });
  } catch (err) {
    console.error('set_estado error:', err);
    const m = mapErr(err);
    if (m) return res.status(m.code).json({ success: false, message: m.msg });
    return res.status(500).json({ success: false, message: 'Error al actualizar estado' });
  }
});

/* ============================================================================
   GET /pedidos/verificar_productos/:pedido_id  -> SP: pedidos_verificar_productos
   ============================================================================ */
controlPedidosRouter.get('/verificar_productos/:pedido_id', requireAuth, async (req, res) => {
  try {
    const Body = { pedido_id: req.params.pedido_id };
    const { isValid } = await ValidationService.validateData(Body, VerificarProductosRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (verificar_productos)', data: [] });

    const data = await db.executeProc('pedidos_verificar_productos', {
      pedido_id: { type: sql.NVarChar(20), value: Body.pedido_id },
    });

    return res.status(200).json({
      success: true,
      message: data.length ? 'Productos con stock insuficiente' : 'Todos con stock suficiente',
      data,
    });
  } catch (err) {
    console.error('verificar_productos error:', err);
    const m = mapErr(err);
    if (m) return res.status(m.code).json({ success: false, message: m.msg, data: [] });
    return res.status(500).json({ success: false, message: 'Error al verificar stock', data: [] });
  }
});

module.exports = controlPedidosRouter;
