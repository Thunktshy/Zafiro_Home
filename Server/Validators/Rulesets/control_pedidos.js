// Server/Validators/Rulesets/control_pedidos.js
'use strict';

const id = {
  pedido: /^ped-\d+$/i,
  producto: /^prd-\d+$/i
};

const AddItemRules = {
  pedido_id:   { required: true, type: 'string', pattern: id.pedido,   maxLength: 20 },
  producto_id: { required: true, type: 'string', pattern: id.producto, maxLength: 20 },
  // opcionales:
  cantidad:        { required: false, type: 'number', min: 1 },
  precio_unitario: { required: false, type: 'number', min: 0 }
};

const RemoveItemRules = {
  pedido_id:   { required: true, type: 'string', pattern: id.pedido,   maxLength: 20 },
  producto_id: { required: true, type: 'string', pattern: id.producto, maxLength: 20 },
  cantidad:    { required: false, type: 'number', min: 1 } // null => elimina línea completa
};

const SetEstadoRules = {
  pedido_id: { required: true, type: 'string', pattern: id.pedido, maxLength: 20 },
  estado:    { required: true, type: 'string', enum: ['Por confirmar', 'Confirmado', 'Cancelado'] }
};

const VerificarProductosRules = {
  pedido_id: { required: true, type: 'string', pattern: id.pedido, maxLength: 20 }
};

module.exports = {
  AddItemRules,
  RemoveItemRules,
  SetEstadoRules,
  VerificarProductosRules
};
