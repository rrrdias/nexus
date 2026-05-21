import { NextResponse } from "next/server"
import { db } from "@/db"
import { avaProgressReport, avaGradesReport } from "@/db/schema"
import { eq, and, or } from "drizzle-orm"
import { timingSafeEqual } from "node:crypto"

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

  // Timeout de 15 segundos para evitar requisições presas no Moodle
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    let res
    try {
      res = await fetch(getUrl, { cache: 'no-store', signal: controller.signal })
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        return { source: `${institution}_grades`, status: 'skipped', reason: 'Timeout na resposta do Moodle (15s)' }
      }
      return { source: `${institution}_grades`, status: 'skipped', reason: `Erro de conexão: ${fetchError.message}` }
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      return { source: `${institution}_grades`, status: 'skipped', reason: `Link indisponível no Moodle (HTTP ${res.status})` }
    }

    const textContent = await res.text()
    if (!textContent || textContent.trim() === '') {
      return { source: `${institution}_grades`, status: 'skipped', reason: 'Arquivo de relatório vazio (Moodle gerando)' }
    }

    const cleanText = textContent.trim()
    if (cleanText.startsWith('<!DOCTYPE') || cleanText.startsWith('<html') || cleanText.startsWith('<xml')) {
      return { source: `${institution}_grades`, status: 'skipped', reason: 'Moodle retornou HTML/Erro (Relatório sendo gerado ou não autorizado)' }
    }

    let data
    try {
      data = JSON.parse(cleanText)
    } catch (parseError: any) {
      return { source: `${institution}_grades`, status: 'skipped', reason: `JSON inválido retornado pelo Moodle: ${parseError.message.substring(0, 50)}` }
    }

    if (!Array.isArray(data)) {
      if (data && typeof data === 'object' && ('exception' in data || 'error' in data || 'message' in data)) {
        return { source: `${institution}_grades`, status: 'skipped', reason: `Erro no Moodle: ${(data as any).message || (data as any).exception || 'Desconhecido'}` }
      }
      return { source: `${institution}_grades`, status: 'skipped', reason: 'Formato de dados inválido (esperado array)' }
    }

    let inserted = 0
    let updated = 0

    await processInChunks(data, 50, async (chunk) => {
      // Filtra registros válidos
      const validItems = chunk.filter(item => {
        const userId = String(item.user_id || item.aluno_id || '')
        const courseId = String(item.course_id || '')
        return userId && courseId
      })

      if (validItems.length === 0) return

      // SELECT em lote para o chunk
      const conditions = validItems.map(item => and(
        eq(avaGradesReport.sourceInstitution, institution),
        eq(avaGradesReport.userId, String(item.user_id || item.aluno_id || '')),
        eq(avaGradesReport.courseId, String(item.course_id || ''))
      ))

      const existing = await db.select()
        .from(avaGradesReport)
        .where(or(...conditions))

      // Mapeia registros existentes para busca O(1)
      const existingMap = new Map<string, any>()
      for (const row of existing) {
        const key = `${row.userId}_${row.courseId}`
        existingMap.set(key, row)
      }

      const inserts: any[] = []
      const updates: { id: string; values: any }[] = []

      for (const item of validItems) {
        const userId = String(item.user_id || item.aluno_id || '')
        const courseId = String(item.course_id || '')
        const key = `${userId}_${courseId}`
        const exists = existingMap.get(key)

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
          updates.push({ id: exists.id, values })
        } else {
          inserts.push(values)
        }
      }

      // Executa Bulk Insert das novas inserções no chunk
      if (inserts.length > 0) {
        await db.insert(avaGradesReport).values(inserts)
        inserted += inserts.length
      }

      // Executa atualizações em paralelo dentro do chunk para otimizar tempo
      if (updates.length > 0) {
        await Promise.all(updates.map(u =>
          db.update(avaGradesReport).set(u.values).where(eq(avaGradesReport.id, u.id))
        ))
        updated += updates.length
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

  // Timeout de 15 segundos para evitar requisições presas no Moodle
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    let res
    try {
      res = await fetch(getUrl, { cache: 'no-store', signal: controller.signal })
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        return { source: `${institution}_progress`, status: 'skipped', reason: 'Timeout na resposta do Moodle (15s)' }
      }
      return { source: `${institution}_progress`, status: 'skipped', reason: `Erro de conexão: ${fetchError.message}` }
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      return { source: `${institution}_progress`, status: 'skipped', reason: `Link indisponível no Moodle (HTTP ${res.status})` }
    }

    const textContent = await res.text()
    if (!textContent || textContent.trim() === '') {
      return { source: `${institution}_progress`, status: 'skipped', reason: 'Arquivo de relatório vazio (Moodle gerando)' }
    }

    const cleanText = textContent.trim()
    if (cleanText.startsWith('<!DOCTYPE') || cleanText.startsWith('<html') || cleanText.startsWith('<xml')) {
      return { source: `${institution}_progress`, status: 'skipped', reason: 'Moodle retornou HTML/Erro (Relatório sendo gerado ou não autorizado)' }
    }

    let data
    try {
      data = JSON.parse(cleanText)
    } catch (parseError: any) {
      return { source: `${institution}_progress`, status: 'skipped', reason: `JSON inválido retornado pelo Moodle: ${parseError.message.substring(0, 50)}` }
    }

    if (!Array.isArray(data)) {
      if (data && typeof data === 'object' && ('exception' in data || 'error' in data || 'message' in data)) {
        return { source: `${institution}_progress`, status: 'skipped', reason: `Erro no Moodle: ${(data as any).message || (data as any).exception || 'Desconhecido'}` }
      }
      return { source: `${institution}_progress`, status: 'skipped', reason: 'Formato de dados inválido (esperado array)' }
    }

    let inserted = 0
    let updated = 0

    await processInChunks(data, 50, async (chunk) => {
      // Filtra registros válidos
      const validItems = chunk.filter(item => {
        const matricula = String(item.matricula || '')
        const curso = String(item.curso || '')
        return matricula && curso
      })

      if (validItems.length === 0) return

      // SELECT em lote para o chunk
      const conditions = validItems.map(item => and(
        eq(avaProgressReport.sourceInstitution, institution),
        eq(avaProgressReport.alunoId, String(item.aluno_id || '')),
        eq(avaProgressReport.curso, String(item.curso || ''))
      ))

      const existing = await db.select()
        .from(avaProgressReport)
        .where(or(...conditions))

      // Mapeia registros existentes para busca O(1)
      const existingMap = new Map<string, any>()
      for (const row of existing) {
        const key = `${row.alunoId}_${row.curso}`
        existingMap.set(key, row)
      }

      const inserts: any[] = []
      const updates: { id: string; values: any }[] = []

      for (const item of validItems) {
        const matricula = String(item.matricula || '')
        const curso = String(item.curso || '')
        const alunoId = String(item.aluno_id || '')
        const key = `${alunoId}_${curso}`
        const exists = existingMap.get(key)

        const values = {
          sourceInstitution: institution,
          alunoId,
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
          updates.push({ id: exists.id, values })
        } else {
          inserts.push(values)
        }
      }

      // Executa Bulk Insert das novas inserções no chunk
      if (inserts.length > 0) {
        await db.insert(avaProgressReport).values(inserts)
        inserted += inserts.length
      }

      // Executa atualizações em paralelo dentro do chunk para otimizar tempo
      if (updates.length > 0) {
        await Promise.all(updates.map(u =>
          db.update(avaProgressReport).set(u.values).where(eq(avaProgressReport.id, u.id))
        ))
        updated += updates.length
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
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }

  if (!isAuthorized(authHeader, process.env.CRON_SECRET)) {
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

function isAuthorized(authHeader: string | null, secret: string) {
  const expected = `Bearer ${secret}`
  if (!authHeader) return false

  const actualBuffer = Buffer.from(authHeader)
  const expectedBuffer = Buffer.from(expected)

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}
