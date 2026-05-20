"use server"

import { db } from "@/db"
import { avaProgressReport, avaGradesReport } from "@/db/schema"
import { eq, ilike, and, sql } from "drizzle-orm"

function parseProgress(value: any) {
  if (value === null || value === undefined || value === "" || value === "-") return null
  const parsed = parseFloat(String(value).replace("%", "").replace(",", "."))
  return isNaN(parsed) ? null : parsed
}

function calculateFaseStatus(mediaFase: number, dataInicio: Date, dataFim: Date) {
  const hoje = new Date()
  if (hoje < dataInicio) return "neutral"
  if (mediaFase >= 100) return "success"
  if (hoje > dataFim) return "danger"
  if (mediaFase < 40) return "danger"
  return "warning"
}

export async function getProgressData(page: number, size: number, filters: any) {
  try {
    const offset = (page - 1) * size
    const conditions = []
    
    if (filters.sourceInstitution) {
      conditions.push(eq(avaProgressReport.sourceInstitution, filters.sourceInstitution))
    }
    if (filters.aluno) conditions.push(ilike(avaProgressReport.aluno, `%${filters.aluno}%`))
    if (filters.curso) conditions.push(ilike(avaProgressReport.curso, `%${filters.curso}%`))
    if (filters.usuario) conditions.push(ilike(avaProgressReport.usuario, `%${filters.usuario}%`))
    if (filters.matricula) conditions.push(ilike(avaProgressReport.matricula, `%${filters.matricula}%`))
    if (filters.periodo) conditions.push(ilike(avaProgressReport.periodo, `%${filters.periodo}%`))
    if (filters.curso_perfil) conditions.push(ilike(avaProgressReport.cursoPerfil, `%${filters.curso_perfil}%`))
    if (filters.periodo_perfil) conditions.push(ilike(avaProgressReport.periodoPerfil, `%${filters.periodo_perfil}%`))
    if (filters.unidade_fisica) conditions.push(ilike(avaProgressReport.unidadeFisica, `%${filters.unidade_fisica}%`))
    if (filters.enrolment_status) conditions.push(ilike(avaProgressReport.enrolmentStatus, `%${filters.enrolment_status}%`))
    if (filters.lastaccess) conditions.push(ilike(avaProgressReport.lastaccess, `%${filters.lastaccess}%`))
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Busca os dados paginados para a Tabela
    const data = await db.select().from(avaProgressReport).where(whereClause).limit(size).offset(offset)

    // Busca TODOS os dados filtrados para calcular as Métricas Globais (Cards)
    const allFilteredData = await db.select().from(avaProgressReport).where(whereClause)
    
    const total_records = allFilteredData.length
    const total_pages = Math.ceil(total_records / size)

    // DATAS
    const hoje = new Date()
    const inicio_f1 = new Date(2026, 1, 13) // Mês é 0-indexed no JS (Fev = 1)
    const fim_f1 = new Date(2026, 2, 29)    // Mar = 2
    const inicio_f2 = new Date(2026, 2, 30)
    const fim_f2 = new Date(2026, 4, 11)    // Mai = 4
    const inicio_f3 = new Date(2026, 4, 12)
    const fim_f3 = new Date(2026, 5, 19)    // Jun = 5

    // Métricas Auxiliares
    const getFaseMetricsInternal = (faseKey: 'fase1'|'fase2'|'fase3', dataInicio: Date, dataFim: Date) => {
      let limiar = 0
      if (hoje > dataFim) limiar = 100
      else if (hoje >= dataInicio) limiar = 40
      
      if (limiar === 0) return { below: 0, crit: 0 }

      const faseValues = allFilteredData.map(r => parseProgress(r[faseKey])).filter(v => v !== null) as number[]
      const belowCount = faseValues.filter(v => v < limiar).length

      const discMap: Record<string, number[]> = {}
      allFilteredData.forEach(row => {
        const nome = row.curso
        const prog = parseProgress(row[faseKey])
        if (nome && prog !== null) {
          if (!discMap[nome]) discMap[nome] = []
          discMap[nome].push(prog)
        }
      })
      const criticas = Object.values(discMap).filter(progs => (progs.reduce((a,b)=>a+b,0)/progs.length) < limiar).length
      return { below: belowCount, crit: criticas }
    }

    // Progresso Total
    const validProgs = allFilteredData.map(r => parseProgress(r.progressoTotal)).filter(v => v !== null) as number[] 
    const avg_total = validProgs.length > 0 ? Math.round(validProgs.reduce((a,b)=>a+b,0) / validProgs.length) : 0

    let below_expected_count = 0
    allFilteredData.forEach(row => {
      const f1 = parseProgress(row.fase1) || 0
      const f2 = parseProgress(row.fase2) || 0
      const f3 = parseProgress(row.fase3) || 0
      let is_below = false
      if ((hoje > fim_f1 && f1 < 100) || (hoje >= inicio_f1 && hoje <= fim_f1 && f1 < 40)) is_below = true
      if ((hoje > fim_f2 && f2 < 100) || (hoje >= inicio_f2 && hoje <= fim_f2 && f2 < 40)) is_below = true
      if ((hoje > fim_f3 && f3 < 100) || (hoje >= inicio_f3 && hoje <= fim_f3 && f3 < 40)) is_below = true
      if (is_below) below_expected_count++
    })
    const average_below_expected = total_records > 0 ? Math.round((below_expected_count / total_records) * 100) : 0

    // Disciplinas
    const limiar_global = hoje <= fim_f1 ? 33 : (hoje <= fim_f2 ? 66 : 100)
    const discMapGlobal: Record<string, number[]> = {}
    allFilteredData.forEach(row => {
      const nome_disc = row.curso
      const prog_total = parseProgress(row.progressoTotal)
      if (nome_disc && prog_total !== null) {
        if (!discMapGlobal[nome_disc]) discMapGlobal[nome_disc] = []
        discMapGlobal[nome_disc].push(prog_total)
      }
    })
    const disciplinas_criticas_global = Object.values(discMapGlobal).filter(progs => (progs.reduce((a,b)=>a+b,0)/progs.length) < limiar_global).length

    // Sem Acesso
    const termos_sem_acesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"]
    const mats_sem_acesso = allFilteredData.filter(r => termos_sem_acesso.includes((r.lastaccess || "").toLowerCase().trim()))
    const count_mat_sem_acesso = mats_sem_acesso.length
    const percent_mat_sem_acesso = total_records > 0 ? (count_mat_sem_acesso / total_records * 100) : 0

    const todos_alunos = new Set()
    const alunos_com_acesso = new Set()
    allFilteredData.forEach(r => {
      todos_alunos.add(r.matricula)
      if (!termos_sem_acesso.includes((r.lastaccess || "").toLowerCase().trim())) alunos_com_acesso.add(r.matricula)
    })
    const count_alunos_sem_acesso = todos_alunos.size - alunos_com_acesso.size
    const percent_alunos_sem_acesso = todos_alunos.size > 0 ? (count_alunos_sem_acesso / todos_alunos.size * 100) : 0

    // Por fase
    const avgFase = (key: 'fase1'|'fase2'|'fase3') => {
      const vals = allFilteredData.map(r => parseProgress(r[key])).filter(v => v !== null) as number[]
      return vals.length > 0 ? Math.round(vals.reduce((a,b)=>a+b,0) / vals.length) : 0
    }
    const avg_f1 = avgFase('fase1'), status_f1 = calculateFaseStatus(avg_f1, inicio_f1, fim_f1)
    const f1_metrics = getFaseMetricsInternal('fase1', inicio_f1, fim_f1)
    
    let avg_f2 = 0, status_f2 = 'neutral', f2_metrics = {below: 0, crit: 0}
    if (hoje >= inicio_f2) {
      avg_f2 = avgFase('fase2'); status_f2 = calculateFaseStatus(avg_f2, inicio_f2, fim_f2); f2_metrics = getFaseMetricsInternal('fase2', inicio_f2, fim_f2)
    }
    let avg_f3 = 0, status_f3 = 'neutral', f3_metrics = {below: 0, crit: 0}
    if (hoje >= inicio_f3) {
      avg_f3 = avgFase('fase3'); status_f3 = calculateFaseStatus(avg_f3, inicio_f3, fim_f3); f3_metrics = getFaseMetricsInternal('fase3', inicio_f3, fim_f3)
    }

    return {
      page, size, total_records, total_pages, data,
      average_progress: avg_total,
      below_expected: below_expected_count,
      average_below_expected,
      total_disciplines: Object.keys(discMapGlobal).length,
      critical_disciplines: disciplinas_criticas_global,
      average_fase1: avg_f1, status_fase1: status_f1, f1_below: f1_metrics.below, f1_crit: f1_metrics.crit,
      average_fase2: avg_f2, status_fase2: status_f2, f2_below: f2_metrics.below, f2_crit: f2_metrics.crit,
      average_fase3: avg_f3, status_fase3: status_f3, f3_below: f3_metrics.below, f3_crit: f3_metrics.crit,
      count_mat_sem_acesso, percent_mat_sem_acesso, count_alunos_sem_acesso, percent_alunos_sem_acesso,
      total_alunos_unicos: todos_alunos.size
    }
  } catch (error) {
    console.error("Erro:", error)
    throw new Error("Falha ao buscar dados")
  }
}

export async function syncMoodleData(institution?: string, type?: 'grades' | 'progress') {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
    let url = `${baseUrl}/api/ava-sync?`
    
    const params = new URLSearchParams()
    if (institution) params.append('institution', institution.toLowerCase())
    if (type) params.append('type', type)

    const response = await fetch(url + params.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      cache: 'no-store'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Falha na sincronização')
    }
    
    return await response.json()
  } catch (error: any) {
    console.error("Erro na action de sync:", error)
    throw new Error(error.message || "Erro interno na sincronização")
  }
}

export async function getGradesData(page: number, size: number, filters: any) {
  try {
    const offset = (page - 1) * size
    const conditions = []
    if (filters.sourceInstitution) conditions.push(eq(avaGradesReport.sourceInstitution, filters.sourceInstitution))
    if (filters.student_name) conditions.push(ilike(avaGradesReport.studentName, `%${filters.student_name}%`))
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const data = await db.select().from(avaGradesReport).where(whereClause).limit(size).offset(offset)
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(avaGradesReport).where(whereClause)
    return { page, size, total_records: Number(countResult[0]?.count || 0), total_pages: Math.ceil(Number(countResult[0]?.count || 0) / size), data }
  } catch (error) {
    throw new Error("Falha ao buscar dados")
  }
}
