// Server/routes/Validators/Rulesets/reportes.js
'use strict';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
// acepta "123", "cl-123", "cl-abc-001"
const CLIENTE_ID = /^(cl-)?[A-Za-z0-9\-]+$/;

const VentasMensualRules = {
  // ambos opcionales: permite pedir todo el mes/tabla completa si no se envían
  desde: { required: false, type: 'string', pattern: ISO },
  hasta: { required: false, type: 'string', pattern: ISO },
};

const TopVentasRules = {
  desde: { required: true,  type: 'string', pattern: ISO },
  hasta: { required: true,  type: 'string', pattern: ISO },
  // admitimos limit y su alias top
  limit: { required: false, type: 'number', min: 1, max: 1000 },
  top:   { required: false, type: 'number', min: 1, max: 1000 },
};

const ClientesFrecuenciaRules = {
  desde: { required: true, type: 'string', pattern: ISO },
  hasta: { required: true, type: 'string', pattern: ISO },
};

const HistorialClienteRules = {
  cliente_id: {
    required: true,
    type: 'string',
    pattern: CLIENTE_ID,
    messages: { pattern: 'cliente_id inválido' }
  },
  desde: { required: true, type: 'string', pattern: ISO },
  hasta: { required: true, type: 'string', pattern: ISO },
};

module.exports = {
  VentasMensualRules,
  TopVentasRules,
  ClientesFrecuenciaRules,
  HistorialClienteRules,
};
