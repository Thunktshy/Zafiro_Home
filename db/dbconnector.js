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

  //Ejecución de querys con parametros
  async querywithparams(sqlQuery, params = {}) {
    if (typeof sqlQuery !== 'string') {
      throw new TypeError('El SQL debe ser un string');
    }
    await this.poolReady;
    const pool  = await this.poolReady;
    const req   = pool.request();

    // Requerir que cada parámetro coincida con su tipo de dato
    for (const [name, spec] of Object.entries(params)) {
      if (
        !spec ||
        !spec.type ||
        (!Object.prototype.hasOwnProperty.call(spec, 'value'))
      ) {
        throw new TypeError('Se intentó ingresar un parametro inválido para "${name}"');
      }
      req.input(name, spec.type, spec.value);
    }

    //Captura de error en el query
    try {
      const result = await req.query(sqlText);
      return result.recordset;
    } catch (err) {
      console.error('Error de ejecución del query:', err);
      throw err;
    }
  }

  //Cierra el pool de conexiones
  async close() {
    try {
      await this.pool.close();
      console.log('SQL Server pool closed');
    } catch (err) {
      console.error('Error closing SQL Server pool:', err);
      throw err;
    }
  }
}

module.exports = new DBConnector();

