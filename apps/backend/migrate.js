const { migrate } = require("drizzle-orm/postgres-js/migrator");
const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
require("dotenv").config();

async function runMigrate() {
  const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/nexus_core";
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations applied successfully!");
  
  await sql.end();
}

runMigrate().catch(console.error);
