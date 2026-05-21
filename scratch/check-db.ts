import { db } from "../src/db"
import { avaProgressReport } from "../src/db/schema"
import { eq, sql } from "drizzle-orm"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

async function run() {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
      enrolmentStatus: avaProgressReport.enrolmentStatus,
    })
    .from(avaProgressReport)
    .where(eq(avaProgressReport.sourceInstitution, "raizes"))
    .groupBy(avaProgressReport.enrolmentStatus)

  console.log("RESULTADO PARA RAIZES:")
  console.log(JSON.stringify(result, null, 2))

  const total = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(avaProgressReport)
    .where(eq(avaProgressReport.sourceInstitution, "raizes"))

  console.log("TOTAL DE REGISTROS:", total[0]?.count)
}

run().catch(console.error)
