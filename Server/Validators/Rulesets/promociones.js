// Server/Validators/Rulesets/promociones.js
'use strict';

const FechaStrRegex = /^[0-9T:\-\/\s\.]+$/;

const PromosActivasRules = {
  // fecha opcional; si viene, debe tener formato de fecha válido
  fecha: { required: false, type: 'string', maxLength: 30, pattern: FechaStrRegex }
};

module.exports = { PromosActivasRules };
