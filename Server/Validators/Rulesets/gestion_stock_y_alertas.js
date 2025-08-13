// Server/Validators/Rulesets/gestion_stock_y_alertas.js

const ProductoIdRegex = /^[A-Za-z0-9\-]{1,20}$/; // prd-1, prd-123
const FechaStrRegex   = /^[0-9T:\-\/\s\.]+$/;    // ISO/fecha flexible (validación suave)
const EstadoRegex     = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s\.\,\-_]{1,20}$/;

module.exports = {
  // STOCK
  StockAddRules: {
    producto_id: { required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id muy largo', pattern: 'producto_id inválido' } },
    cantidad:    { required: true, type: 'number',
      messages: { required: 'cantidad es obligatoria', type: 'cantidad debe ser numérica' } }
  },
  StockReduceRules: {
    producto_id: { required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id muy largo', pattern: 'producto_id inválido' } },
    cantidad:    { required: true, type: 'number',
      messages: { required: 'cantidad es obligatoria', type: 'cantidad debe ser numérica' } }
  },

  // ALERTAS (opcional)
  GenerarAlertasRules: {
    umbral_global: { required: true, type: 'number',
      messages: { required: 'umbral_global es obligatorio', type: 'umbral_global debe ser numérico' } },
    solo_activos:  { required: true, type: 'number',
      messages: { required: 'solo_activos es obligatorio', type: 'solo_activos debe ser 0 o 1' } }
  },

  // LOGS
  LogByProductoRules: {
    producto_id: { required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id muy largo', pattern: 'producto_id inválido' } }
  },
  LogByCategoriaRules: {
    categoria_id: { required: true, type: 'number',
      messages: { required: 'categoria_id es obligatorio', type: 'categoria_id debe ser numérico' } }
  },
  LogByRangoRules: {
    desde: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex,
      messages: { required: 'desde es obligatorio', type: 'desde debe ser texto', maxLength: 'desde muy largo', pattern: 'desde inválido' } },
    hasta: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex,
      messages: { required: 'hasta es obligatorio', type: 'hasta debe ser texto', maxLength: 'hasta muy largo', pattern: 'hasta inválido' } }
  },
  LogByProductoRangoRules: {
    producto_id: { required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id muy largo', pattern: 'producto_id inválido' } },
    desde: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex,
      messages: { required: 'desde es obligatorio', type: 'desde debe ser texto', maxLength: 'desde muy largo', pattern: 'desde inválido' } },
    hasta: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex,
      messages: { required: 'hasta es obligatorio', type: 'hasta debe ser texto', maxLength: 'hasta muy largo', pattern: 'hasta inválido' } }
  },
  LogByCategoriaRangoRules: {
    categoria_id: { required: true, type: 'number',
      messages: { required: 'categoria_id es obligatorio', type: 'categoria_id debe ser numérico' } },
    desde: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex,
      messages: { required: 'desde es obligatorio', type: 'desde debe ser texto', maxLength: 'desde muy largo', pattern: 'desde inválido' } },
    hasta: { required: true, type: 'string', maxLength: 30, pattern: FechaStrRegex,
      messages: { required: 'hasta es obligatorio', type: 'hasta debe ser texto', maxLength: 'hasta muy largo', pattern: 'hasta inválido' } }
  },

  // PRECIOS MASIVOS
  PreciosIncrementarRules: {
    monto:        { required: true, type: 'number',
      messages: { required: 'monto es obligatorio', type: 'monto debe ser numérico' } },
    categoria_id: { required: false, type: 'number',
      messages: { type: 'categoria_id debe ser numérico' } },
    solo_activos: { required: true, type: 'number',
      messages: { required: 'solo_activos es obligatorio', type: 'solo_activos debe ser 0 o 1' } }
  },
  PreciosReducirRules: {
    monto:        { required: true, type: 'number',
      messages: { required: 'monto es obligatorio', type: 'monto debe ser numérico' } },
    categoria_id: { required: false, type: 'number',
      messages: { type: 'categoria_id debe ser numérico' } },
    solo_activos: { required: true, type: 'number',
      messages: { required: 'solo_activos es obligatorio', type: 'solo_activos debe ser 0 o 1' } }
  },
  PreciosDescuentoRules: {
    porcentaje:   { required: true, type: 'number',
      messages: { required: 'porcentaje es obligatorio', type: 'porcentaje debe ser numérico' } },
    categoria_id: { required: false, type: 'number',
      messages: { type: 'categoria_id debe ser numérico' } },
    solo_activos: { required: true, type: 'number',
      messages: { required: 'solo_activos es obligatorio', type: 'solo_activos debe ser 0 o 1' } }
  }
};
