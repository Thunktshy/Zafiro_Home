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
  ReactivarRules
} = require('../Validators/Rulesets/clientes.js');

const { requireAdmin } = require('../routes/authRoute.js');

const ClientesRouter = express.Router();

// Helper para construir params tipados para executeProc
function BuildParams(Entries) {
  // Entries: [{ name, type, value }]
  const Params = {};
  for (const E of Entries) {
    Params[E.name] = { type: E.type, value: E.value };
  }
  return Params;
}

/* ============================================================================
   POST /clientes/insert -> SP: clientes_insert(@cuenta NVARCHAR(20), @contrasena NVARCHAR(255), @email NVARCHAR(150))
============================================================================ */
ClientesRouter.post('/insert', async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (insert)' });
    }

    // 1) Hash plain-text password from the request
    const hashed = await bcrypt.hash(Body.contrasena, SALT_ROUNDS);

    // 2) Build params using the HASHED password
    const Params = BuildParams([
      { name: 'cuenta',     type: sql.NVarChar(20),  value: Body.cuenta },
      { name: 'contrasena', type: sql.NVarChar(255), value: hashed },
      { name: 'email',      type: sql.NVarChar(150), value: Body.email }
    ]);

    await db.executeProc('clientes_insert', Params);
    return res.status(201).json({ success: true, message: 'Cliente creado correctamente' });
  } catch (Error_) {
    console.error('clientes_insert error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al crear el cliente' });
  }
});


/* ============================================================================
   POST /clientes/update    -> SP: clientes_update(@cliente_id NVARCHAR(20), @cuenta NVARCHAR(20), @email NVARCHAR(150))
============================================================================ */
ClientesRouter.post('/update', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (update)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20),  value: Body.cliente_id },
      { name: 'cuenta',     type: sql.NVarChar(20),  value: Body.cuenta },
      { name: 'email',      type: sql.NVarChar(150), value: Body.email }
    ]);

    await db.executeProc('clientes_update', Params);
    return res.status(200).json({ success: true, message: 'Cliente actualizado correctamente' });
  } catch (Error_) {
    console.error('clientes_update error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al actualizar el cliente' });
  }
});

/* ============================================================================
   POST /clientes/delete    -> SP: clientes_delete(@cliente_id NVARCHAR(20))
============================================================================ */
ClientesRouter.post('/delete', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (delete)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('clientes_delete', Params);
    return res.status(200).json({ success: true, message: 'Cliente eliminado correctamente' });
  } catch (Error_) {
    console.error('clientes_delete error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al eliminar el cliente' });
  }
});

/* ============================================================================
   POST /clientes/soft_delete  -> SP: clientes_soft_delete(@cliente_id NVARCHAR(20))
============================================================================ */
ClientesRouter.post('/soft_delete', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, SoftDeleteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (soft_delete)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('clientes_soft_delete', Params);
    return res.status(200).json({ success: true, message: 'Cliente desactivado correctamente' });
  } catch (Error_) {
    console.error('clientes_soft_delete error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al desactivar el cliente' });
  }
});

/* ============================================================================
   POST /clientes/registrar_login  -> SP: clientes_registrar_login(@cliente_id NVARCHAR(20))
============================================================================ */
ClientesRouter.post('/registrar_login', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, RegistrarLoginRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (registrar_login)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('clientes_registrar_login', Params);
    return res.status(200).json({ success: true, message: 'Último acceso registrado' });
  } catch (Error_) {
    console.error('clientes_registrar_login error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al registrar login' });
  }
});

/* ============================================================================
   GET /clientes/por_id/:cliente_id  -> SP: clientes_por_id(@cliente_id NVARCHAR(20))
   * Mantengo GET con path param como pediste, pero sin retornar data al front.
============================================================================ */
ClientesRouter.get('/por_id/:cliente_id', requireAdmin, async (req, res) => {
  try {
    const Body = { cliente_id: req.params.cliente_id };
    const { isValid } = await ValidationService.validateData(Body, PorIdRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (por_id)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('clientes_por_id', Params);
    return res.status(200).json({ success: true, message: 'Cliente obtenido' });
  } catch (Error_) {
    console.error('clientes_por_id error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al obtener el cliente' });
  }
});

/* ============================================================================
   POST /clientes/reactivar -> SP: clientes_reactivar(@cliente_id NVARCHAR(20))
============================================================================ */
ClientesRouter.post('/reactivar', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, ReactivarRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (reactivar)' });
    }

    const Params = BuildParams([
      { name: 'cliente_id', type: sql.NVarChar(20), value: Body.cliente_id }
    ]);

    await db.executeProc('clientes_reactivar', Params);
    return res.status(200).json({ success: true, message: 'Cliente reactivado correctamente' });
  } catch (Error_) {
    console.error('clientes_reactivar error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al reactivar el cliente' });
  }
});

module.exports = ClientesRouter;
