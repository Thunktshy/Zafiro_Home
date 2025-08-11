// Server/routes/empleadosRoute.js
const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService.js');
const {
  InsertRules,
  UpdateRules,
  DeleteRules,
  SoftDeleteRules,
  ReactivarRules,
  RegistrarLoginRules,
  PorIdRules
} = require('../Validators/Rulesets/empleados.js');

const { requireAdmin } = require('../routes/authRoute.js');

const EmpleadosRouter = express.Router();

// Helper para mapear a { type, value }
function BuildParams(entries) {
  const params = {};
  for (const e of entries) params[e.name] = { type: e.type, value: e.value };
  return params;
}

/* ============================================================================
   POST /empleados/insert  -> SP: empleados_insert(@cuenta NVARCHAR(20), @contrasena NVARCHAR(255), @email NVARCHAR(150))
============================================================================ */
EmpleadosRouter.post('/insert', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, InsertRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (insert)' });

    const Params = BuildParams([
      { name: 'cuenta',     type: sql.NVarChar(20),  value: Body.cuenta },
      { name: 'contrasena', type: sql.NVarChar(255), value: Body.contrasena },
      { name: 'email',      type: sql.NVarChar(150), value: Body.email }
    ]);

    await db.executeProc('empleados_insert', Params);
    return res.status(201).json({ success: true, message: 'Empleado creado correctamente' });
  } catch (Error_) {
    console.error('empleados_insert error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al crear el empleado' });
  }
});

/* ============================================================================
   POST /empleados/update  -> SP: empleados_update(@empleado_id INT, @cuenta NVARCHAR(20), @email NVARCHAR(150), @puesto NVARCHAR(30))
============================================================================ */
EmpleadosRouter.post('/update', requireAdmin, async (req, res) => {
  try {
    const Body = { ...req.body, empleado_id: Number(req.body.empleado_id) }; // cast a number
    const { isValid } = await ValidationService.validateData(Body, UpdateRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (update)' });

    const Params = BuildParams([
      { name: 'empleado_id', type: sql.Int,          value: Body.empleado_id },
      { name: 'cuenta',      type: sql.NVarChar(20), value: Body.cuenta },
      { name: 'email',       type: sql.NVarChar(150),value: Body.email },
      { name: 'puesto',      type: sql.NVarChar(30), value: Body.puesto }
    ]);

    await db.executeProc('empleados_update', Params);
    return res.status(200).json({ success: true, message: 'Empleado actualizado correctamente' });
  } catch (Error_) {
    console.error('empleados_update error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al actualizar el empleado' });
  }
});

/* ============================================================================
   POST /empleados/delete  -> SP: empleados_delete(@empleado_id INT)
============================================================================ */
EmpleadosRouter.post('/delete', requireAdmin, async (req, res) => {
  try {
    const Body = { empleado_id: Number(req.body.empleado_id) };
    const { isValid } = await ValidationService.validateData(Body, DeleteRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (delete)' });

    const Params = BuildParams([
      { name: 'empleado_id', type: sql.Int, value: Body.empleado_id }
    ]);

    await db.executeProc('empleados_delete', Params);
    return res.status(200).json({ success: true, message: 'Empleado eliminado correctamente' });
  } catch (Error_) {
    console.error('empleados_delete error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al eliminar el empleado' });
  }
});

/* ============================================================================
   POST /empleados/soft_delete  -> SP: empleados_soft_delete(@empleado_id INT)
============================================================================ */
EmpleadosRouter.post('/soft_delete', requireAdmin, async (req, res) => {
  try {
    const Body = { empleado_id: Number(req.body.empleado_id) };
    const { isValid } = await ValidationService.validateData(Body, SoftDeleteRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (soft_delete)' });

    const Params = BuildParams([
      { name: 'empleado_id', type: sql.Int, value: Body.empleado_id }
    ]);

    await db.executeProc('empleados_soft_delete', Params);
    return res.status(200).json({ success: true, message: 'Empleado desactivado correctamente' });
  } catch (Error_) {
    console.error('empleados_soft_delete error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al desactivar el empleado' });
  }
});

/* ============================================================================
   POST /empleados/reactivar  -> SP: empleados_reactivar(@empleado_id INT)
============================================================================ */
EmpleadosRouter.post('/reactivar', requireAdmin, async (req, res) => {
  try {
    const Body = { empleado_id: Number(req.body.empleado_id) };
    const { isValid } = await ValidationService.validateData(Body, ReactivarRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (reactivar)' });

    const Params = BuildParams([
      { name: 'empleado_id', type: sql.Int, value: Body.empleado_id }
    ]);

    await db.executeProc('empleados_reactivar', Params);
    return res.status(200).json({ success: true, message: 'Empleado reactivado correctamente' });
  } catch (Error_) {
    console.error('empleados_reactivar error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al reactivar el empleado' });
  }
});

/* ============================================================================
   POST /empleados/registrar_login  -> SP: empleados_registrar_login(@empleado_id INT)
============================================================================ */
EmpleadosRouter.post('/registrar_login', requireAdmin, async (req, res) => {
  try {
    const Body = { empleado_id: Number(req.body.empleado_id) };
    const { isValid } = await ValidationService.validateData(Body, RegistrarLoginRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (registrar_login)' });

    const Params = BuildParams([
      { name: 'empleado_id', type: sql.Int, value: Body.empleado_id }
    ]);

    await db.executeProc('empleados_registrar_login', Params);
    return res.status(200).json({ success: true, message: 'Último acceso registrado' });
  } catch (Error_) {
    console.error('empleados_registrar_login error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al registrar login' });
  }
});

/* ============================================================================
   GET /empleados/por_id/:empleado_id  -> SP: empleados_por_id(@empleado_id INT)
============================================================================ */
EmpleadosRouter.get('/por_id/:empleado_id', requireAdmin, async (req, res) => {
  try {
    const Body = { empleado_id: Number(req.params.empleado_id) };
    const { isValid } = await ValidationService.validateData(Body, PorIdRules);
    if (!isValid) return res.status(400).json({ success: false, message: 'Datos inválidos (por_id)' });

    const Params = BuildParams([
      { name: 'empleado_id', type: sql.Int, value: Body.empleado_id }
    ]);

    await db.executeProc('empleados_por_id', Params);
    return res.status(200).json({ success: true, message: 'Empleado obtenido' });
  } catch (Error_) {
    console.error('empleados_por_id error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al obtener el empleado' });
  }
});

module.exports = EmpleadosRouter;
