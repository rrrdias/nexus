"use server"

import { fetchFromApi } from "./api"

export interface AuditFilters {
  page?: number
  size?: number
  search?: string
  category?: string
  status?: string
  userId?: string
  startDate?: string
  endDate?: string
}

export async function getAuditLogs(filters: AuditFilters = {}) {
  const params = new URLSearchParams()
  if (filters.page) params.set("page", String(filters.page))
  if (filters.size) params.set("size", String(filters.size))
  if (filters.search) params.set("search", filters.search)
  if (filters.category && filters.category !== "ALL") params.set("category", filters.category)
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status)
  if (filters.userId) params.set("userId", filters.userId)
  if (filters.startDate) params.set("startDate", filters.startDate)
  if (filters.endDate) params.set("endDate", filters.endDate)

  const queryString = params.toString() ? `?${params.toString()}` : ""
  return fetchFromApi(`/api/audit-logs${queryString}`, { method: "GET" })
}

export async function getAuditStats() {
  return fetchFromApi("/api/audit-logs/stats", { method: "GET" })
}

export async function exportAuditLogs(filters: AuditFilters = {}) {
  return fetchFromApi("/api/audit-logs/export", {
    method: "POST",
    body: JSON.stringify(filters),
  })
}
