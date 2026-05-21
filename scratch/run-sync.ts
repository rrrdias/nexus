import { db } from "../src/db"
import { avaProgressReport } from "../src/db/schema"
import { eq, and } from "drizzle-orm"
import dotenv from "dotenv"
import fetch from "node-fetch"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

const url = 'https://ava.faculdaderaizes.edu.br/webservice/pluginfile.php/1/block_reports/def_report_json/22/dfr.json?token=f6ac075f09ce63f60a51b019cae2adcd';

async function run() {
  console.log("Fetching from Moodle JSON...");
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as any[];
  console.log(`Fetched ${data.length} records from Moodle.`);

  let inserted = 0;
  let updated = 0;

  for (const item of data) {
    const matricula = String(item.matricula || '')
    const curso = String(item.curso || '')
    if (!matricula || !curso) continue

    const exists = await db.query.avaProgressReport.findFirst({
      where: and(
        eq(avaProgressReport.sourceInstitution, "raizes"),
        eq(avaProgressReport.alunoId, String(item.aluno_id || '')),
        eq(avaProgressReport.curso, curso)
      )
    })

    const values = {
      sourceInstitution: "raizes",
      alunoId: String(item.aluno_id || ''),
      usuario: item.usuario,
      aluno: item.aluno,
      matricula,
      userPhone1: item.user_phone1 || null,
      periodo: item.periodo,
      enrolmentStatus: item.enrolment_status,
      lastaccess: item.lastaccess,
      curso,
      fase1: String(item.fase1 || ''),
      fase2: String(item.fase2 || ''),
      fase3: String(item.fase3 || ''),
      cursoPerfil: item.curso_perfil,
      periodoPerfil: item.periodo_perfil,
      unidadeFisica: item.unidade_fisica,
      progressoTotal: String(item.progresso_total || item.media || ''),
      listaFase1: item.lista_fase1,
      listaFase2: item.lista_fase2,
      listaFase3: item.lista_fase3,
      diasSemAcesso: String(item.dias_sem_acesso || ''),
      updatedAt: new Date()
    }

    if (exists) {
      await db.update(avaProgressReport).set(values).where(eq(avaProgressReport.id, exists.id))
      updated++
    } else {
      await db.insert(avaProgressReport).values(values)
      inserted++
    }
  }

  console.log(`Sync Completed. Inserted: ${inserted}, Updated: ${updated}`);
  
  // Verify final count
  const count = await db.select().from(avaProgressReport).where(eq(avaProgressReport.sourceInstitution, "raizes"));
  console.log(`Total records in DB for raizes now: ${count.length}`);
}

run().catch(console.error);
