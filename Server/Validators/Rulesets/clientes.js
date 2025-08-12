// Server/Validators/Rulesets/empleados.js
const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CuentaRegex = /^[A-Za-z0-9._\-]{1,20}$/;

const Common = {
  empleado_id: { required:true, type:'number', messages:{ required:'empleado_id es obligatorio', type:'empleado_id debe ser numérico' } },
  cuenta: { required:true, type:'string', maxLength:20, pattern:CuentaRegex,
    messages:{ required:'cuenta es obligatoria', type:'cuenta debe ser texto', maxLength:'cuenta no puede exceder 20', pattern:'cuenta inválida' } },
  email: { required:true, type:'string', maxLength:150, pattern:EmailRegex,
    messages:{ required:'email es obligatorio', type:'email debe ser texto', maxLength:'email no puede exceder 150', pattern:'email inválido' } },
  contrasena: { required:true, type:'string', maxLength:255,
    messages:{ required:'contrasena es obligatoria', type:'contrasena debe ser texto', maxLength:'contrasena no puede exceder 255' } },
  puesto: { required:true, type:'string', maxLength:30,
    messages:{ required:'puesto es obligatorio', type:'puesto debe ser texto', maxLength:'puesto no puede exceder 30' } },
  termino_busqueda: { required:true, type:'string', maxLength:150,
    messages:{ required:'termino_busqueda es obligatorio', type:'termino_busqueda debe ser texto', maxLength:'termino_busqueda no puede exceder 150' } }
};

module.exports = {
  InsertRules: { cuenta:Common.cuenta, contrasena:Common.contrasena, email:Common.email },
  UpdateRules: { empleado_id:Common.empleado_id, cuenta:Common.cuenta, email:Common.email, puesto:Common.puesto },
  DeleteRules: { empleado_id:Common.empleado_id },
  SoftDeleteRules: { empleado_id:Common.empleado_id },
  ReactivarRules: { empleado_id:Common.empleado_id },
  RegistrarLoginRules: { empleado_id:Common.empleado_id },
  PorIdRules: { empleado_id:Common.empleado_id },
  BuscarRules: { termino_busqueda: Common.termino_busqueda }
};
