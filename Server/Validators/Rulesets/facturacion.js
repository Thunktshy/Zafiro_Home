module.exports = {
  cliente_id: {
    required: true,
    type: 'string',
    maxLength: 20,
    trim: true,
    messages: {
      required: 'El ID de cliente es obligatorio',
      type: 'El ID de cliente debe ser texto',
      maxLength: 'El ID de cliente no puede exceder 20 caracteres'
    },
    pattern: /^[A-Z0-9_-]+$/i
  },
  rfc: {
    required: true,
    type: 'string',
    exactLength: 13, // For persona moral (12 for persona física)
    trim: true,
    uppercase: true,
    messages: {
      required: 'El RFC es obligatorio',
      type: 'El RFC debe ser texto',
      exactLength: 'El RFC debe tener exactamente 13 caracteres',
      pattern: 'El formato del RFC es inválido'
    },
    pattern: /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/
  },
  razon_social: {
    required: true,
    type: 'string',
    maxLength: 100,
    trim: true,
    messages: {
      required: 'La razón social es obligatoria',
      type: 'La razón social debe ser texto',
      maxLength: 'La razón social no puede exceder 100 caracteres',
      pattern: 'La razón social contiene caracteres inválidos'
    },
    pattern: /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ&%$#@()\s\.,-]+$/
  },
  direccion_fiscal: {
    required: false,
    type: 'string',
    maxLength: 200,
    trim: true,
    messages: {
      type: 'La dirección fiscal debe ser texto',
      maxLength: 'La dirección fiscal no puede exceder 200 caracteres'
    }
  },
};