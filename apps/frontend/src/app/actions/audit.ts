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
  try {
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
    const res = await fetchFromApi(`/api/audit-logs${queryString}`, { method: "GET" })
    return res || { page: 1, size: 20, total_records: 0, total_pages: 1, data: [] }
  } catch (err: any) {
    console.error("[getAuditLogs Action Error]:", err?.message)
    return { page: 1, size: 20, total_records: 0, total_pages: 1, data: [] }
  }
}

export async function getAuditStats() {
  try {
    const res = await fetchFromApi("/api/audit-logs/stats", { method: "GET" })
    return res || {
      loginsToday: 0,
      loginsFailedToday: 0,
      actionsToday: 0,
      uniqueUsersToday: 0,
      totalLogsWeek: 0,
    }
  } catch (err: any) {
    console.error("[getAuditStats Action Error]:", err?.message)
    return {
      loginsToday: 0,
      loginsFailedToday: 0,
      actionsToday: 0,
      uniqueUsersToday: 0,
      totalLogsWeek: 0,
    }
  }
}

export async function exportAuditLogs(filters: AuditFilters = {}) {
  try {
    const res = await fetchFromApi("/api/audit-logs/export", {
      method: "POST",
      body: JSON.stringify(filters),
    })
    return Array.isArray(res) ? res : []
  } catch (err: any) {
    console.error("[exportAuditLogs Action Error]:", err?.message)
    return []
  }
}
