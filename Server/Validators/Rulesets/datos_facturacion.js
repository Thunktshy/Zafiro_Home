// Server/Validators/Rulesets/datos_facturacion.js

const ClienteIdRegex   = /^[A-Za-z0-9\-]{1,20}$/;
// RFC: permitimos 12–13 alfanuméricos (flexible para RFC moral/física)
const RfcRegex         = /^[A-ZÑ&0-9]{12,13}$/i;
// Razon social: letras, números, espacios y signos comunes
const RazonSocialRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\-&'"]{1,100}$/;
// Dirección fiscal amplia
const DireccionRegex   = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\#\-\(\)\/]{1,200}$/;

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
  rfc: {
    required: true,
    type: 'string',
    maxLength: 13,
    pattern: RfcRegex,
    messages: {
      required: 'rfc es obligatorio',
      type: 'rfc debe ser texto',
      maxLength: 'rfc no puede exceder 13 caracteres',
      pattern: 'rfc tiene formato inválido'
    }
  },
  razon_social: {
    required: true,
    type: 'string',
    maxLength: 100,
    pattern: RazonSocialRegex,
    messages: {
      required: 'razon_social es obligatorio',
      type: 'razon_social debe ser texto',
      maxLength: 'razon_social no puede exceder 100 caracteres',
      pattern: 'razon_social tiene formato inválido'
    }
  },
  direccion_fiscal: {
    required: false,
    type: 'string',
    maxLength: 200,
    pattern: DireccionRegex,
    messages: {
      type: 'direccion_fiscal debe ser texto',
      maxLength: 'direccion_fiscal no puede exceder 200 caracteres',
      pattern: 'direccion_fiscal tiene formato inválido'
    }
  }
};

module.exports = {
  InsertRules: {
    cliente_id: Common.cliente_id,
    rfc: Common.rfc,
    razon_social: Common.razon_social,
    direccion_fiscal: Common.direccion_fiscal
  },
  UpdateRules: {
    cliente_id: Common.cliente_id,
    rfc: Common.rfc,
    razon_social: Common.razon_social,
    direccion_fiscal: Common.direccion_fiscal
  },
  DeleteRules: {
    cliente_id: Common.cliente_id
  },
  SelectByClienteRules: {
    cliente_id: Common.cliente_id
  }
};
