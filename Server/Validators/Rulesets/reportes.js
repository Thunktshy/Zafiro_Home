// Server/Validators/Rulesets/reportes.js
'use strict';

const idRegex = {
  cliente: /^cl-\d+$/i
};

const FechaStrRegex = /^[0-9T:\-\/\s\.]+$/;

const PivotRules = {
  desde: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex },
  hasta: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex }
};

const TopVentasRules = {
  desde: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex },
  hasta: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex },
  limit: { required: false, type: 'number' }
};

const FrecuenciaRules = {
  desde: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex },
  hasta: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex }
};

const HistorialClienteRules = {
  cliente_id: { required: true, type: 'string', pattern: idRegex.cliente, maxLength: 20 },
  desde:      { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex },
  hasta:      { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex }
};

module.exports = {
  PivotRules,
  TopVentasRules,
  FrecuenciaRules,
  HistorialClienteRules
};
