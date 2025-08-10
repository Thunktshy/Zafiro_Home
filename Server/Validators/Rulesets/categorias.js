// Server/Validators/Rulesets/categorias.js

const NombreCategoriaRegex = /^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü\s\.\,\-_]{1,50}$/;
// Permitimos rutas relativas tipo Protected/img/categorias/123-file.jpg (jpg/png/gif)
const ImagePathRegex = /^[-A-Za-z0-9_\/\.]{1,255}\.(jpe?g|png|gif)$/i;

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
  },
  image_path: {
    required: false,
    type: 'string',
    maxLength: 255,
    pattern: ImagePathRegex,
    messages: {
      type: 'image_path debe ser texto',
      maxLength: 'image_path no puede exceder 255 caracteres',
      pattern: 'image_path tiene formato inválido'
    }
  }
};

module.exports = {
  InsertRules: {
    nombre_categoria: Common.nombre_categoria,
    descripcion: Common.descripcion,
    image_path: Common.image_path
  },
  UpdateRules: {
    categoria_id: Common.categoria_id,
    nombre_categoria: Common.nombre_categoria,
    descripcion: Common.descripcion,
    image_path: Common.image_path
  },
  DeleteRules: {
    categoria_id: Common.categoria_id
  }
};
