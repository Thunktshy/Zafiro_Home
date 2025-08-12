// Server/routes/pedidosRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const {
  InsertRules, AddItemRules, RemoveItemRules, SetEstadoRules, GetByIdRules
} = require('../Validators/Rulesets/pedidos.js');


const { requireAdmin } = require('./authRoute.js');
const { requireClient } = require('./authRoute.js'); 

const PedidosRouter = express.Router();

// Helper: construye { name: { type, value } }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

// Helper: traer encabezado + detalles para regresar data enriquecida
async function GetPedidoAndDetalles(pedidoId) {
  const pedido = await db.executeProc('pedidos_get', {
    pedido_id: { type: sql.NVarChar(10), value: pedidoId }
  });
  const detalles = await db.executeProc('pedidos_get_detalles', {
    pedido_id: { type: sql.NVarChar(10), value: pedidoId }
  });
  return {
    pedido: Array.isArray(pedido) && pedido[0] ? pedido[0] : null,
    detalles: Array.isArray(detalles) ? detalles : []
  };
}

// Mapear errores SQL de tus SP → HTTP + mensajes
function MapSqlError(err) {
  if (!err || typeof err.number !== 'number') return null;
  const n = err.number;
  const map = {
    53001: { code: 404, message: 'El cliente no existe' },                               // pedidos_insert
    54000: { code: 400, message: 'La cantidad debe ser > 0' },                            // add
    54001: { code: 409, message: 'Stock insuficiente para añadir la línea' },            // add
    54002: { code: 404, message: 'El pedido no existe' },                                 // add
    54003: { code: 409, message: 'El pedido no permite modificaciones' },                 // add
    54004: { code: 404, message: 'El producto no existe' },                               // add
    54005: { code: 409, message: 'Stock insuficiente para incrementar la cantidad' },    // add
    54006: { code: 404, message: 'El pedido no existe' },                                 // remove
    54007: { code: 409, message: 'El pedido no permite modificaciones' },                 // remove
    54008: { code: 404, message: 'El producto no está en el pedido' },                    // remove
    54009: { code: 400, message: 'La cantidad a restar debe ser > 0' },                   // remove
    54010: { code: 400, message: 'Estado no válido' },                                    // set_estado
    54011: { code: 404, message: 'El pedido no existe' },                                 // set_estado
    54012: { code: 409, message: 'No se puede modificar un pedido Completado/Cancelado' },
    54013: { code: 409, message: 'No se puede completar un pedido sin artículos' },
    54014: { code: 409, message: 'El total debe ser > 0 para completar' },
    54015: { code: 409, message: 'Stock inconsistente: hay productos con stock negativo' }
  };
  return map[n] || null;
}

/* ============================================================================
   POST /pedidos/insert  -> SP: pedidos_insert (devuelve pedido_id)
============================================================================ */
PedidosRouter.post('/insert', requireClient, async (req, res) => {
  try {
    const Body = { ...req.body };
    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (insert)', data: {} });
    }

    const Params = BuildParams([
      { name: 'cliente_id',  type: sql.NVarChar(10), value: Body.cliente_id },
      { name: 'metodo_pago', type: sql.NVarChar(20), value: Body.metodo_pago ?? null }
    ]);

    const rows = await db.executeProc('pedidos_insert', Params);
    const pedidoId = rows?.[0]?.pedido_id || null;
    const data = pedidoId ? await GetPedidoAndDetalles(pedidoId) : { pedido: null, detalles: [] };

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
   POST /pedidos/add_item  -> SP: pedido_add_item
============================================================================ */
PedidosRouter.post('/add_item', requireClient, async (req, res) => {
  try {
    const Body = {
      ...req.body,
      cantidad: Number(req.body.cantidad),
      precio_unitario: typeof req.body.precio_unitario === 'undefined'
        ? undefined
        : Number(req.body.precio_unitario)
    };
    const { isValid } = await ValidationService.validateData(Body, AddItemRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (add_item)', data: {} });
    }

    const Params = BuildParams([
      { name: 'pedido_id',       type: sql.NVarChar(10), value: Body.pedido_id },
      { name: 'producto_id',     type: sql.NVarChar(20), value: Body.producto_id },
      { name: 'cantidad',        type: sql.Int,          value: Body.cantidad },
      { name: 'precio_unitario', type: sql.Decimal(10,2),value: Body.precio_unitario ?? null }
    ]);
    await db.executeProc('pedido_add_item', Params);

    const data = await GetPedidoAndDetalles(Body.pedido_id);
    return res.status(200).json({ success: true, message: 'Artículo agregado al pedido', data });
  } catch (err) {
    console.error('pedido_add_item error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: {} });
    return res.status(500).json({ success: false, message: 'Error al agregar artículo al pedido', data: {} });
  }
});

/* ============================================================================
   POST /pedidos/remove_item  -> SP: pedido_remove_item
============================================================================ */
PedidosRouter.post('/remove_item', requireClient, async (req, res) => {
  try {
    const Body = { ...req.body };
    if (typeof Body.cantidad !== 'undefined') Body.cantidad = Number(Body.cantidad);
    const { isValid } = await ValidationService.validateData(Body, RemoveItemRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (remove_item)', data: {} });
    }

    const Params = BuildParams([
      { name: 'pedido_id',   type: sql.NVarChar(10), value: Body.pedido_id },
      { name: 'producto_id', type: sql.NVarChar(20), value: Body.producto_id },
      { name: 'cantidad',    type: sql.Int,          value: (typeof Body.cantidad === 'number') ? Body.cantidad : null }
    ]);
    await db.executeProc('pedido_remove_item', Params);

    const data = await GetPedidoAndDetalles(Body.pedido_id);
    return res.status(200).json({ success: true, message: 'Artículo removido/actualizado en el pedido', data });
  } catch (err) {
    console.error('pedido_remove_item error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: {} });
    return res.status(500).json({ success: false, message: 'Error al remover artículo del pedido', data: {} });
  }
});

/* ============================================================================
   POST /pedidos/set_estado  -> SP: pedidos_set_estado
============================================================================ */
PedidosRouter.post('/set_estado', requireClient, async (req, res) => {
  try {
    const Body = { ...req.body };
    const { isValid } = await ValidationService.validateData(Body, SetEstadoRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (set_estado)', data: {} });
    }

    const Params = BuildParams([
      { name: 'pedido_id', type: sql.NVarChar(10), value: Body.pedido_id },
      { name: 'estado',    type: sql.NVarChar(20), value: Body.estado }
    ]);
    await db.executeProc('pedidos_set_estado', Params);

    const data = await GetPedidoAndDetalles(Body.pedido_id);
    return res.status(200).json({ success: true, message: 'Estado de pedido actualizado', data });
  } catch (err) {
    console.error('pedidos_set_estado error:', err);
    const mapped = MapSqlError(err);
    if (mapped) return res.status(mapped.code).json({ success: false, message: mapped.message, data: {} });
    return res.status(500).json({ success: false, message: 'Error al actualizar estado del pedido', data: {} });
  }
});

/* ============================================================================
   GET /pedidos/get/:pedido_id  -> SP: pedidos_get
============================================================================ */
PedidosRouter.get('/get/:pedido_id', requireClient, async (req, res) => {
  try {
    const Body = { pedido_id: req.params.pedido_id };
    const { isValid } = await ValidationService.validateData(Body, GetByIdRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (get)', data: {} });
    }
    const data = await db.executeProc('pedidos_get', {
      pedido_id: { type: sql.NVarChar(10), value: Body.pedido_id }
    });
    return res.status(200).json({
      success: true,
      message: data.length ? 'Pedido obtenido' : 'Pedido no encontrado',
      data: data[0] || null
    });
  } catch (err) {
    console.error('pedidos_get error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener pedido', data: {} });
  }
});

/* ============================================================================
   GET /pedidos/get_detalles/:pedido_id  -> SP: pedidos_get_detalles
============================================================================ */
PedidosRouter.get('/get_detalles/:pedido_id', requireClient, async (req, res) => {
  try {
    const Body = { pedido_id: req.params.pedido_id };
    const { isValid } = await ValidationService.validateData(Body, GetByIdRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (get_detalles)', data: [] });
    }
    const data = await db.executeProc('pedidos_get_detalles', {
      pedido_id: { type: sql.NVarChar(10), value: Body.pedido_id }
    });
    return res.status(200).json({
      success: true,
      message: data.length ? 'Detalles obtenidos' : 'Sin detalles',
      data
    });
  } catch (err) {
    console.error('pedidos_get_detalles error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener detalles', data: [] });
  }
});

/* ============================================================================
   GET /pedidos/verificar_configuracion/:pedido_id  -> SP: pedidos_verificar_configuracion
============================================================================ */
PedidosRouter.get('/verificar_configuracion/:pedido_id', requireAdmin, async (req, res) => {
  try {
    const Body = { pedido_id: req.params.pedido_id };
    const { isValid } = await ValidationService.validateData(Body, GetByIdRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (verificar)', data: [] });
    }
    const data = await db.executeProc('pedidos_verificar_configuracion', {
      pedido_id: { type: sql.NVarChar(10), value: Body.pedido_id }
    });
    return res.status(200).json({
      success: true,
      message: data.length ? 'Inconsistencias encontradas' : 'Pedido configurado correctamente',
      data
    });
  } catch (err) {
    console.error('pedidos_verificar_configuracion error:', err);
    return res.status(500).json({ success: false, message: 'Error al verificar configuración', data: [] });
  }
});

/* ============================================================================
   GET /pedidos/por_cliente/:cliente_id  -> SP: pedidos_por_cliente_id
   ============================================================================ */
PedidosRouter.get('/por_cliente/:cliente_id', requireClient, async (req, res) => {
  try {
    const Body = { cliente_id: req.params.cliente_id };

    // Si usas ValidationService, valida longitud (<=20) con tu ruleset;
    // aquí lo dejamos minimal y directo para no bloquear.
    const Params = {
      cliente_id: { type: sql.NVarChar(20), value: Body.cliente_id }
    };

    const data = await db.executeProc('pedidos_select_by_cliente', Params);
    return res.status(200).json({
      success: true,
      message: Array.isArray(data) && data.length
        ? 'Pedidos del cliente obtenidos'
        : 'Este cliente no tiene pedidos',
      data
    });
  } catch (err) {
    console.error('pedidos_por_cliente_id error:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener pedidos del cliente', data: [] });
  }
});

module.exports = PedidosRouter;
