/**
 * Scheduling Utilities for Nexus Core
 * Manages consecutive 30-minute exam slots, past-time filtering, and date vacancy aggregations.
 */

export interface SchedulingOption {
  id: string
  localId: string
  localNome?: string
  data: string | Date
  hora: string // "HH:MM" or "HH:MM:SS"
  vagas: number
  status: boolean
}

export interface DateStatusInfo {
  status: "available" | "full" | "none"
  slotsCount: number
  validStartSlotsCount: number
  totalVagas: number
}

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== "string") return null
  const match = timeStr.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  return h * 60 + m
}

export function minutesToTimeStr(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function getNextTimeStr(timeStr: string, index: number): string {
  const startMin = parseTimeToMinutes(timeStr)
  if (startMin === null) return "00:00"
  return minutesToTimeStr(startMin + index * 30)
}

export function getExamEndTime(startTime: string, disciplinesCount: number): string {
  if (!startTime) return ""
  const startMin = parseTimeToMinutes(startTime)
  if (startMin === null) return ""
  const totalMinutes = startMin + Math.max(1, disciplinesCount) * 30
  return minutesToTimeStr(totalMinutes)
}

export function normalizeDateStr(dateValue: any): string {
  if (!dateValue) return ""
  if (typeof dateValue === "string") {
    // If ISO string like "2026-10-23T00:00:00.000Z"
    if (dateValue.includes("T")) {
      return dateValue.split("T")[0]
    }
    // If plain "2026-10-23"
    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateValue
    }
  }
  const dt = new Date(dateValue)
  if (isNaN(dt.getTime())) return ""
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const d = String(dt.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function getTodayDateStr(referenceDate: Date = new Date()): string {
  const y = referenceDate.getFullYear()
  const m = String(referenceDate.getMonth() + 1).padStart(2, "0")
  const d = String(referenceDate.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Checks if a slot on a given date has already passed relative to current time.
 */
export function isSlotInPast(
  dateStr: string,
  timeStr: string,
  referenceDate: Date = new Date()
): boolean {
  const todayStr = getTodayDateStr(referenceDate)
  if (dateStr < todayStr) return true
  if (dateStr > todayStr) return false

  // Date is today: compare time with current time
  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes()
  const slotMinutes = parseTimeToMinutes(timeStr)
  if (slotMinutes === null) return true

  return slotMinutes <= currentMinutes
}

/**
 * Filters slots on a specific date to return ONLY valid starting slots that can
 * accommodate all consecutive disciplines with available capacity (vagas > 0)
 * and are not in the past.
 */
export function filterValidStartSlots(
  slotsOnDate: SchedulingOption[],
  disciplinesCount: number,
  dateStr: string,
  referenceDate: Date = new Date()
): SchedulingOption[] {
  const requiredCount = Math.max(1, disciplinesCount)
  if (!slotsOnDate || slotsOnDate.length === 0) return []

  // Create lookup map indexed by normalized "HH:MM"
  const slotMap = new Map<string, SchedulingOption>()
  for (const slot of slotsOnDate) {
    if (slot.status) {
      const timeKey = slot.hora.slice(0, 5)
      slotMap.set(timeKey, slot)
    }
  }

  const validStartSlots: SchedulingOption[] = []

  // Sort slots by time ascending
  const sortedSlots = [...slotsOnDate]
    .filter(s => s.status)
    .sort((a, b) => {
      const minA = parseTimeToMinutes(a.hora) ?? 0
      const minB = parseTimeToMinutes(b.hora) ?? 0
      return minA - minB
    })

  for (const candidate of sortedSlots) {
    const candidateTime = candidate.hora.slice(0, 5)

    // Rule: Cannot be in the past for today's date
    if (isSlotInPast(dateStr, candidateTime, referenceDate)) {
      continue
    }

    // Rule: Candidate must have vacancies
    if (candidate.vagas <= 0) {
      continue
    }

    // Rule: All N consecutive 30-min slots must exist, be active and have vacancies > 0
    let canAccommodateAll = true
    for (let i = 0; i < requiredCount; i++) {
      const requiredTime = getNextTimeStr(candidateTime, i)
      const slotForInterval = slotMap.get(requiredTime)
      if (!slotForInterval || !slotForInterval.status || slotForInterval.vagas <= 0) {
        canAccommodateAll = false
        break
      }
    }

    if (canAccommodateAll) {
      validStartSlots.push(candidate)
    }
  }

  return validStartSlots
}

/**
 * Aggregates all polo options across dates to produce calendar status indicators.
 */
export function calculateDatesStatus(
  allOptions: SchedulingOption[],
  disciplinesCount: number,
  referenceDate: Date = new Date()
): Record<string, DateStatusInfo> {
  const result: Record<string, DateStatusInfo> = {}
  if (!allOptions || allOptions.length === 0) return result

  // Group by dateStr
  const optionsByDate: Record<string, SchedulingOption[]> = {}
  for (const opt of allOptions) {
    if (!opt.status) continue
    const dateStr = normalizeDateStr(opt.data)
    if (!dateStr) continue
    if (!optionsByDate[dateStr]) {
      optionsByDate[dateStr] = []
    }
    optionsByDate[dateStr].push(opt)
  }

  // Calculate status for each date
  for (const [dateStr, slotsOnDate] of Object.entries(optionsByDate)) {
    const totalVagas = slotsOnDate.reduce((acc, s) => acc + Math.max(0, s.vagas || 0), 0)
    const validStartSlots = filterValidStartSlots(slotsOnDate, disciplinesCount, dateStr, referenceDate)

    const status: "available" | "full" | "none" =
      validStartSlots.length > 0 ? "available" : slotsOnDate.length > 0 ? "full" : "none"

    result[dateStr] = {
      status,
      slotsCount: slotsOnDate.length,
      validStartSlotsCount: validStartSlots.length,
      totalVagas
    }
  }

  return result
}
