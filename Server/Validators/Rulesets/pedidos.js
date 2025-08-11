// Server/Validators/Rulesets/pedidos.js
'use strict';

/**
 * Convenciones de IDs
 * - cliente_id:  "cl-<número>"   (ej. cl-1)
 * - pedido_id:   "ped-<número>"  (ej. ped-1)
 * - producto_id: alfanumérico/hífen/guion_bajo (hasta 20)
 */
const idRegex = {
  cliente: /^cl-\d+$/i,
  pedido: /^ped-\d+$/i,
  producto: /^[A-Za-z0-9_-]{1,20}$/
};

/**
 * Reglas para SP: pedidos_insert(@cliente_id, @metodo_pago)
 */
const InsertRules = {
  cliente_id:   { required: true,  type: 'string', pattern: idRegex.cliente,  maxLength: 20 },
  metodo_pago:  { required: false, type: 'string',                                 maxLength: 20 }
};

/**
 * Reglas para SP: pedido_add_item(@pedido_id, @producto_id, @cantidad, @precio_unitario=NULL)
 */
const AddItemRules = {
  pedido_id:       { required: true,  type: 'string', pattern: idRegex.pedido,   maxLength: 10 },
  producto_id:     { required: true,  type: 'string', pattern: idRegex.producto, maxLength: 20 },
  cantidad:        { required: true,  type: 'number', integer: true, min: 1 },
  precio_unitario: { required: false, type: 'number', min: 0 }
};

/**
 * Reglas para SP: pedido_remove_item(@pedido_id, @producto_id, @cantidad=NULL)
 */
const RemoveItemRules = {
  pedido_id:   { required: true,  type: 'string', pattern: idRegex.pedido,   maxLength: 10 },
  producto_id: { required: true,  type: 'string', pattern: idRegex.producto, maxLength: 20 },
  cantidad:    { required: false, type: 'number', integer: true, min: 1 }
};

/**
 * Reglas para SP: pedidos_set_estado(@pedido_id, @estado)
 */
const SetEstadoRules = {
  pedido_id: { required: true,  type: 'string', pattern: idRegex.pedido, maxLength: 10 },
  estado:    { required: true,  type: 'string',
               enum: ['Por confirmar','Pendiente','Completado','Cancelado'] }
};

/**
 * Reglas para SP: pedidos_get(@pedido_id) y otros GET por id
 */
const GetByIdRules = {
  pedido_id: { required: true, type: 'string', pattern: idRegex.pedido, maxLength: 10 }
};

/**
 * Reglas para SP: pedidos_select_by_cliente(@cliente_id, @estado=NULL, @desde=NULL, @hasta=NULL)
 * (la ruta la solemos nombrar /pedidos/select_by_cliente/:cliente_id)
 */
const SelectByClienteRules = {
  cliente_id: { required: true,  type: 'string', pattern: idRegex.cliente, maxLength: 20 },
  estado:     { required: false, type: 'string',
                enum: ['Por confirmar','Pendiente','Completado','Cancelado'] },
  desde:      { required: false, type: 'date' },
  hasta:      { required: false, type: 'date' }
};

module.exports = {
  InsertRules,
  AddItemRules,
  RemoveItemRules,
  SetEstadoRules,
  GetByIdRules,
  SelectByClienteRules
};
