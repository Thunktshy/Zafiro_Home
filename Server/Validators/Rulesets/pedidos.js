// Server/Validators/Rulesets/pedidos.js
'use strict';

/** Convenciones de IDs */
const idRegex = {
  cliente: /^cl-\d+$/i,
  pedido: /^ped-\d+$/i
};

/** INSERT -> pedidos_insert(@cliente_id, @metodo_pago=NULL) */
const InsertRules = {
  cliente_id:  { required: true, type: 'string', pattern: idRegex.cliente, maxLength: 20 },
  metodo_pago: { required: false, type: 'string',                           maxLength: 20 }
};

/** GET por id -> pedidos_get_by_id(@id) y joins por pedido */
const GetByIdRules = {
  pedido_id: { required: true, type: 'string', pattern: idRegex.pedido, maxLength: 20 }
};

/** GET por cliente -> pedidos_get_by_cliente_id(@cliente_id) */
const GetByClienteRules = {
  cliente_id: { required: true, type: 'string', pattern: idRegex.cliente, maxLength: 20 }
};

/** GET por estado -> pedidos_get_by_estado(@estado) */
const PorEstadoRules = {
  estado: { required: true, type: 'string', enum: ['Por confirmar', 'Confirmado', 'Cancelado'] }
};

/** POST confirmar -> pedidos_confirmar(@id) */
const ConfirmarRules = {
  pedido_id: { required: true, type: 'string', pattern: idRegex.pedido, maxLength: 20 }
};

/** POST cancelar -> pedidos_cancelar(@id) */
const CancelarRules = {
  pedido_id: { required: true, type: 'string', pattern: idRegex.pedido, maxLength: 20 }
};

module.exports = {
  InsertRules,
  GetByIdRules,
  GetByClienteRules,
  PorEstadoRules,
  ConfirmarRules,
  CancelarRules
};
