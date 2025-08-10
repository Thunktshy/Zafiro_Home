// Server/Validators/Rulesets/metodos_pago.js
// Código en PascalCase/Inglés; mensajes en español.

const ClienteIdRegex   = /^[A-Za-z0-9\-]{1,20}$/;
const TipoRegex        = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\-_]{1,20}$/;
const AddressRegex     = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\#\-\(\)\/]{1,200}$/;
const CityCountryRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s\.\'\-]{1,50}$/;
const PostalRegex      = /^[A-Za-z0-9\-]{1,10}$/;

const Common = {
  metodo_id: {
    required: true,
    type: 'number',
    messages: {
      required: 'metodo_id es obligatorio',
      type: 'metodo_id debe ser numérico'
    }
  },
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
  tipo: {
    required: true,
    type: 'string',
    maxLength: 20,
    pattern: TipoRegex,
    messages: {
      required: 'tipo es obligatorio',
      type: 'tipo debe ser texto',
      maxLength: 'tipo no puede exceder 20 caracteres',
      pattern: 'tipo tiene formato inválido'
    }
  },
  direccion: {
    required: false,
    type: 'string',
    maxLength: 200,
    pattern: AddressRegex,
    messages: {
      type: 'direccion debe ser texto',
      maxLength: 'direccion no puede exceder 200 caracteres',
      pattern: 'direccion tiene formato inválido'
    }
  },
  ciudad: {
    required: false,
    type: 'string',
    maxLength: 50,
    pattern: CityCountryRegex,
    messages: {
      type: 'ciudad debe ser texto',
      maxLength: 'ciudad no puede exceder 50 caracteres',
      pattern: 'ciudad tiene formato inválido'
    }
  },
  codigo_postal: {
    required: false,
    type: 'string',
    maxLength: 10,
    pattern: PostalRegex,
    messages: {
      type: 'codigo_postal debe ser texto',
      maxLength: 'codigo_postal no puede exceder 10 caracteres',
      pattern: 'codigo_postal tiene formato inválido'
    }
  },
  pais: {
    required: false,
    type: 'string',
    maxLength: 50,
    pattern: CityCountryRegex,
    messages: {
      type: 'pais debe ser texto',
      maxLength: 'pais no puede exceder 50 caracteres',
      pattern: 'pais tiene formato inválido'
    }
  },
  es_principal: {
    required: false,
    type: 'number', // 0 o 1; en ruta lo convertimos con Number()
    messages: {
      type: 'es_principal debe ser numérico (0 o 1)'
    }
  }
};

module.exports = {
  InsertRules: {
    cliente_id: Common.cliente_id,
    tipo: Common.tipo,
    direccion: Common.direccion,
    ciudad: Common.ciudad,
    codigo_postal: Common.codigo_postal,
    pais: Common.pais,
    es_principal: Common.es_principal
  },
  UpdateRules: {
    metodo_id: Common.metodo_id,
    tipo: Common.tipo,
    direccion: Common.direccion,
    ciudad: Common.ciudad,
    codigo_postal: Common.codigo_postal,
    pais: Common.pais,
    es_principal: Common.es_principal
  },
  DeleteRules: {
    metodo_id: Common.metodo_id
  },
  SelectByClienteRules: {
    cliente_id: Common.cliente_id
  }
};
