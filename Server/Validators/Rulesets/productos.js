// Server/Validators/Rulesets/productos.js

const ProductoIdRegex   = /^[A-Za-z0-9\-]{1,20}$/; // p. ej. prd-1
const NombreRegex       = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\-_]{1,50}$/;
const DescripcionRegex  = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\-_]{1,150}$/;
const EstadoRegex       = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s\.\,\-_]{1,20}$/;

module.exports = {
  InsertRules: {
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
      required: true, type: 'number', min: 0, max: 99999999.99,
      messages: { required: 'precio_unitario es obligatorio', type: 'precio_unitario debe ser numérico', min: 'precio_unitario no puede ser negativo' }
    },
    stock: {
      required: true, type: 'number', min: 0, max: 2147483647,
      messages: { required: 'stock es obligatorio', type: 'stock debe ser numérico', min: 'stock no puede ser negativo' }
    },
    categoria_id: {
      required: true, type: 'number', min: 1,
      messages: { required: 'categoria_id es obligatorio', type: 'categoria_id debe ser numérico', min: 'categoria_id inválido' }
    },
    estado_producto: {
      required: true, type: 'string', maxLength: 20, pattern: EstadoRegex,
      messages: { required: 'estado_producto es obligatorio', type: 'estado_producto debe ser texto', maxLength: 'estado_producto muy largo', pattern: 'estado_producto inválido' }
    }
  },

  UpdateRules: {
    producto_id: {
      required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id muy largo', pattern: 'producto_id inválido' }
    },
    // mismos campos que insert
    nombre_producto:       this?.InsertRules?.nombre_producto || { required: true, type: 'string', maxLength: 50, pattern: NombreRegex },
    descripcion:           this?.InsertRules?.descripcion     || { required: false, type: 'string', maxLength: 150, pattern: DescripcionRegex },
    precio_unitario:       this?.InsertRules?.precio_unitario || { required: true, type: 'number', min: 0, max: 99999999.99 },
    stock:                 this?.InsertRules?.stock           || { required: true, type: 'number', min: 0, max: 2147483647 },
    categoria_id:          this?.InsertRules?.categoria_id    || { required: true, type: 'number', min: 1 },
    estado_producto:       this?.InsertRules?.estado_producto || { required: true, type: 'string', maxLength: 20, pattern: EstadoRegex }
  },

  DeleteRules: {
    producto_id: {
      required: true, type: 'string', maxLength: 20, pattern: ProductoIdRegex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id muy largo', pattern: 'producto_id inválido' }
    }
  }
};
