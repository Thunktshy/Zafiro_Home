// Server/Validators/Rulesets/categorias.js

// Letras, números, espacios y puntuación básica ES; hasta 50 chars
const NombreCategoriaRegex = /^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü\s\.\,\-_]{1,50}$/;

const Common = {
  categoria_id: {
    required: true,
    type: 'number',
    messages: {
      required: 'categoria_id es obligatorio',
      type: 'categoria_id debe ser numérico'
    }
  },
  nombre_categoria: {
    required: true,
    type: 'string',
    maxLength: 50,
    pattern: NombreCategoriaRegex,
    messages: {
      required: 'nombre_categoria es obligatorio',
      type: 'nombre_categoria debe ser texto',
      maxLength: 'nombre_categoria no puede exceder 50 caracteres',
      pattern: 'nombre_categoria tiene formato inválido'
    }
  },
  descripcion: {
    required: false,
    type: 'string',
    maxLength: 255,
    messages: {
      type: 'descripcion debe ser texto',
      maxLength: 'descripcion no puede exceder 255 caracteres'
    }
  }
};

module.exports = {
  InsertRules: {
    nombre_categoria: Common.nombre_categoria,
    descripcion: Common.descripcion
  },
  UpdateRules: {
    categoria_id: Common.categoria_id,
    nombre_categoria: Common.nombre_categoria,
    descripcion: Common.descripcion
  },
  DeleteRules: {
    categoria_id: Common.categoria_id
  },
  GetByIdRules: {
    categoria_id: Common.categoria_id
  }
};
