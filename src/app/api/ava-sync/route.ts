import { NextResponse } from "next/server"
import { db } from "@/db"
import { avaProgressReport, avaGradesReport } from "@/db/schema"
import { eq, and } from "drizzle-orm"

// Função auxiliar para processar em chunks e evitar sobrecarga
async function processInChunks<T>(items: T[], chunkSize: number, processor: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    await processor(chunk)
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

async function syncGrades(institution: string, getUrl: string | undefined, attUrl: string | undefined) {
  if (!getUrl) return { source: `${institution}_grades`, status: 'skipped', reason: 'URL missing' }
  
  console.log(`[SYNC] Iniciando Notas ${institution}...`)
  try {
    const res = await fetch(getUrl, { cache: 'no-store' })
    if (!res.ok) return { source: `${institution}_grades`, status: 'error', reason: `Fetch failed: ${res.status}` }
    
    const data = await res.json()
    if (!Array.isArray(data)) return { source: `${institution}_grades`, status: 'error', reason: 'Invalid data format' }

    let inserted = 0
    let updated = 0

    await processInChunks(data, 50, async (chunk) => {
      for (const item of chunk) {
        const userId = String(item.user_id || item.aluno_id || '')
        const courseId = String(item.course_id || '')
        if (!userId || !courseId) continue

        const exists = await db.query.avaGradesReport.findFirst({
          where: and(
            eq(avaGradesReport.sourceInstitution, institution),
            eq(avaGradesReport.userId, userId),
            eq(avaGradesReport.courseId, courseId)
          )
        })

        const values = {
          sourceInstitution: institution,
          courseId,
          courseFullname: item.course_fullname,
          courseShortname: item.course_shortname,
          userId,
          userIdentification: item.user_identification,
          userUsername: item.user_username || item.usuario,
          studentName: item.student_name || item.aluno,
          userEmail: item.user_email,
          userPhone1: item.user_phone1,
          userPhone2: item.user_phone2,
          enrolmentStatus: item.enrolment_status,
          cursoPerfil: item.curso_perfil,
          periodoPerfil: item.periodo_perfil,
          unidadeFisica: item.unidade_fisica,
          periodo: item.periodo,
          fase1: String(item.fase1 || ''),
          fase2: String(item.fase2 || ''),
          fase3: String(item.fase3 || ''),
          media: String(item.media || ''),
          customCourse: item.custom_course,
          lastaccess: item.lastaccess,
          updatedAt: new Date()
        }

        if (exists) {
          await db.update(avaGradesReport).set(values).where(eq(avaGradesReport.id, exists.id))
          updated++
        } else {
          await db.insert(avaGradesReport).values(values)
          inserted++
        }
      }
    })

    if (attUrl) {
      console.log(`[MOODLE] Disparando comando de atualização de SQL Adiado para ${institution} (Notas)...`)
      fetch(attUrl, { cache: 'no-store' }).catch(e => console.error(`Erro ao disparar atualização moodle ${institution}:`, e))
    }

    return { source: `${institution}_grades`, status: 'success', inserted, updated }
  } catch (error: any) {
    console.error(`Erro sync notas ${institution}:`, error)
    return { source: `${institution}_grades`, status: 'error', reason: error.message }
  }
}

async function syncProgress(institution: string, getUrl: string | undefined, attUrl: string | undefined) {
  if (!getUrl) return { source: `${institution}_progress`, status: 'skipped', reason: 'URL missing' }
  
  console.log(`[SYNC] Iniciando Progresso ${institution}...`)
  try {
    const res = await fetch(getUrl, { cache: 'no-store' })
    if (!res.ok) return { source: `${institution}_progress`, status: 'error', reason: `Fetch failed: ${res.status}` }
    
    const data = await res.json()
    if (!Array.isArray(data)) return { source: `${institution}_progress`, status: 'error', reason: 'Invalid data format' }

    let inserted = 0
    let updated = 0

    await processInChunks(data, 50, async (chunk) => {
      for (const item of chunk) {
        const matricula = String(item.matricula || '')
        const curso = String(item.curso || '')
        if (!matricula || !curso) continue

        const exists = await db.query.avaProgressReport.findFirst({
          where: and(
            eq(avaProgressReport.sourceInstitution, institution),
            eq(avaProgressReport.matricula, matricula),
            eq(avaProgressReport.curso, curso)
          )
        })

        const values = {
          sourceInstitution: institution,
          alunoId: String(item.aluno_id || ''),
          usuario: item.usuario,
          aluno: item.aluno,
          matricula,
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
    })

    if (attUrl) {
      console.log(`[MOODLE] Disparando comando de atualização de SQL Adiado para ${institution} (Progresso)...`)
      fetch(attUrl, { cache: 'no-store' }).catch(e => console.error(`Erro ao disparar atualização moodle progress ${institution}:`, e))
    }

    return { source: `${institution}_progress`, status: 'success', inserted, updated }
  } catch (error: any) {
    console.error(`Erro sync progresso ${institution}:`, error)
    return { source: `${institution}_progress`, status: 'error', reason: error.message }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const institution = searchParams.get('institution')?.toLowerCase()
  const type = searchParams.get('type')?.toLowerCase() // 'grades' ou 'progress'

  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = []
    
    const allTasks = [
      { name: 'ead', type: 'grades', get: process.env.MOODLE_EAD_GRADES_GET_URL, att: process.env.MOODLE_EAD_GRADES_ATT_URL },
      { name: 'ead', type: 'progress', get: process.env.MOODLE_EAD_PROGRESS_GET_URL, att: process.env.MOODLE_EAD_PROGRESS_ATT_URL },
      { name: 'uni', type: 'grades', get: process.env.MOODLE_UNI_GRADES_GET_URL, att: process.env.MOODLE_UNI_GRADES_ATT_URL },
      { name: 'uni', type: 'progress', get: process.env.MOODLE_UNI_PROGRESS_GET_URL, att: process.env.MOODLE_UNI_PROGRESS_ATT_URL },
      { name: 'uniego', type: 'grades', get: process.env.MOODLE_UNIEGO_GRADES_GET_URL, att: process.env.MOODLE_UNIEGO_GRADES_ATT_URL },
      { name: 'uniego', type: 'progress', get: process.env.MOODLE_UNIEGO_PROGRESS_GET_URL, att: process.env.MOODLE_UNIEGO_PROGRESS_ATT_URL },
      { name: 'raizes', type: 'grades', get: process.env.MOODLE_RAIZES_GRADES_GET_URL, att: process.env.MOODLE_RAIZES_GRADES_ATT_URL },
      { name: 'raizes', type: 'progress', get: process.env.MOODLE_RAIZES_PROGRESS_GET_URL, att: process.env.MOODLE_RAIZES_PROGRESS_ATT_URL },
      { name: 'eefn', type: 'grades', get: process.env.MOODLE_EEFN_GRADES_GET_URL, att: process.env.MOODLE_EEFN_GRADES_ATT_URL },
      { name: 'eefn', type: 'progress', get: process.env.MOODLE_EEFN_PROGRESS_GET_URL, att: process.env.MOODLE_EEFN_PROGRESS_ATT_URL },
      { name: 'pos', type: 'grades', get: process.env.MOODLE_POS_GRADES_GET_URL, att: process.env.MOODLE_POS_GRADES_ATT_URL },
    ]

    // Filtra por instituição E por tipo se fornecidos
    let tasksToProcess = allTasks
    if (institution) tasksToProcess = tasksToProcess.filter(t => t.name === institution)
    if (type) tasksToProcess = tasksToProcess.filter(t => t.type === type)

    if (tasksToProcess.length === 0) {
      return NextResponse.json({ success: false, error: "Nenhuma tarefa de sincronização encontrada com os parâmetros fornecidos." }, { status: 404 })
    }

    for (const task of tasksToProcess) {
      const res = task.type === 'grades' 
        ? await syncGrades(task.name, task.get, task.att)
        : await syncProgress(task.name, task.get, task.att)
      results.push(res)
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error("Erro no sync global do Moodle:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
