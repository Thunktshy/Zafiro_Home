// Server/Validators/Rulesets/productos.js

const ProductoIdRegex   = /^[A-Za-z0-9\-]{1,20}$/; // p.ej. prd-1
const NombreRegex       = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\-_]{1,50}$/;
const DescripcionRegex  = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\-_]{1,150}$/;
const EstadoRegex       = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s\.\,\-_]{1,20}$/;

const InsertCommon = {
  nombre_producto: {
    required: true, type: 'string', maxLength: 50, pattern: NombreRegex,
    messages: {
      required: 'nombre_producto es obligatorio',
      type: 'nombre_producto debe ser texto',
      maxLength: 'nombre_producto no puede exceder 50 caracteres',
      pattern: 'nombre_producto tiene formato inválido'
    }
  },
  descripcion: {
    required: false, type: 'string', maxLength: 150, pattern: DescripcionRegex,
    messages: { type: 'descripcion debe ser texto', maxLength: 'descripcion no puede exceder 150', pattern: 'descripcion inválida' }
  },
  precio_unitario: {
    required: true, type: 'number',
    messages: { required: 'precio_unitario es obligatorio', type: 'precio_unitario debe ser numérico' }
  },
  stock: {
    required: true, type: 'number',
    messages: { required: 'stock es obligatorio', type: 'stock debe ser numérico' }
  },
  categoria_id: {
    required: true, type: 'number',
    messages: { required: 'categoria_id es obligatorio', type: 'categoria_id debe ser numérico' }
  },
  estado_producto: {
    required: true, type: 'string', maxLength: 20, pattern: EstadoRegex,
    messages: { required: 'estado_producto es obligatorio', type: 'estado_producto debe ser texto', maxLength: 'estado_producto muy largo', pattern: 'estado_producto inválido' }
  }
};

module.exports = {
  InsertRules: InsertCommon,

  UpdateRules: {
    producto_id: {
      required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id muy largo', pattern: 'producto_id inválido' }
    },
    ...InsertCommon
  },

  DeleteRules: {
    producto_id: {
      required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id muy largo', pattern: 'producto_id inválido' }
    }
  },

  GetByIdRules: {
    id: { required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'id es obligatorio', type: 'id debe ser texto', maxLength: 'id muy largo', pattern: 'id inválido' }
    }
  },

  GetByNameRules: {
    nombre: { required: true, type: 'string', maxLength: 50, pattern: NombreRegex,
      messages: { required: 'nombre es obligatorio', type: 'nombre debe ser texto', maxLength: 'nombre muy largo', pattern: 'nombre inválido' }
    }
  },

  GetByCategoriaRules: {
    categoria_id: { required: true, type: 'number',
      messages: { required: 'categoria_id es obligatorio', type: 'categoria_id debe ser numérico' }
    }
  },

  SoftDeleteRules: {
    id: { required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'id es obligatorio', type: 'id debe ser texto', maxLength: 'id muy largo', pattern: 'id inválido' }
    }
  },

  RestoreRules: {
    id: { required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'id es obligatorio', type: 'id debe ser texto', maxLength: 'id muy largo', pattern: 'id inválido' }
    }
  }
};
