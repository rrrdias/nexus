"use server"

import { fetchFromApi } from "./api"

export interface TutoriaEngagementFilters {
  periodo?: string
  disciplinaId?: string
  disciplinaCodigo?: string
  grupoRisco?: 'critico' | 'atencao' | 'procrastinacao' | 'autonomo'
  search?: string
  faixaTempo?: string
  recenciaAcesso?: 'todos' | 'mais_7_dias' | 'mais_14_dias' | 'mais_30_dias' | 'sem_acesso'
  page?: number
  limit?: number
}

export async function getTutoriaDashboardSummary(periodo = '2026-2', institution = 'ead') {
  return fetchFromApi(`/api/tutoria/summary?periodo=${periodo}&institution=${institution}`, {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function getTutoriaEngagementList(filters: TutoriaEngagementFilters) {
  const query = new URLSearchParams()
  if (filters.periodo) query.set('periodo', filters.periodo)
  if (filters.disciplinaId) query.set('disciplinaId', filters.disciplinaId)
  if (filters.disciplinaCodigo) query.set('disciplinaCodigo', filters.disciplinaCodigo)
  if (filters.grupoRisco) query.set('grupoRisco', filters.grupoRisco)
  if (filters.search) query.set('search', filters.search)
  if (filters.faixaTempo && filters.faixaTempo !== 'todos') query.set('faixaTempo', filters.faixaTempo)
  if (filters.recenciaAcesso && filters.recenciaAcesso !== 'todos') query.set('recenciaAcesso', filters.recenciaAcesso)
  if (filters.page) query.set('page', String(filters.page))
  if (filters.limit) query.set('limit', String(filters.limit))

  return fetchFromApi(`/api/tutoria/engajamento?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function getTutoriaDisciplinas(periodo = '2026-2', institution = 'ead') {
  return fetchFromApi(`/api/tutoria/disciplinas?periodo=${periodo}&institution=${institution}`, {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function getTutoriaExportData(filters: TutoriaEngagementFilters) {
  const query = new URLSearchParams()
  if (filters.periodo) query.set('periodo', filters.periodo)
  if (filters.disciplinaId) query.set('disciplinaId', filters.disciplinaId)
  if (filters.disciplinaCodigo) query.set('disciplinaCodigo', filters.disciplinaCodigo)
  if (filters.grupoRisco) query.set('grupoRisco', filters.grupoRisco)
  if (filters.search) query.set('search', filters.search)
  if (filters.faixaTempo && filters.faixaTempo !== 'todos') query.set('faixaTempo', filters.faixaTempo)
  if (filters.recenciaAcesso && filters.recenciaAcesso !== 'todos') query.set('recenciaAcesso', filters.recenciaAcesso)

  return fetchFromApi(`/api/tutoria/exportar?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function getTutoriaStudentLogs(matricula: string, disciplinaId?: string) {
  const query = disciplinaId ? `?disciplinaId=${disciplinaId}` : ''
  return fetchFromApi(`/api/tutoria/aluno/${matricula}/logs${query}`, {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function getTutoriaSyncStatus() {
  return fetchFromApi('/api/tutoria/sync/status', {
    method: 'GET',
  })
}

export async function triggerTutoriaManualSync(institution = 'ead') {
  return fetchFromApi('/api/tutoria/sync', {
    method: 'POST',
    body: JSON.stringify({ institution }),
  })
}
