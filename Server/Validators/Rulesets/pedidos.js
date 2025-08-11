// Server/Validators/Rulesets/pedidos.js
// Código en PascalCase/Inglés; mensajes en español.

const Id10Regex = /^[A-Za-z0-9\-]{1,10}$/;  // ej. ped-1, cl-1 (NVARCHAR(10))
const Id20Regex = /^[A-Za-z0-9\-]{1,20}$/;  // producto_id (NVARCHAR(20))
const MetodoRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\-_]{1,20}$/;
const EstadoRegex = /^(Por confirmar|Pendiente|Completado|Cancelado)$/;

module.exports = {
  InsertRules: {
    cliente_id: {
      required: true, type: 'string', maxLength: 10, pattern: Id10Regex,
      messages: {
        required: 'cliente_id es obligatorio',
        type: 'cliente_id debe ser texto',
        maxLength: 'cliente_id excede 10 caracteres',
        pattern: 'cliente_id tiene formato inválido'
      }
    },
    metodo_pago: {
      required: false, type: 'string', maxLength: 20, pattern: MetodoRegex,
      messages: {
        type: 'metodo_pago debe ser texto',
        maxLength: 'metodo_pago excede 20 caracteres',
        pattern: 'metodo_pago tiene formato inválido'
      }
    }
  },

  AddItemRules: {
    pedido_id:   { required: true, type: 'string', maxLength: 10, pattern: Id10Regex,
      messages: { required: 'pedido_id es obligatorio', type: 'pedido_id debe ser texto', maxLength: 'pedido_id excede 10', pattern: 'pedido_id inválido' } },
    producto_id: { required: true, type: 'string', maxLength: 20, pattern: Id20Regex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id excede 20', pattern: 'producto_id inválido' } },
    cantidad:    { required: true, type: 'number',
      messages: { required: 'cantidad es obligatoria', type: 'cantidad debe ser numérica' } },
    precio_unitario: { required: false, type: 'number',
      messages: { type: 'precio_unitario debe ser numérico' } }
  },

  RemoveItemRules: {
    pedido_id:   { required: true, type: 'string', maxLength: 10, pattern: Id10Regex,
      messages: { required: 'pedido_id es obligatorio', type: 'pedido_id debe ser texto', maxLength: 'pedido_id excede 10', pattern: 'pedido_id inválido' } },
    producto_id: { required: true, type: 'string', maxLength: 20, pattern: Id20Regex,
      messages: { required: 'producto_id es obligatorio', type: 'producto_id debe ser texto', maxLength: 'producto_id excede 20', pattern: 'producto_id inválido' } },
    cantidad:    { required: false, type: 'number',
      messages: { type: 'cantidad debe ser numérica' } } // opcional: si no viene, elimina toda la línea
  },

  SetEstadoRules: {
    pedido_id: { required: true, type: 'string', maxLength: 10, pattern: Id10Regex,
      messages: { required: 'pedido_id es obligatorio', type: 'pedido_id debe ser texto', maxLength: 'pedido_id excede 10', pattern: 'pedido_id inválido' } },
    estado:    { required: true, type: 'string', maxLength: 20, pattern: EstadoRegex,
      messages: { required: 'estado es obligatorio', type: 'estado debe ser texto', maxLength: 'estado excede 20', pattern: 'estado no válido' } }
  },

  GetByIdRules: {
    pedido_id: { required: true, type: 'string', maxLength: 10, pattern: Id10Regex,
      messages: { required: 'pedido_id es obligatorio', type: 'pedido_id debe ser texto', maxLength: 'pedido_id excede 10', pattern: 'pedido_id inválido' } }
  }
};
