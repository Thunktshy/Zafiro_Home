// Server/Validators/Rulesets/datos_personales.js

const ClienteIdRegex  = /^[A-Za-z0-9\-]{1,20}$/;
const NameRegex       = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s\.\'\-]{1,50}$/;
const LastnameRegex   = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s\.\'\-]{1,100}$/;
const PhoneRegex      = /^[0-9+\-\s()]{1,20}$/;
const CityCountryRegex= /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s\.\'\-]{1,50}$/;
const PostalRegex     = /^[A-Za-z0-9\-]{1,10}$/;
// Dirección: amplio pero controlado
const AddressRegex    = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s\.\,\#\-\(\)\/]{1,200}$/;

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
  nombre: {
    required: true,
    type: 'string',
    maxLength: 50,
    pattern: NameRegex,
    messages: {
      required: 'nombre es obligatorio',
      type: 'nombre debe ser texto',
      maxLength: 'nombre no puede exceder 50 caracteres',
      pattern: 'nombre tiene formato inválido'
    }
  },
  apellidos: {
    required: true,
    type: 'string',
    maxLength: 100,
    pattern: LastnameRegex,
    messages: {
      required: 'apellidos es obligatorio',
      type: 'apellidos debe ser texto',
      maxLength: 'apellidos no puede exceder 100 caracteres',
      pattern: 'apellidos tiene formato inválido'
    }
  },
  telefono: {
    required: false,
    type: 'string',
    maxLength: 20,
    pattern: PhoneRegex,
    messages: {
      type: 'telefono debe ser texto',
      maxLength: 'telefono no puede exceder 20 caracteres',
      pattern: 'telefono tiene formato inválido'
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
  }
};

module.exports = {
  InsertRules: {
    cliente_id: Common.cliente_id,
    nombre: Common.nombre,
    apellidos: Common.apellidos,
    telefono: Common.telefono,
    direccion: Common.direccion,
    ciudad: Common.ciudad,
    codigo_postal: Common.codigo_postal,
    pais: Common.pais
  },
  UpdateRules: {
    cliente_id: Common.cliente_id,
    nombre: Common.nombre,
    apellidos: Common.apellidos,
    telefono: Common.telefono,
    direccion: Common.direccion,
    ciudad: Common.ciudad,
    codigo_postal: Common.codigo_postal,
    pais: Common.pais
  },
  DeleteRules: {
    cliente_id: Common.cliente_id
  },
  SelectByClienteRules: {
    cliente_id: Common.cliente_id
  }
};
