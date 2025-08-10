// db.js
const sql = require('mssql'); // Conector con SQL Server

const config = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_HOST,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

class DBConnector {
  constructor() {
    this.pool = new sql.ConnectionPool(config);
    this.poolReady = this.pool.connect()
      .then(pool => {
        console.log('Conexión establecida con la base de datos');
        return pool;
      })
      .catch(err => {
        console.error('Error al conectar con la base de datos:', err);
        throw err;
      });
  }

  // Normaliza el shape de resultado a array de filas
  static toRows(result) {
    if (!result) return [];
    if (Array.isArray(result.recordsets) && result.recordsets.length) {
      for (const rs of result.recordsets) if (Array.isArray(rs) && rs.length) return rs;
      return result.recordsets[0] ?? [];
    }
    if (Array.isArray(result.recordset)) return result.recordset;
    if (Array.isArray(result)) return result;
    if (Array.isArray(result[0])) return result[0];
    return [];
  }


  // Ejecuta SQL crudo (SELECT/EXEC ...) y REGRESA array de filas
  async queryWithParams(sqlQuery, params = {}) {
    if (typeof sqlQuery !== 'string') {
      throw new TypeError('El SQL debe ser un string');
    }
    const pool = await this.poolReady;
    const req  = pool.request();

    for (const [name, spec] of Object.entries(params)) {
      if (!spec || !spec.type || !('value' in spec)) {
        throw new TypeError(`Parámetro inválido: ${name}`);
      }
      req.input(name, spec.type, spec.value);
    }

    try {
      const result = await req.query(sqlQuery);
      return DBConnector.toRows(result);
    } catch (err) {
      console.error('Error de ejecución del query:', err);
      throw err;
    }
  }

  // Ejecuta un Stored Procedure por nombre y REGRESA array de filas
  async executeProc(procName, params = {}) {
    if (typeof procName !== 'string') {
      throw new TypeError('El nombre del procedimiento debe ser un string');
    }
    const pool = await this.poolReady;
    const req  = pool.request();

    for (const [name, spec] of Object.entries(params)) {
      if (!spec || !spec.type || !('value' in spec)) {
        throw new TypeError(`Parámetro inválido: ${name}`);
      }
      req.input(name, spec.type, spec.value);
    }

    try {
      const result = await req.execute(procName);
      return DBConnector.toRows(result);
    } catch (err) {
      console.error('Error al ejecutar SP:', procName, err);
      throw err;
    }
  }

  async close() {
    await this.pool.close();
    console.log('SQL Server pool cerrado');
  }
}

module.exports = {
  db: new DBConnector(),
  sql
};
