// Server/Validators/Rulesets/empleados.js

const EmailRegex  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CuentaRegex = /^[A-Za-z0-9._\-]{1,20}$/;
// Puesto: letras (con acentos), espacios y .,-_
const PuestoRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s\.\,\-_]{1,30}$/;

const Common = {
  empleado_id: {
    required: true,
    type: 'number',
    messages: {
      required: 'empleado_id es obligatorio',
      type: 'empleado_id debe ser numérico'
    }
  },
  cuenta: {
    required: true,
    type: 'string',
    maxLength: 20,
    pattern: CuentaRegex,
    messages: {
      required: 'cuenta es obligatoria',
      type: 'cuenta debe ser texto',
      maxLength: 'cuenta no puede exceder 20 caracteres',
      pattern: 'cuenta tiene formato inválido'
    }
  },
  contrasena: {
    required: true,
    type: 'string',
    maxLength: 255,
    messages: {
      required: 'contrasena es obligatoria',
      type: 'contrasena debe ser texto',
      maxLength: 'contrasena no puede exceder 255 caracteres'
    }
  },
  email: {
    required: true,
    type: 'string',
    maxLength: 150,
    pattern: EmailRegex,
    messages: {
      required: 'email es obligatorio',
      type: 'email debe ser texto',
      maxLength: 'email no puede exceder 150 caracteres',
      pattern: 'email tiene formato inválido'
    }
  },
  puesto: {
    required: true,
    type: 'string',
    maxLength: 30,
    pattern: PuestoRegex,
    messages: {
      required: 'puesto es obligatorio',
      type: 'puesto debe ser texto',
      maxLength: 'puesto no puede exceder 30 caracteres',
      pattern: 'puesto tiene formato inválido'
    }
  }
};

module.exports = {
  InsertRules: {
    cuenta: Common.cuenta,
    contrasena: Common.contrasena,
    email: Common.email
  },
  UpdateRules: {
    empleado_id: Common.empleado_id,
    cuenta: Common.cuenta,
    email: Common.email,
    puesto: Common.puesto
  },
  DeleteRules: {
    empleado_id: Common.empleado_id
  },
  SoftDeleteRules: {
    empleado_id: Common.empleado_id
  },
  ReactivarRules: {
    empleado_id: Common.empleado_id
  },
  RegistrarLoginRules: {
    empleado_id: Common.empleado_id
  },
  PorIdRules: {
    empleado_id: Common.empleado_id
  }
};
