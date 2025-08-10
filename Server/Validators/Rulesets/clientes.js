// Server/Validators/Rulesets/clientes.js

const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// cliente_id es del tipo "cl-<numero>", pero permitimos slug alfanumérico con guion
const ClienteIdRegex = /^[A-Za-z0-9\-]{1,20}$/;
// cuenta: max 20, alfanuméricos/._-
const CuentaRegex = /^[A-Za-z0-9._\-]{1,20}$/;

const Common = {
  cliente_id: {
    required: true,
    type: 'string',
    maxLength: 20,
    pattern: ClienteIdRegex,
    messages: {
      required: 'cliente_id es obligatorio',
      type: 'cliente_id debe ser texto',
      maxLength: 'cliente_id no puede exceder 20 caracteres',
      pattern: 'cliente_id tiene formato inválido'
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
  contrasena: {
    required: true,
    type: 'string',
    maxLength: 255,
    // No forzamos patrón del hash; permitimos cualquier string (ya llega hasheada).
    messages: {
      required: 'contrasena es obligatoria',
      type: 'contrasena debe ser texto',
      maxLength: 'contrasena no puede exceder 255 caracteres'
    }
  },
  termino_busqueda: {
    required: true,
    type: 'string',
    maxLength: 150,
    // Permitimos cualquier término; el SP decide si coincide.
    messages: {
      required: 'termino_busqueda es obligatorio',
      type: 'termino_busqueda debe ser texto',
      maxLength: 'termino_busqueda no puede exceder 150 caracteres'
    }
  }
};

// Rulesets por operación (solo incluyen los campos relevantes)
module.exports = {
  InsertRules: {
    cuenta: Common.cuenta,
    contrasena: Common.contrasena,
    email: Common.email
  },
  UpdateRules: {
    cliente_id: Common.cliente_id,
    cuenta: Common.cuenta,
    email: Common.email
  },
  DeleteRules: {
    cliente_id: Common.cliente_id
  },
  SoftDeleteRules: {
    cliente_id: Common.cliente_id
  },
  RegistrarLoginRules: {
    cliente_id: Common.cliente_id
  },
  PorIdRules: {
    cliente_id: Common.cliente_id
  },
  ReactivarRules: {
    cliente_id: Common.cliente_id
  },
  BuscarClienteRules: {
    termino_busqueda: Common.termino_busqueda
  }
};
