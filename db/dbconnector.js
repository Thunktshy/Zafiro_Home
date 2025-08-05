const sql = require('mssql'); //Conector con Sql Server

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
    max:  5,
    min:  0,
    idleTimeoutMillis: 30000
  }
};

class DBConnector {
  constructor() {
    this.pool      = new sql.ConnectionPool(config);
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

  // Generic query runner
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
      return result.recordset;
    } catch (err) {
      console.error('Error de ejecución del query:', err);
      throw err;
    }
  }

  async close() {
    await this.pool.close();
    console.log('SQL Server pool closed');
  }
}

module.exports = new DBConnector();
