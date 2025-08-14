// Server/Validators/Rulesets/imagenes.js
'use strict';

// Acepta IDs tipo "prd-123", alfanum, guion, guion_bajo
const ProductoIdRegex = /^[A-Za-z0-9\-_]{1,20}$/;

const Common = {
  id: {
    required: true,
    type: 'number',
    min: 1,
    messages: {
      required: 'id es obligatorio',
      type: 'id debe ser numérico',
      min: 'id inválido'
    }
  },
  producto_id: {
    required: true,
    type: 'string',
    maxLength: 20,
    pattern: ProductoIdRegex,
    messages: {
      required: 'producto_id es obligatorio',
      type: 'producto_id debe ser texto',
      maxLength: 'producto_id no puede exceder 20 caracteres',
      pattern: 'producto_id tiene formato inválido'
    }
  },
  categoria_id: {
    required: true,
    type: 'number',
    min: 1,
    messages: {
      required: 'categoria_id es obligatorio',
      type: 'categoria_id debe ser numérico',
      min: 'categoria_id inválido'
    }
  }
};

module.exports = {
  // POST /imagenes/productos/upload
  UploadProductoRules: {
    producto_id: Common.producto_id
  },

  // POST /imagenes/categorias/upload
  UploadCategoriaRules: {
    categoria_id: Common.categoria_id
  },

  // GET /imagenes/productos/:producto_id
  GetByProductoRules: {
    producto_id: Common.producto_id
  },

  // GET /imagenes/categorias/:categoria_id
  GetByCategoriaRules: {
    categoria_id: Common.categoria_id
  },

  // DELETE /imagenes/productos/:id y /imagenes/categorias/:id
  DeleteRules: {
    id: Common.id
  }
};
