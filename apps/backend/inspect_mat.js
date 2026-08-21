import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const config = {
    user: process.env.LYCEUM_DB_USERNAME || 'PortAeeConsult',
    password: process.env.LYCEUM_DB_PASSWORD || 'Port4eeC0nsult@Tudo.',
    server: process.env.LYCEUM_DB_HOST || '172.29.44.90',
    port: parseInt(process.env.LYCEUM_DB_PORT || '1433'),
    database: process.env.LYCEUM_DB_DATABASE || 'Lyceum',
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };

  try {
    const pool = await sql.connect(config);
    const prefix = process.env.LYCEUM_DB_PREFIX ? process.env.LYCEUM_DB_PREFIX.replace('dbo.', '') : '';
    
    const matRes = await pool.request().query(`
      SELECT TOP 1 * FROM ${process.env.LYCEUM_DB_PREFIX || ''}VW_AVA_MATRICULA
    `);
    console.log("VW_AVA_MATRICULA cols:", Object.keys(matRes.recordset[0] || {}));

    const usersRes = await pool.request().query(`
      SELECT TOP 1 * FROM ${process.env.LYCEUM_DB_PREFIX || ''}VW_AVA_USUARIOS
    `);
    console.log("VW_AVA_USUARIOS cols:", Object.keys(usersRes.recordset[0] || {}));

    pool.close();
  } catch (err) {
    console.error(err);
  }
}

run();
