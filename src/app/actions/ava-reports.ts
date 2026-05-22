"use server"

import { auth } from "@/auth"
import { db } from "@/db"
import {
  avaProgressReport,
  avaGradesReport,
  groupSystemAccess,
  systemModules,
  userGroups,
  usersSystemAccess,
} from "@/db/schema"
import { eq, ilike, and, sql } from "drizzle-orm"

type SessionUser = {
  id?: string
  isSuperAdmin?: boolean
  isDisabled?: boolean
}

async function assertAvaAccess() {
  const session = await auth()
  const user = session?.user as SessionUser | undefined

  if (!user?.id || user.isDisabled) {
    throw new Error("Acesso negado.")
  }

  if (user.isSuperAdmin) return

  const directAccess = await db.select({ id: systemModules.id })
    .from(usersSystemAccess)
    .innerJoin(systemModules, eq(usersSystemAccess.systemModuleId, systemModules.id))
    .where(and(
      eq(usersSystemAccess.userId, user.id),
      eq(systemModules.slug, "ava"),
      eq(systemModules.isActive, true)
    ))
    .limit(1)

  if (directAccess.length > 0) return

  const groupAccess = await db.select({ id: systemModules.id })
    .from(userGroups)
    .innerJoin(groupSystemAccess, eq(userGroups.groupId, groupSystemAccess.groupId))
    .innerJoin(systemModules, eq(groupSystemAccess.systemModuleId, systemModules.id))
    .where(and(
      eq(userGroups.userId, user.id),
      eq(systemModules.slug, "ava"),
      eq(systemModules.isActive, true)
    ))
    .limit(1)

  if (groupAccess.length === 0) {
    throw new Error("Acesso negado.")
  }
}

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
  await assertAvaAccess()

  try {
    const conditions = []
    
    if (filters.sourceInstitution) {
      conditions.push(eq(avaProgressReport.sourceInstitution, filters.sourceInstitution))
    }
    if (filters.aluno) conditions.push(ilike(avaProgressReport.aluno, `%${filters.aluno}%`))
    if (filters.curso) conditions.push(ilike(avaProgressReport.curso, `%${filters.curso}%`))
    if (filters.usuario) conditions.push(ilike(avaProgressReport.usuario, `%${filters.usuario}%`))
    if (filters.matricula) conditions.push(ilike(avaProgressReport.matricula, `%${filters.matricula}%`))
    const periodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-1"
    if (periodoFilter) {
      conditions.push(ilike(avaProgressReport.periodo, `%${periodoFilter}%`))
    }
    if (filters.curso_perfil) conditions.push(ilike(avaProgressReport.cursoPerfil, `%${filters.curso_perfil}%`))
    if (filters.periodo_perfil) conditions.push(ilike(avaProgressReport.periodoPerfil, `%${filters.periodo_perfil}%`))
    if (filters.unidade_fisica) conditions.push(ilike(avaProgressReport.unidadeFisica, `%${filters.unidade_fisica}%`))
    if (filters.enrolment_status) conditions.push(ilike(avaProgressReport.enrolmentStatus, `%${filters.enrolment_status}%`))

    // Se lastaccess for um termo geral (não com_acesso ou sem_acesso), adiciona na query
    const acesso_value = filters.lastaccess
    const filtro_inatividade = filters.dias_sem_acesso

    if (acesso_value && acesso_value !== "sem_acesso" && acesso_value !== "com_acesso") {
      conditions.push(ilike(avaProgressReport.lastaccess, `%${acesso_value}%`))
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Busca TODOS os dados do banco para aplicar filtros de memória, dias sem acesso e calcular métricas
    const rawData = await db.select().from(avaProgressReport).where(whereClause)

    const termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"]

    // 1. Filtra por lastaccess (com_acesso/sem_acesso)
    let filteredAccessData = rawData
    if (acesso_value === "sem_acesso") {
      filteredAccessData = rawData.filter(row => 
        termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase())
      )
    } else if (acesso_value === "com_acesso") {
      filteredAccessData = rawData.filter(row => 
        !termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase())
      )
    }

    // 2. Calcula dias_sem_acesso em memória e cria objeto enriquecido
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeTime = hoje.getTime()

    let processedData = filteredAccessData.map(row => {
      let dias: number | string = "-"
      const acessoStr = String(row.lastaccess || "").trim()
      
      if (!acessoStr || termosSemAcesso.includes(acessoStr.toLowerCase())) {
        dias = "-"
      } else {
        try {
          const parts = acessoStr.split("/")
          if (parts.length === 3) {
            const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2])
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const dt = new Date(y, m, d)
              const diff = Math.floor((hojeTime - dt.getTime()) / (1000 * 60 * 60 * 24))
              dias = diff >= 0 ? diff : 0
            }
          }
        } catch (e) {
          dias = "-"
        }
      }
      return {
        ...row,
        diasSemAcesso: String(dias)
      }
    })

    // 3. Aplica o filtro de Inatividade (Dias sem acesso)
    if (filtro_inatividade && filtro_inatividade !== "") {
      try {
        if (filtro_inatividade.includes("-")) {
          const [minD, maxD] = filtro_inatividade.split("-").map(Number)
          processedData = processedData.filter(row => {
            const d = parseInt(row.diasSemAcesso)
            return !isNaN(d) && d >= minD && d <= maxD
          })
        } else {
          const match = filtro_inatividade.match(/\d+/)
          if (match) {
            const valMin = parseInt(match[0])
            processedData = processedData.filter(row => {
              const d = parseInt(row.diasSemAcesso)
              return !isNaN(d) && d >= valMin
            })
          }
        }
      } catch (e) {
        console.error("Erro no filtro de inatividade:", e)
      }
    }

    const allFilteredData = processedData
    const total_records = allFilteredData.length
    const total_pages = Math.ceil(total_records / size)

    // Paginação dos dados filtrados em memória
    const offset = (page - 1) * size
    const data = allFilteredData.slice(offset, offset + size)

    // DATAS DO CALENDÁRIO 2026-1
    const inicio_f1 = new Date(2026, 1, 13) // Fev 13
    const fim_f1 = new Date(2026, 2, 29)    // Mar 29
    const inicio_f2 = new Date(2026, 2, 30)  // Mar 30
    const fim_f2 = new Date(2026, 4, 11)    // Mai 11
    const inicio_f3 = new Date(2026, 4, 12)  // Mai 12
    const fim_f3 = new Date(2026, 5, 19)    // Jun 19

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

    // Progresso Total (Média tratando nulos como 0%)
    const sumTotal = allFilteredData.reduce((acc, r) => acc + (parseProgress(r.progressoTotal) || 0), 0)
    const avg_total = allFilteredData.length > 0 ? Math.round(sumTotal / allFilteredData.length) : 0

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
    const mats_sem_acesso = allFilteredData.filter(r => termosSemAcesso.includes((r.lastaccess || "").toLowerCase().trim()))
    const count_mat_sem_acesso = mats_sem_acesso.length
    const percent_mat_sem_acesso = total_records > 0 ? (count_mat_sem_acesso / total_records * 100) : 0

    const todos_alunos = new Set<string>()
    const alunos_com_acesso = new Set<string>()
    allFilteredData.forEach(r => {
      const aId = r.alunoId || r.matricula
      if (aId) {
        todos_alunos.add(aId)
        if (!termosSemAcesso.includes((r.lastaccess || "").toLowerCase().trim())) {
          alunos_com_acesso.add(aId)
        }
      }
    })
    const count_alunos_sem_acesso = todos_alunos.size - alunos_com_acesso.size
    const percent_alunos_sem_acesso = todos_alunos.size > 0 ? (count_alunos_sem_acesso / todos_alunos.size * 100) : 0

    // Por fase (Média tratando nulos como 0%)
    const avgFase = (key: 'fase1'|'fase2'|'fase3') => {
      const sum = allFilteredData.reduce((acc, r) => acc + (parseProgress(r[key]) || 0), 0)
      return allFilteredData.length > 0 ? Math.round(sum / allFilteredData.length) : 0
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

    // Matrículas em dia: matrículas onde todas as fases ativas estão no limiar esperado
    let matriculas_em_dia = 0
    allFilteredData.forEach(row => {
      const f1 = parseProgress(row.fase1) ?? 0
      const f2 = parseProgress(row.fase2) ?? 0
      const f3 = parseProgress(row.fase3) ?? 0
      let ok = true
      if (hoje >= inicio_f1 && f1 < (hoje > fim_f1 ? 100 : 40)) ok = false
      if (hoje >= inicio_f2 && f2 < (hoje > fim_f2 ? 100 : 40)) ok = false
      if (hoje >= inicio_f3 && f3 < (hoje > fim_f3 ? 100 : 40)) ok = false
      if (ok) matriculas_em_dia++
    })
    const percent_matriculas_em_dia = total_records > 0 ? Math.round((matriculas_em_dia / total_records) * 100) : 0

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
      total_alunos_unicos: todos_alunos.size,
      matriculas_em_dia, percent_matriculas_em_dia
    }
  } catch (error) {
    console.error("Erro:", error)
    throw new Error("Falha ao buscar dados")
  }
}

export async function getProgressExportData(filters: any) {
  await assertAvaAccess()

  try {
    const conditions = []
    if (filters.sourceInstitution) {
      conditions.push(eq(avaProgressReport.sourceInstitution, filters.sourceInstitution))
    }
    if (filters.aluno) conditions.push(ilike(avaProgressReport.aluno, `%${filters.aluno}%`))
    if (filters.curso) conditions.push(ilike(avaProgressReport.curso, `%${filters.curso}%`))
    if (filters.usuario) conditions.push(ilike(avaProgressReport.usuario, `%${filters.usuario}%`))
    if (filters.matricula) conditions.push(ilike(avaProgressReport.matricula, `%${filters.matricula}%`))
    const exportPeriodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-1"
    if (exportPeriodoFilter) {
      conditions.push(ilike(avaProgressReport.periodo, `%${exportPeriodoFilter}%`))
    }
    if (filters.curso_perfil) conditions.push(ilike(avaProgressReport.cursoPerfil, `%${filters.curso_perfil}%`))
    if (filters.periodo_perfil) conditions.push(ilike(avaProgressReport.periodoPerfil, `%${filters.periodo_perfil}%`))
    if (filters.unidade_fisica) conditions.push(ilike(avaProgressReport.unidadeFisica, `%${filters.unidade_fisica}%`))
    if (filters.enrolment_status) conditions.push(ilike(avaProgressReport.enrolmentStatus, `%${filters.enrolment_status}%`))

    const acesso_value = filters.lastaccess
    const filtro_inatividade = filters.dias_sem_acesso

    if (acesso_value && acesso_value !== "sem_acesso" && acesso_value !== "com_acesso") {
      conditions.push(ilike(avaProgressReport.lastaccess, `%${acesso_value}%`))
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const rawData = await db.select().from(avaProgressReport).where(whereClause)

    const termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"]

    let filteredAccessData = rawData
    if (acesso_value === "sem_acesso") {
      filteredAccessData = rawData.filter(row => 
        termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase())
      )
    } else if (acesso_value === "com_acesso") {
      filteredAccessData = rawData.filter(row => 
        !termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase())
      )
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeTime = hoje.getTime()

    let processedData = filteredAccessData.map(row => {
      let dias: number | string = "-"
      const acessoStr = String(row.lastaccess || "").trim()
      
      if (!acessoStr || termosSemAcesso.includes(acessoStr.toLowerCase())) {
        dias = "-"
      } else {
        try {
          const parts = acessoStr.split("/")
          if (parts.length === 3) {
            const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2])
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const dt = new Date(y, m, d)
              const diff = Math.floor((hojeTime - dt.getTime()) / (1000 * 60 * 60 * 24))
              dias = diff >= 0 ? diff : 0
            }
          }
        } catch (e) {
          dias = "-"
        }
      }
      return {
        ...row,
        diasSemAcesso: String(dias)
      }
    })

    if (filtro_inatividade && filtro_inatividade !== "") {
      try {
        if (filtro_inatividade.includes("-")) {
          const [minD, maxD] = filtro_inatividade.split("-").map(Number)
          processedData = processedData.filter(row => {
            const d = parseInt(row.diasSemAcesso)
            return !isNaN(d) && d >= minD && d <= maxD
          })
        } else {
          const match = filtro_inatividade.match(/\d+/)
          if (match) {
            const valMin = parseInt(match[0])
            processedData = processedData.filter(row => {
              const d = parseInt(row.diasSemAcesso)
              return !isNaN(d) && d >= valMin
            })
          }
        }
      } catch (e) {
        console.error("Erro no filtro de inatividade:", e)
      }
    }

    return processedData
  } catch (error) {
    console.error("Erro ao buscar dados para exportação:", error)
    throw new Error("Falha ao exportar dados")
  }
}

export async function syncMoodleData(institution?: string, type?: 'grades' | 'progress') {
  await assertAvaAccess()

  try {
    if (!process.env.CRON_SECRET) {
      throw new Error("CRON_SECRET não configurado.")
    }

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
  await assertAvaAccess()

  try {
    const conditions = []
    
    if (filters.sourceInstitution) conditions.push(eq(avaGradesReport.sourceInstitution, filters.sourceInstitution))
    if (filters.aluno) conditions.push(ilike(avaGradesReport.studentName, `%${filters.aluno}%`))
    if (filters.curso) conditions.push(ilike(avaGradesReport.courseFullname, `%${filters.curso}%`))
    if (filters.usuario) conditions.push(ilike(avaGradesReport.userUsername, `%${filters.usuario}%`))
    if (filters.matricula) conditions.push(ilike(avaGradesReport.userIdentification, `%${filters.matricula}%`))
    const periodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-1"
    if (periodoFilter) conditions.push(ilike(avaGradesReport.periodo, `%${periodoFilter}%`))
    if (filters.curso_perfil) conditions.push(ilike(avaGradesReport.cursoPerfil, `%${filters.curso_perfil}%`))
    if (filters.periodo_perfil) conditions.push(ilike(avaGradesReport.periodoPerfil, `%${filters.periodo_perfil}%`))
    if (filters.unidade_fisica) conditions.push(ilike(avaGradesReport.unidadeFisica, `%${filters.unidade_fisica}%`))
    if (filters.enrolment_status) conditions.push(ilike(avaGradesReport.enrolmentStatus, `%${filters.enrolment_status}%`))

    const acesso_value = filters.lastaccess
    const filtro_inatividade = filters.dias_sem_acesso

    if (acesso_value && acesso_value !== "sem_acesso" && acesso_value !== "com_acesso") {
      conditions.push(ilike(avaGradesReport.lastaccess, `%${acesso_value}%`))
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const rawData = await db.select().from(avaGradesReport).where(whereClause)

    const termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"]

    let filteredAccessData = rawData
    if (acesso_value === "sem_acesso") {
      filteredAccessData = rawData.filter(row => termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase()))
    } else if (acesso_value === "com_acesso") {
      filteredAccessData = rawData.filter(row => !termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase()))
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeTime = hoje.getTime()

    let processedData = filteredAccessData.map(row => {
      let dias: number | string = "-"
      const acessoStr = String(row.lastaccess || "").trim()
      
      if (!acessoStr || termosSemAcesso.includes(acessoStr.toLowerCase())) {
        dias = "-"
      } else {
        try {
          const parts = acessoStr.split("/")
          if (parts.length === 3) {
            const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2])
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const dt = new Date(y, m, d)
              const diff = Math.floor((hojeTime - dt.getTime()) / (1000 * 60 * 60 * 24))
              dias = diff >= 0 ? diff : 0
            }
          }
        } catch (e) {
          dias = "-"
        }
      }
      return {
        ...row,
        diasSemAcesso: String(dias)
      }
    })

    if (filtro_inatividade && filtro_inatividade !== "") {
      try {
        if (filtro_inatividade.includes("-")) {
          const [minD, maxD] = filtro_inatividade.split("-").map(Number)
          processedData = processedData.filter(row => {
            const d = parseInt(row.diasSemAcesso as string)
            return !isNaN(d) && d >= minD && d <= maxD
          })
        } else {
          const match = filtro_inatividade.match(/\d+/)
          if (match) {
            const valMin = parseInt(match[0])
            processedData = processedData.filter(row => {
              const d = parseInt(row.diasSemAcesso as string)
              return !isNaN(d) && d >= valMin
            })
          }
        }
      } catch (e) {
        console.error("Erro no filtro de inatividade:", e)
      }
    }

    const allFilteredData = processedData
    const total_records = allFilteredData.length
    const total_pages = Math.ceil(total_records / size)

    const offset = (page - 1) * size
    const data = allFilteredData.slice(offset, offset + size)

    // Calculo de Métricas de Notas (Usando 60 como limiar)
    const parseGrade = (value: any) => {
      if (value === null || value === undefined || value === "" || value === "-") return null
      const parsed = parseFloat(String(value).replace(",", "."))
      return isNaN(parsed) ? null : parsed
    }

    const avgFase = (key: 'fase1'|'fase2'|'fase3'|'media') => {
      const vals = allFilteredData.map(r => parseGrade(r[key])).filter(v => v !== null) as number[]
      if (vals.length === 0) return 0
      const sum = vals.reduce((a, b) => a + b, 0)
      return Number((sum / vals.length).toFixed(1))
    }

    const avg_f1 = avgFase('fase1')
    const avg_f2 = avgFase('fase2')
    const avg_f3 = avgFase('fase3')
    const avg_total = avgFase('media')

    const limiar = 60
    let below_expected_count = 0
    allFilteredData.forEach(row => {
      const mediaFinal = parseGrade(row.media)
      if (mediaFinal !== null && mediaFinal < limiar) {
        below_expected_count++
      }
    })
    const average_below_expected = total_records > 0 ? Math.round((below_expected_count / total_records) * 100) : 0

    // Métricas de Inatividade
    const matriculas_sem_acesso = allFilteredData.filter(r => r.diasSemAcesso === "-")
    const count_mat_sem_acesso = matriculas_sem_acesso.length
    const percent_mat_sem_acesso = total_records > 0 ? (count_mat_sem_acesso / total_records) * 100 : 0

    const alunosUnicosSet = new Set(allFilteredData.map(r => r.userIdentification || r.studentName))
    const total_alunos_unicos = alunosUnicosSet.size
    const alunosSemAcessoSet = new Set(matriculas_sem_acesso.map(r => r.userIdentification || r.studentName))
    const count_alunos_sem_acesso = alunosSemAcessoSet.size
    const percent_alunos_sem_acesso = total_alunos_unicos > 0 ? (count_alunos_sem_acesso / total_alunos_unicos) * 100 : 0

    return {
      page, size, total_records, total_pages, data,
      average_media: avg_total,
      below_expected: below_expected_count,
      average_below_expected,
      average_fase1: avg_f1,
      average_fase2: avg_f2,
      average_fase3: avg_f3,
      count_mat_sem_acesso,
      percent_mat_sem_acesso,
      count_alunos_sem_acesso,
      percent_alunos_sem_acesso,
      total_alunos_unicos
    }
  } catch (error) {
    console.error("Erro em getGradesData:", error)
    throw new Error("Falha ao buscar dados")
  }
}

export async function exportGradesData(filters: any) {
  await assertAvaAccess()

  try {
    const conditions = []
    if (filters.sourceInstitution) conditions.push(eq(avaGradesReport.sourceInstitution, filters.sourceInstitution))
    if (filters.aluno) conditions.push(ilike(avaGradesReport.studentName, `%${filters.aluno}%`))
    if (filters.curso) conditions.push(ilike(avaGradesReport.courseFullname, `%${filters.curso}%`))
    if (filters.usuario) conditions.push(ilike(avaGradesReport.userUsername, `%${filters.usuario}%`))
    if (filters.matricula) conditions.push(ilike(avaGradesReport.userIdentification, `%${filters.matricula}%`))
    const exportPeriodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-1"
    if (exportPeriodoFilter) conditions.push(ilike(avaGradesReport.periodo, `%${exportPeriodoFilter}%`))
    if (filters.curso_perfil) conditions.push(ilike(avaGradesReport.cursoPerfil, `%${filters.curso_perfil}%`))
    if (filters.periodo_perfil) conditions.push(ilike(avaGradesReport.periodoPerfil, `%${filters.periodo_perfil}%`))
    if (filters.unidade_fisica) conditions.push(ilike(avaGradesReport.unidadeFisica, `%${filters.unidade_fisica}%`))
    if (filters.enrolment_status) conditions.push(ilike(avaGradesReport.enrolmentStatus, `%${filters.enrolment_status}%`))

    const acesso_value = filters.lastaccess
    const filtro_inatividade = filters.dias_sem_acesso

    if (acesso_value && acesso_value !== "sem_acesso" && acesso_value !== "com_acesso") {
      conditions.push(ilike(avaGradesReport.lastaccess, `%${acesso_value}%`))
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const rawData = await db.select().from(avaGradesReport).where(whereClause)

    const termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"]

    let filteredAccessData = rawData
    if (acesso_value === "sem_acesso") {
      filteredAccessData = rawData.filter(row => termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase()))
    } else if (acesso_value === "com_acesso") {
      filteredAccessData = rawData.filter(row => !termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase()))
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeTime = hoje.getTime()

    let processedData = filteredAccessData.map(row => {
      let dias: number | string = "-"
      const acessoStr = String(row.lastaccess || "").trim()
      
      if (!acessoStr || termosSemAcesso.includes(acessoStr.toLowerCase())) {
        dias = "-"
      } else {
        try {
          const parts = acessoStr.split("/")
          if (parts.length === 3) {
            const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2])
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const dt = new Date(y, m, d)
              const diff = Math.floor((hojeTime - dt.getTime()) / (1000 * 60 * 60 * 24))
              dias = diff >= 0 ? diff : 0
            }
          }
        } catch (e) {
          dias = "-"
        }
      }
      return {
        ...row,
        diasSemAcesso: String(dias)
      }
    })

    if (filtro_inatividade && filtro_inatividade !== "") {
      try {
        if (filtro_inatividade.includes("-")) {
          const [minD, maxD] = filtro_inatividade.split("-").map(Number)
          processedData = processedData.filter(row => {
            const d = parseInt(row.diasSemAcesso as string)
            return !isNaN(d) && d >= minD && d <= maxD
          })
        } else {
          const match = filtro_inatividade.match(/\d+/)
          if (match) {
            const valMin = parseInt(match[0])
            processedData = processedData.filter(row => {
              const d = parseInt(row.diasSemAcesso as string)
              return !isNaN(d) && d >= valMin
            })
          }
        }
      } catch (e) {
        console.error("Erro no filtro de inatividade:", e)
      }
    }

    return processedData
  } catch (error) {
    console.error("Erro ao exportar dados de notas:", error)
    throw new Error("Falha ao exportar dados")
  }
}
