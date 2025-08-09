module.exports = {
  cliente_id: {
    required: true,
    type: 'string',
    maxLength: 20,
    messages: {
      required: 'El ID de cliente es obligatorio',
      maxLength: 'El ID de cliente no puede exceder 20 caracteres'
    },
    pattern: /^[A-Z0-9_-]+$/i
  },
  tipo: {
    required: true,
    type: 'string',
    messages: {
      required: 'El tipo de método de pago es obligatorio',
      invalidType: 'Tipo de pago no válido'
    },
    // Supported payment types
    enum: ['tarjeta_credito', 'tarjeta_debito', 'paypal', 'transferencia', 'efectivo']
  },
  datos: {
    required: true,
    type: 'object',
    messages: {
      required: 'Los datos del método de pago son obligatorios',
      type: 'Los datos deben ser un objeto'
    },
    // Dynamic validation based on payment type
    validateIf: (value, { tipo }) => {
      const validators = {
        tarjeta_credito: validateCreditCardData,
        tarjeta_debito: validateDebitCardData,
        paypal: validatePaypalData,
        transferencia: validateBankData,
        efectivo: () => ({ isValid: true }) // No additional data needed for cash
      };
      return validators[tipo](value);
    }
  },
  es_principal: {
    required: false,
    type: 'boolean',
    default: false,
    messages: {
      type: 'El campo es_principal debe ser verdadero o falso'
    }
  }
};

// ============ VALIDATION HELPERS ============ //

function validateCreditCardData(data) {
  const errors = [];
  const rules = {
    numero: {
      required: true,
      pattern: /^[0-9]{13,16}$/,
      messages: {
        required: 'El número de tarjeta es obligatorio',
        pattern: 'El número de tarjeta debe tener entre 13 y 16 dígitos'
      }
    },
    nombre_titular: {
      required: true,
      maxLength: 100,
      pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/,
      messages: {
        required: 'El nombre del titular es obligatorio',
        pattern: 'El nombre contiene caracteres inválidos'
      }
    },
    fecha_vencimiento: {
      required: true,
      pattern: /^(0[1-9]|1[0-2])\/?([0-9]{4}|[0-9]{2})$/,
      messages: {
        required: 'La fecha de vencimiento es obligatoria',
        pattern: 'Formato de fecha inválido (MM/YY o MM/YYYY)'
      }
    },
    cvv: {
      required: true,
      pattern: /^[0-9]{3,4}$/,
      messages: {
        required: 'El CVV es obligatorio',
        pattern: 'El CVV debe tener 3 o 4 dígitos'
      }
    }
  };

  // Validate each credit card field
  for (const [field, rule] of Object.entries(rules)) {
    if (rule.required && !data[field]) {
      errors.push({ field: `datos.${field}`, message: rule.messages.required });
      continue;
    }
    if (data[field] && rule.pattern && !rule.pattern.test(data[field])) {
      errors.push({ field: `datos.${field}`, message: rule.messages.pattern });
    }
  }

  return { isValid: errors.length === 0, errors };
}

function validateDebitCardData(data) {
  // Similar to credit card but might have different requirements
  return validateCreditCardData(data); // Can be adjusted if needed
}

function validatePaypalData(data) {
  const errors = [];
  const rules = {
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      messages: {
        required: 'El email de PayPal es obligatorio',
        pattern: 'El formato del email es inválido'
      }
    }
  };

  if (!data.email) {
    errors.push({ field: 'datos.email', message: rules.email.messages.required });
  } else if (!rules.email.pattern.test(data.email)) {
    errors.push({ field: 'datos.email', message: rules.email.messages.pattern });
  }

  return { isValid: errors.length === 0, errors };
}

function validateBankData(data) {
  const errors = [];
  const rules = {
    clabe: {
      required: true,
      pattern: /^[0-9]{18}$/,
      messages: {
        required: 'La CLABE es obligatoria',
        pattern: 'La CLABE debe tener 18 dígitos'
      }
    },
    banco: {
      required: true,
      maxLength: 50,
      messages: {
        required: 'El nombre del banco es obligatorio'
      }
    },
    nombre_titular: {
      required: true,
      maxLength: 100,
      pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/,
      messages: {
        required: 'El nombre del titular es obligatorio'
      }
    }
  };

  for (const [field, rule] of Object.entries(rules)) {
    if (rule.required && !data[field]) {
      errors.push({ field: `datos.${field}`, message: rule.messages.required });
      continue;
    }
    if (data[field] && rule.pattern && !rule.pattern.test(data[field])) {
      errors.push({ field: `datos.${field}`, message: rule.messages.pattern });
    }
  }

  return { isValid: errors.length === 0, errors };
}