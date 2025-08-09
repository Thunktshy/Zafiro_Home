// ruleset de validación para categorías (server-side)
module.exports = {
  categoria_id: {
    required: true,
    type: 'integer',
    min: 1,
    exists: { table: 'categorias', column: 'categoria_id' },
    messages: {
      required: 'El ID de categoría es obligatorio',
      type: 'El ID de categoría debe ser un número entero',
      min: 'El ID de categoría debe ser mayor que 0',
      exists: 'La categoría ya no se encuentra en la base de datos'
    }
  },
  nombre_categoria: {
    required: true,
    type: 'string',
    maxLength: 50,
    trim: true,
    unique: { table: 'categorias', column: 'nombre_categoria' },
    pattern: /^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü\s\.\,\-]+$/,
    messages: {
      required: 'El nombre de categoría es obligatorio',
      type: 'El nombre de categoría debe ser texto',
      maxLength: 'El nombre de categoría no puede exceder 50 caracteres',
      unique: 'La categoría ya existe',
      pattern: 'El nombre de categoría contiene caracteres inválidos'
    }
  },
  descripcion: {
    required: false,
    type: 'string',
    maxLength: 255,
    trim: true,
    messages: {
      type: 'La descripción debe ser texto',
      maxLength: 'La descripción no puede exceder 255 caracteres'
    }
  },
  image_path: {
    required: false,
    type: 'string',
    maxLength: 255,
    trim: true,
    pattern: /^(?!\s*$).+\.(jpg|jpeg|png|gif)$/i,
    messages: {
      type: 'La ruta de la imagen debe ser texto',
      maxLength: 'La ruta de la imagen no puede exceder 255 caracteres',
      pattern: 'La ruta de la imagen debe ser un archivo válido (jpg, jpeg, png, gif)'
    }
  }
};
