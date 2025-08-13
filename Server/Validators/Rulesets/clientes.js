// Server/Validators/Rulesets/clientes.js
const EmailRegex  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CuentaRegex = /^[A-Za-z0-9._\-]{1,20}$/;

const Common = {
  id: { required: true, type: 'string', maxLength: 20,
    messages: { required: 'cliente_id es obligatorio', type: 'cliente_id debe ser texto', maxLength: 'cliente_id no puede exceder 20' } },
  cuenta: { required: true, type: 'string', maxLength: 20, pattern: CuentaRegex,
    messages: { required: 'cuenta es obligatoria', type: 'cuenta debe ser texto', maxLength: 'cuenta no puede exceder 20', pattern: 'cuenta inválida' } },
  email: { required: true, type: 'string', maxLength: 150, pattern: EmailRegex,
    messages: { required: 'email es obligatorio', type: 'email debe ser texto', maxLength: 'email no puede exceder 150', pattern: 'email inválido' } },
  contrasena: { required: true, type: 'string', maxLength: 255,
    messages: { required: 'contrasena es obligatoria', type: 'contrasena debe ser texto', maxLength: 'contrasena no puede exceder 255' } },
  termino_busqueda: { required: true, type: 'string', maxLength: 150,
    messages: { required: 'termino_busqueda es obligatorio', type: 'termino_busqueda debe ser texto', maxLength: 'termino_busqueda no puede exceder 150' } },
  solo_activos: { required: true, type: 'number',
    messages: { required: 'solo_activos es obligatorio', type: 'solo_activos debe ser numérico (0|1)' } }
};

module.exports = {
  // INSERT
  InsertRules: { cuenta: Common.cuenta, contrasena: Common.contrasena, email: Common.email },

  // UPDATE (el router usa @id y el SP normaliza 'cl-')
  UpdateRules: { cliente_id: Common.id, cuenta: Common.cuenta, email: Common.email },

  // DELETE / SOFT / REACTIVAR / REGISTRAR_LOGIN / POR_ID
  DeleteRules:          { cliente_id: Common.id },
  SoftDeleteRules:      { cliente_id: Common.id },
  ReactivarRules:       { cliente_id: Common.id },
  RegistrarLoginRules:  { cliente_id: Common.id },
  PorIdRules:           { cliente_id: Common.id },

  // SEARCH (la pieza que faltaba)
  BuscarClienteRules: { termino_busqueda: Common.termino_busqueda, solo_activos: Common.solo_activos }
};
