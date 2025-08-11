// Server/routes/buscarClientesRoute.js
// Soporta SP: buscar_cliente(@termino_busqueda NVARCHAR(150), @solo_activos BIT = 1)
// Ruta según separación del SP: /buscar/cliente

const express = require('express');
const { db, sql } = require('../../db/dbconnector.js');
const ValidationService = require('../validatorService');
const { BuscarClienteRules } = require('../Validators/Rulesets/clientes');
const { requireAdmin } = require('../routes/authRoute.js'); // para pruebas

const BuscarRouter = express.Router();

function BuildParams(Entries) {
  const Params = {};
  for (const E of Entries) {
    Params[E.name] = { type: E.type, value: E.value };
  }
  return Params;
}

/* ============================================================================
   POST /buscar/cliente -> SP: buscar_cliente
============================================================================ */
BuscarRouter.post('/cliente', requireAdmin, async (req, res) => {
  try {
    const Body = req.body;
    const { isValid } = await ValidationService.validateData(Body, BuscarClienteRules);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Datos inválidos (buscar_cliente)' });
    }

    // Default @solo_activos = 1
    const SoloActivos = (typeof Body.solo_activos === 'number')
      ? (Body.solo_activos ? 1 : 0)
      : 1;

    const Params = BuildParams([
      { name: 'termino_busqueda', type: sql.NVarChar(150), value: Body.termino_busqueda },
      { name: 'solo_activos',     type: sql.Bit,          value: SoloActivos }
    ]);

    const data = await db.executeProc('buscar_cliente', Params);
    return res.status(200).json({
      success: true,
      message: data.length ? 'Coincidencias encontradas' : 'Sin coincidencias',
      data
    });
  } catch (Error_) {
    console.error('buscar_cliente error:', Error_);
    return res.status(500).json({ success: false, message: 'Error al buscar cliente' });
  }
});

module.exports = BuscarRouter;
