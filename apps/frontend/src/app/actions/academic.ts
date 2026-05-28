"use server"

import { fetchFromApi } from "./api"

export async function getStudents(filters: { search?: string; page?: number; size?: number } = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.size) params.append('size', String(filters.size))

    const res = await fetchFromApi(`/api/academic/discentes?${params.toString()}`, { method: 'GET' })
    return { success: true, data: res }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao consultar discentes." }
  }
}

export async function getStudentDisciplines(matricula: string) {
  try {
    const res = await fetchFromApi(`/api/academic/discentes/${matricula}/disciplinas`, { method: 'GET' })
    return { success: true, data: res.data || [] }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao consultar disciplinas do aluno." }
  }
}

export async function getTeachers(filters: { search?: string; page?: number; size?: number } = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.size) params.append('size', String(filters.size))

    const res = await fetchFromApi(`/api/academic/docentes?${params.toString()}`, { method: 'GET' })
    return { success: true, data: res }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao consultar docentes." }
  }
}

export async function getTeacherDisciplines(docenteId: string) {
  try {
    const res = await fetchFromApi(`/api/academic/docentes/${docenteId}/disciplinas`, { method: 'GET' })
    return { success: true, data: res.data || [] }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao consultar disciplinas do docente." }
  }
}

export async function getClasses(filters: { search?: string; page?: number; size?: number } = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.size) params.append('size', String(filters.size))

    const res = await fetchFromApi(`/api/academic/turmas?${params.toString()}`, { method: 'GET' })
    return { success: true, data: res }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao consultar turmas." }
  }
}

export async function getMatriculas(filters: { search?: string; page?: number; size?: number } = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.size) params.append('size', String(filters.size))

    const res = await fetchFromApi(`/api/academic/matriculas?${params.toString()}`, { method: 'GET' })
    return { success: true, data: res }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao consultar matrículas." }
  }
}
