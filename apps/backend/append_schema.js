const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

async function run() {
  try {
    const sql = postgres(process.env.DATABASE_URL);
    await sql`ALTER TABLE academic_matricula ADD COLUMN IF NOT EXISTS ativo text`;
    await sql`ALTER TABLE academic_matricula ADD COLUMN IF NOT EXISTS situacao text`;
    console.log("Columns added successfully");
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
