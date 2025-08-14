// Server/routes/Validators/Rulesets/reportes.js
'use strict';

// Nota: seguimos el esquema usado en tus otros rulesets (required/type/pattern/min/max).
// Las fechas van como string "YYYY-MM-DD" y se parsean en la ruta.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const VentasMensualRules = {
  desde: { required: false, type: 'string', pattern: ISO },
  hasta: { required: false, type: 'string', pattern: ISO }
};

const TopVentasRules = {
  desde: { required: true, type: 'string', pattern: ISO },
  hasta: { required: true, type: 'string', pattern: ISO },
  top:   { required: false, type: 'int', min: 1, max: 1000 } // por defecto 10 si no viene
};

const ClientesFrecuenciaRules = {
  desde: { required: true, type: 'string', pattern: ISO },
  hasta: { required: true, type: 'string', pattern: ISO }
};

module.exports = {
  VentasMensualRules,
  TopVentasRules,
  ClientesFrecuenciaRules
};
