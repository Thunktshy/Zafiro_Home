// Server/routes/clientesRoute.js
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const {
  InsertRules,
  UpdateRules,
  DeleteRules,
  SoftDeleteRules,
  RegistrarLoginRules,
  PorIdRules,
  ReactivarRules,
  BuscarClienteRules
} = require('../Validators/Rulesets/clientes.js');

const ClientesRouter = express.Router();
const { requireAdmin } = require('../routes/authRoute.js');
const { requireClient } = require('../routes/authRoute.js');
const { requireAuth } = require('../routes/authRoute.js');

// helper
function BuildParams(entries){ const p={}; for(const e of entries){ p[e.name]={type:e.type,value:e.value}; } return p; }

/* INSERT -> clientes_insert(@cuenta,@contrasena,@email) */
ClientesRouter.post('/insert', async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (insert)', errors });

    const hashed = await bcrypt.hash(Body.contrasena, SALT_ROUNDS);
    const Params = BuildParams([
      { name:'cuenta',     type: sql.NVarChar(20),  value: Body.cuenta },
      { name:'contrasena', type: sql.NVarChar(255), value: hashed },
      { name:'email',      type: sql.NVarChar(150), value: Body.email }
    ]);

    const data = await db.executeProc('clientes_insert', Params);
    return res.status(201).json({ success:true, message:'Cliente creado', data });
  } catch (err) {
    console.error('clientes_insert error:', err);
    return res.status(500).json({ success:false, message:'Error al crear el cliente' });
  }
});

/* UPDATE -> clientes_update(@id,@cuenta,@email)  (SP normaliza 'cl-') */
ClientesRouter.post('/update', requireAuth, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (update)', errors });

    const Params = BuildParams([
      { name:'id',     type: sql.NVarChar(20),  value: Body.cliente_id },
      { name:'cuenta', type: sql.NVarChar(20),  value: Body.cuenta },
      { name:'email',  type: sql.NVarChar(150), value: Body.email }
    ]);

    await db.executeProc('clientes_update', Params);
    return res.status(200).json({ success:true, message:'Cliente actualizado' });
  } catch (err) {
    console.error('clientes_update error:', err);
    return res.status(500).json({ success:false, message:'Error al actualizar el cliente' });
  }
});

/* DELETE (hard) -> clientes_delete(@id) */
ClientesRouter.post('/delete', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (delete)', errors });

    const Params = BuildParams([{ name:'id', type: sql.NVarChar(20), value: Body.cliente_id }]);
    await db.executeProc('clientes_delete', Params);
    return res.status(200).json({ success:true, message:'Cliente eliminado' });
  } catch (err) {
    console.error('clientes_delete error:', err);
    return res.status(500).json({ success:false, message:'Error al eliminar el cliente' });
  }
});

/* SOFT DELETE -> clientes_soft_delete(@id) (estado=0) */
ClientesRouter.post('/soft_delete', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, SoftDeleteRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (soft_delete)', errors });

    const Params = BuildParams([{ name:'id', type: sql.NVarChar(20), value: Body.cliente_id }]);
    const data = await db.executeProc('clientes_soft_delete', Params);
    return res.status(200).json({ success:true, message:'Cliente desactivado', data });
  } catch (err) {
    console.error('clientes_soft_delete error:', err);
    return res.status(500).json({ success:false, message:'Error al desactivar el cliente' });
  }
});

/* REACTIVAR -> clientes_reactivar(@id) (estado=1) */
ClientesRouter.post('/reactivar', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, ReactivarRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (reactivar)', errors });

    const Params = BuildParams([{ name:'id', type: sql.NVarChar(20), value: Body.cliente_id }]);
    const data = await db.executeProc('clientes_reactivar', Params);
    return res.status(200).json({ success:true, message:'Cliente reactivado', data });
  } catch (err) {
    console.error('clientes_reactivar error:', err);
    return res.status(500).json({ success:false, message:'Error al reactivar el cliente' });
  }
});

/* REGISTRAR LOGIN -> clientes_registrar_login(@id) */
ClientesRouter.post('/registrar_login', async (req, res) => {
  try {
    const Body = req.body;
    const { isValid, errors } = await ValidationService.validateData(Body, RegistrarLoginRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (registrar_login)', errors });

    const Params = BuildParams([{ name:'id', type: sql.NVarChar(20), value: Body.cliente_id }]);
    await db.executeProc('clientes_registrar_login', Params);
    return res.status(200).json({ success:true, message:'Último acceso registrado' });
  } catch (err) {
    console.error('clientes_registrar_login error:', err);
    return res.status(500).json({ success:false, message:'Error al registrar login' });
  }
});

/* POR ID -> cliente_por_id(@id) */
ClientesRouter.get('/por_id/:id', async (req, res) => {
  try {
    const Body = { cliente_id: String(req.params.id) };
    const { isValid, errors } = await ValidationService.validateData(Body, PorIdRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (por_id)', errors });

    const Params = BuildParams([{ name:'id', type: sql.NVarChar(20), value: Body.cliente_id }]);
    const data = await db.executeProc('cliente_por_id', Params);
    if (!data.length) return res.status(404).json({ success:false, message:'Cliente no encontrado' });
    return res.status(200).json({ success:true, message:'Cliente obtenido', data: data[0] });
  } catch (err) {
    console.error('cliente_por_id error:', err);
    return res.status(500).json({ success:false, message:'Error al obtener el cliente' });
  }
});

/* SEARCH -> buscar_cliente(@termino_busqueda,@solo_activos) */
ClientesRouter.get('/search', requireAuth, async (req, res) => {
  try {
    const Body = { termino_busqueda: String(req.query.term || ''), solo_activos: req.query.solo_activos === '0' ? 0 : 1 };
    const { isValid, errors } = await ValidationService.validateData(Body, BuscarClienteRules);
    if (!isValid) return res.status(400).json({ success:false, message:'Datos inválidos (search)', errors });

    const Params = BuildParams([
      { name:'termino_busqueda', type: sql.NVarChar(150), value: Body.termino_busqueda },
      { name:'solo_activos',     type: sql.Bit,           value: Body.solo_activos }
    ]);
    const data = await db.executeProc('buscar_cliente', Params);
    return res.status(200).json({ success:true, message:'Resultados de búsqueda', data });
  } catch (err) {
    console.error('buscar_cliente error:', err);
    return res.status(500).json({ success:false, message:'Error al buscar clientes' });
  }
});

module.exports = ClientesRouter;
