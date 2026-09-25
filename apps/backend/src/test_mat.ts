import * as sql from 'mssql';

async function run() {
  const config = {
    user: process.env.LYCEUM_DB_USERNAME || '',
    password: process.env.LYCEUM_DB_PASSWORD || '',
    server: process.env.LYCEUM_DB_HOST || '',
    port: 1433,
    database: 'Lyceum',
    options: { encrypt: false, trustServerCertificate: true },
  };

  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const res = await pool
      .request()
      .query('SELECT TOP 1 * FROM VW_AVA_MATRICULA');
    console.log(Object.keys(res.recordset[0]));
    pool.close();
  } catch (e) {
    console.error(e);
  }
}
run();
