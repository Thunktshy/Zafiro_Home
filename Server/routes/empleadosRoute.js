// Server/routes/empleadosRoute.js
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const {
  InsertRules, UpdateRules, DeleteRules, SoftDeleteRules,
  ReactivarRules, RegistrarLoginRules, PorIdRules
} = require('../Validators/Rulesets/empleados.js');

const { requireAdmin } = require('./authRoute.js');
const EmpleadosRouter = express.Router();

function BuildParams(entries){
  const p = {};
  for(const e of entries) p[e.name] = { type: e.type, value: e.value };
  return p;
}

// Mapea errores por mensaje (los SP no emiten códigos numéricos)
function MapSqlErrorToHttp(err){
  if(!err) return null;
  const msg = String(err.message || '').toLowerCase();
  if (msg.includes('la cuenta ya existe')) return { code:409, message:'La cuenta ya existe' };
  if (msg.includes('email ya está registrado') || msg.includes('email ya está en uso')) return { code:409, message:'El email ya está en uso' };
  if (msg.includes('empleado_id no existe')) return { code:404, message:'empleado_id no existe' };
  if (msg.includes('ya está desactivado')) return { code:409, message:'El empleado ya está desactivado' };
  if (msg.includes('ya está activo')) return { code:409, message:'El empleado ya está activo' };
  return null;
}

/* INSERT -> empleados_insert(@cuenta,@contrasena,@email) */
EmpleadosRouter.post('/insert', requireAdmin, async (req,res)=>{
  try{
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, InsertRules);
    if(!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (insert)', errors });

    const hashed = await bcrypt.hash(Body.contrasena, SALT_ROUNDS); // como clientes
    const Params = BuildParams([
      { name:'cuenta',     type: sql.NVarChar(20),  value: Body.cuenta },
      { name:'contrasena', type: sql.NVarChar(255), value: hashed },
      { name:'email',      type: sql.NVarChar(150), value: Body.email }
    ]);

    await db.executeProc('empleados_insert', Params);
    return res.status(201).json({ success:true, message:'Empleado creado correctamente' });
  }catch(err){
    console.error('empleados_insert error:', err);
    const mapped = MapSqlErrorToHttp(err);
    if (mapped) return res.status(mapped.code).json({ success:false, message:mapped.message });
    return res.status(500).json({ success:false, message:'Error al crear el empleado' });
  }
});

/* UPDATE -> empleados_update(@empleado_id,@cuenta,@email,@puesto) */
EmpleadosRouter.post('/update', requireAdmin, async (req,res)=>{
  try{
    const Body = { ...req.body, empleado_id: Number(req.body.empleado_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, UpdateRules);
    if(!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (update)', errors });

    const Params = BuildParams([
      { name:'empleado_id', type: sql.Int,          value: Body.empleado_id },
      { name:'cuenta',      type: sql.NVarChar(20), value: Body.cuenta },
      { name:'email',       type: sql.NVarChar(150),value: Body.email },
      { name:'puesto',      type: sql.NVarChar(30), value: Body.puesto }
    ]);

    await db.executeProc('empleados_update', Params);
    return res.status(200).json({ success:true, message:'Empleado actualizado correctamente' });
  }catch(err){
    console.error('empleados_update error:', err);
    const mapped = MapSqlErrorToHttp(err);
    if (mapped) return res.status(mapped.code).json({ success:false, message:mapped.message });
    return res.status(500).json({ success:false, message:'Error al actualizar el empleado' });
  }
});

/* DELETE -> empleados_delete(@empleado_id) */
EmpleadosRouter.post('/delete', requireAdmin, async (req,res)=>{
  try{
    const Body = { empleado_id: Number(req.body.empleado_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, DeleteRules);
    if(!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (delete)', errors });

    const Params = BuildParams([{ name:'empleado_id', type: sql.Int, value: Body.empleado_id }]);
    await db.executeProc('empleados_delete', Params);
    return res.status(200).json({ success:true, message:'Empleado eliminado correctamente' });
  }catch(err){
    console.error('empleados_delete error:', err);
    const mapped = MapSqlErrorToHttp(err);
    if (mapped) return res.status(mapped.code).json({ success:false, message:mapped.message });
    return res.status(500).json({ success:false, message:'Error al eliminar el empleado' });
  }
});

/* SOFT DELETE -> empleados_soft_delete(@empleado_id) */
EmpleadosRouter.post('/soft_delete', requireAdmin, async (req,res)=>{
  try{
    const Body = { empleado_id: Number(req.body.empleado_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, SoftDeleteRules);
    if(!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (soft_delete)', errors });

    const Params = BuildParams([{ name:'empleado_id', type: sql.Int, value: Body.empleado_id }]);
    await db.executeProc('empleados_soft_delete', Params);
    return res.status(200).json({ success:true, message:'Empleado desactivado correctamente' });
  }catch(err){
    console.error('empleados_soft_delete error:', err);
    const mapped = MapSqlErrorToHttp(err);
    if (mapped) return res.status(mapped.code).json({ success:false, message:mapped.message });
    return res.status(500).json({ success:false, message:'Error al desactivar el empleado' });
  }
});

/* REACTIVAR -> empleados_reactivar(@empleado_id) */
EmpleadosRouter.post('/reactivar', requireAdmin, async (req,res)=>{
  try{
    const Body = { empleado_id: Number(req.body.empleado_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, ReactivarRules);
    if(!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (reactivar)', errors });

    const Params = BuildParams([{ name:'empleado_id', type: sql.Int, value: Body.empleado_id }]);
    await db.executeProc('empleados_reactivar', Params);
    return res.status(200).json({ success:true, message:'Empleado reactivado correctamente' });
  }catch(err){
    console.error('empleados_reactivar error:', err);
    const mapped = MapSqlErrorToHttp(err);
    if (mapped) return res.status(mapped.code).json({ success:false, message:mapped.message });
    return res.status(500).json({ success:false, message:'Error al reactivar el empleado' });
  }
});

/* REGISTRAR LOGIN -> empleados_registrar_login(@empleado_id) */
EmpleadosRouter.post('/registrar_login', requireAdmin, async (req,res)=>{
  try{
    const Body = { empleado_id: Number(req.body.empleado_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, RegistrarLoginRules);
    if(!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (registrar_login)', errors });

    const Params = BuildParams([{ name:'empleado_id', type: sql.Int, value: Body.empleado_id }]);
    await db.executeProc('empleados_registrar_login', Params);
    return res.status(200).json({ success:true, message:'Último acceso registrado' });
  }catch(err){
    console.error('empleados_registrar_login error:', err);
    return res.status(500).json({ success:false, message:'Error al registrar login' });
  }
});

/* POR ID -> empleados_por_id(@empleado_id) */
EmpleadosRouter.get('/por_id/:empleado_id', requireAdmin, async (req,res)=>{
  try{
    const Body = { empleado_id: Number(req.params.empleado_id) };
    const { isValid, errors } = await ValidationService.validateData(Body, PorIdRules);
    if(!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (por_id)', errors });

    const Params = BuildParams([{ name:'empleado_id', type: sql.Int, value: Body.empleado_id }]);
    const data = await db.executeProc('empleados_por_id', Params);
    if(!data.length) return res.status(404).json({ success:false, message:'Empleado no encontrado' });
    return res.status(200).json({ success:true, message:'Empleado obtenido', data: data[0] });
  }catch(err){
    console.error('empleados_por_id error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener el empleado' });
  }
});

/* SEARCH -> buscar_empleado(@termino_busqueda,@solo_activos) */
EmpleadosRouter.get('/search', requireAdmin, async (req,res)=>{
  try{
    const term = String(req.query.term || '');
    const solo_activos = req.query.solo_activos === '0' ? 0 : 1;
    const Params = BuildParams([
      { name:'termino_busqueda', type: sql.NVarChar(150), value: term },
      { name:'solo_activos',     type: sql.Bit,           value: solo_activos }
    ]);
    const data = await db.executeProc('buscar_empleado', Params);
    return res.status(200).json({ success:true, message:'Resultados de búsqueda', data });
  }catch(err){
    console.error('buscar_empleado error:', err);
    return res.status(500).json({ success:false, message:'Error al buscar empleados' });
  }
});

// GET /empleados/select_all -> empleados_select_all (Admin)
EmpleadosRouter.get('/select_all', requireAdmin, async (_req, res) => {
  try {
    const data = await db.executeProc('empleados_select_all', {});
    return res.status(200).json({
      success: true,
      message: data.length ? 'Empleados listados' : 'Sin empleados',
      data
    });
  } catch (err) {
    console.error('empleados_select_all error:', err);
    return res.status(500).json({ success: false, message: 'Error al listar empleados', data: [] });
  }
});


module.exports = EmpleadosRouter;
