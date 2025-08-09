module.exports = {
  cliente_id: {
    required: true,
    type: 'string',
    maxLength: 20,
    trim: true,
    messages: {
      required: 'El ID de cliente es obligatorio',
      type: 'El ID de cliente debe ser texto',
      maxLength: 'El ID de cliente no puede exceder 20 caracteres',
      pattern: 'El ID de cliente contiene caracteres inválidos'
    },
    // Example pattern if client IDs have specific format (adjust as needed)
    pattern: /^[A-Z0-9_-]+$/i
  },
  nombre: {
    required: true,
    type: 'string',
    maxLength: 50,
    trim: true,
    messages: {
      required: 'El nombre es obligatorio',
      type: 'El nombre debe ser texto',
      maxLength: 'El nombre no puede exceder 50 caracteres',
      pattern: 'El nombre contiene caracteres inválidos'
    },
    // Allows letters, spaces, and common name characters
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/
  },
  apellidos: {
    required: true,
    type: 'string',
    maxLength: 100,
    trim: true,
    messages: {
      required: 'Los apellidos son obligatorios',
      type: 'Los apellidos deben ser texto',
      maxLength: 'Los apellidos no pueden exceder 100 caracteres',
      pattern: 'Los apellidos contienen caracteres inválidos'
    },
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/
  },
  telefono: {
    required: false,
    type: 'string',
    maxLength: 20,
    trim: true,
    messages: {
      type: 'El teléfono debe ser texto',
      maxLength: 'El teléfono no puede exceder 20 caracteres',
      pattern: 'El teléfono solo puede contener números, espacios y los caracteres +-()'
    },
    // Allows numbers, spaces, +, -, (, )
    pattern: /^[\d\s+()-]+$/
  },
  direccion: {
    required: false,
    type: 'string',
    maxLength: 200,
    trim: true,
    messages: {
      type: 'La dirección debe ser texto',
      maxLength: 'La dirección no puede exceder 200 caracteres'
    }
  },
  ciudad: {
    required: false,
    type: 'string',
    maxLength: 50,
    trim: true,
    messages: {
      type: 'La ciudad debe ser texto',
      maxLength: 'La ciudad no puede exceder 50 caracteres',
      pattern: 'La ciudad contiene caracteres inválidos'
    },
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/
  },
  codigo_postal: {
    required: false,
    type: 'string',
    maxLength: 10,
    trim: true,
    messages: {
      type: 'El código postal debe ser texto',
      maxLength: 'El código postal no puede exceder 10 caracteres',
      pattern: 'El código postal contiene caracteres inválidos'
    },
    // Basic postal code pattern (adjust for your country's format)
    pattern: /^[A-Z0-9-]+$/
  },
  pais: {
    required: false,
    type: 'string',
    maxLength: 50,
    trim: true,
    messages: {
      type: 'El país debe ser texto',
      maxLength: 'El país no puede exceder 50 caracteres',
      pattern: 'El país contiene caracteres inválidos'
    },
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/
  },
};