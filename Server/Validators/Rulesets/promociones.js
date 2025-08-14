// Server/Validators/Rulesets/promociones.js
'use strict';

const FechaStrRegex = /^[0-9T:\-\/\s\.]+$/;

const PromosActivasRules = {
  fecha: { required: false, type: 'string', maxLength: 30, pattern: FechaStrRegex }
};

const PromosCreateRules = {
  categoria_id:   { required: true, type: 'number', min: 1 },
  tipo_descuento: { required: true, type: 'string', enum: ['porcentaje','monto'] },
  valor_descuento:{ required: true, type: 'number', min: 0.01 },
  fecha_inicio:   { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex },
  fecha_fin:      { required: false, type: 'string', maxLength: 30, pattern: FechaStrRegex },
  solo_activos:   { required: false, type: 'boolean' }
};

module.exports = { PromosActivasRules, PromosCreateRules };
