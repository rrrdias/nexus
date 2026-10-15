import assert from "node:assert/strict"
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  getNextTimeStr,
  getExamEndTime,
  normalizeDateStr,
  isSlotInPast,
  filterValidStartSlots,
  calculateDatesStatus,
  SchedulingOption
} from "./scheduling-utils"

console.log("Starting tests for scheduling-utils.ts...")

// Test 1: parseTimeToMinutes & minutesToTimeStr
{
  assert.equal(parseTimeToMinutes("08:00"), 480)
  assert.equal(parseTimeToMinutes("08:30"), 510)
  assert.equal(parseTimeToMinutes("13:45:00"), 13 * 60 + 45)
  assert.equal(parseTimeToMinutes(""), null)
  assert.equal(parseTimeToMinutes("invalid"), null)

  assert.equal(minutesToTimeStr(480), "08:00")
  assert.equal(minutesToTimeStr(510), "08:30")
  assert.equal(minutesToTimeStr(13 * 60 + 45), "13:45")
  console.log("✓ Test 1: Time string parsing and formatting passed")
}

// Test 2: getNextTimeStr & getExamEndTime
{
  assert.equal(getNextTimeStr("08:00", 0), "08:00")
  assert.equal(getNextTimeStr("08:00", 1), "08:30")
  assert.equal(getNextTimeStr("08:00", 4), "10:00")

  // 1 discipline = 30 min (08:00 to 08:30)
  assert.equal(getExamEndTime("08:00", 1), "08:30")
  // 5 disciplines = 150 min (08:00 to 10:30)
  assert.equal(getExamEndTime("08:00", 5), "10:30")
  // 2 disciplines = 60 min (13:00 to 14:00)
  assert.equal(getExamEndTime("13:00", 2), "14:00")
  console.log("✓ Test 2: Consecutive time calculation and exam end time passed")
}

// Test 3: isSlotInPast (Today blocking rule)
{
  const refDate = new Date(2026, 9, 23, 13, 0, 0) // Oct 23, 2026 at 13:00

  // Past dates
  assert.equal(isSlotInPast("2026-10-22", "14:00", refDate), true)
  // Future dates
  assert.equal(isSlotInPast("2026-10-24", "08:00", refDate), false)

  // Today (2026-10-23):
  // 08:00 is past 13:00 -> true
  assert.equal(isSlotInPast("2026-10-23", "08:00", refDate), true)
  // 12:30 is past 13:00 -> true
  assert.equal(isSlotInPast("2026-10-23", "12:30", refDate), true)
  // 13:00 is equal to current time -> true (cannot book past/current slot)
  assert.equal(isSlotInPast("2026-10-23", "13:00", refDate), true)
  // 13:30 is future relative to 13:00 -> false (can be booked)
  assert.equal(isSlotInPast("2026-10-23", "13:30", refDate), false)
  // 14:00 is future relative to 13:00 -> false
  assert.equal(isSlotInPast("2026-10-23", "14:00", refDate), false)

  // Critical: UTC Server Timezone handling for Brazil (America/Sao_Paulo)
  // When UTC clock is 17:35:00Z, Brazilian local time is 14:35.
  const utcServerDate = new Date("2026-10-15T17:35:00.000Z")
  // 15:00 is in 25 minutes (future) -> MUST NOT BE IN PAST (false)
  assert.equal(isSlotInPast("2026-10-15", "15:00", utcServerDate), false)
  // 14:30 is in the past -> MUST BE IN PAST (true)
  assert.equal(isSlotInPast("2026-10-15", "14:30", utcServerDate), true)
  // 14:35 is equal to current time -> MUST BE IN PAST (true)
  assert.equal(isSlotInPast("2026-10-15", "14:35", utcServerDate), true)

  console.log("✓ Test 3: Past time blocking relative to current time in America/Sao_Paulo passed")
}

// Test 4: filterValidStartSlots (Only show slots accommodating all disciplines)
{
  const testDate = "2026-10-25" // Sunday (future date)
  const refDate = new Date(2026, 9, 23, 10, 0, 0)

  // Mock slots from 08:00 to 11:00 (every 30 min)
  // 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00 (7 slots)
  const times = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"]
  const makeSlots = (vacancies: Record<string, number> = {}): SchedulingOption[] =>
    times.map((t, idx) => ({
      id: `slot-${idx}`,
      localId: "local-1",
      data: testDate,
      hora: t,
      vagas: vacancies[t] !== undefined ? vacancies[t] : 5,
      status: true
    }))

  // Scenario A: Student with 1 discipline (needs 1 slot of 30 min)
  // All 7 slots should be valid start slots
  {
    const slots = makeSlots()
    const valid = filterValidStartSlots(slots, 1, testDate, refDate)
    assert.equal(valid.length, 7)
    assert.equal(valid[0].hora, "08:00")
    assert.equal(valid[6].hora, "11:00")
  }

  // Scenario B: Student with 5 disciplines (needs 5 consecutive slots: 150 min)
  // 08:00 needs: 08:00, 08:30, 09:00, 09:30, 10:00 -> Valid!
  // 08:30 needs: 08:30, 09:00, 09:30, 10:00, 10:30 -> Valid!
  // 09:00 needs: 09:00, 09:30, 10:00, 10:30, 11:00 -> Valid!
  // 09:30 needs: 09:30, 10:00, 10:30, 11:00, 11:30 -> 11:30 doesn't exist -> INVALID!
  // 10:00 needs: 10:00, 10:30, 11:00, 11:30, 12:00 -> INVALID!
  // 10:30, 11:00 -> INVALID!
  // Expected valid start slots: exactly 3 slots (08:00, 08:30, 09:00)
  {
    const slots = makeSlots()
    const valid = filterValidStartSlots(slots, 5, testDate, refDate)
    assert.equal(valid.length, 3)
    assert.deepEqual(valid.map(s => s.hora), ["08:00", "08:30", "09:00"])
  }

  // Scenario C: Middle slot has 0 vacancies (vagas = 0 at 09:00)
  // 08:00 needs 09:00 -> INVALID!
  // 08:30 needs 09:00 -> INVALID!
  // 09:00 has 0 vagas -> INVALID!
  // 09:30 needs 11:30 -> INVALID!
  // Result for 5 disciplines: 0 valid slots!
  {
    const slots = makeSlots({ "09:00": 0 })
    const valid = filterValidStartSlots(slots, 5, testDate, refDate)
    assert.equal(valid.length, 0)
  }

  // Scenario D: Today past-time blocking inside filterValidStartSlots
  // Today is 2026-10-23, reference time is 09:15
  // Slots before or at 09:15 (08:00, 08:30, 09:00) are in the past!
  {
    const todayDate = "2026-10-23"
    const todayRef = new Date(2026, 9, 23, 9, 15, 0)
    const slots = makeSlots()
    // For 2 disciplines (needs 2 consecutive slots):
    // 08:00 -> past -> excluded
    // 08:30 -> past -> excluded
    // 09:00 -> past -> excluded
    // 09:30 -> future (needs 09:30, 10:00) -> valid!
    // 10:00 -> future (needs 10:00, 10:30) -> valid!
    // 10:30 -> future (needs 10:30, 11:00) -> valid!
    // 11:00 -> future (needs 11:00, 11:30 -> missing 11:30) -> excluded
    const valid = filterValidStartSlots(slots, 2, todayDate, todayRef)
    assert.equal(valid.length, 3)
    assert.deepEqual(valid.map(s => s.hora), ["09:30", "10:00", "10:30"])
  }

  console.log("✓ Test 4: filterValidStartSlots with consecutive blocks & past-time filtering passed")
}

// Test 5: calculateDatesStatus (Calendar indicators: available, full, none)
{
  const refDate = new Date(2026, 9, 23, 10, 0, 0)
  const allOptions: SchedulingOption[] = [
    // Date 1: 2026-10-24 has 5 consecutive slots with vacancies
    { id: "1", localId: "L1", data: "2026-10-24", hora: "08:00", vagas: 5, status: true },
    { id: "2", localId: "L1", data: "2026-10-24", hora: "08:30", vagas: 5, status: true },
    { id: "3", localId: "L1", data: "2026-10-24", hora: "09:00", vagas: 5, status: true },

    // Date 2: 2026-10-25 has slots but 0 vacancies (full / esgotado)
    { id: "4", localId: "L1", data: "2026-10-25", hora: "08:00", vagas: 0, status: true },
    { id: "5", localId: "L1", data: "2026-10-25", hora: "08:30", vagas: 0, status: true },

    // Date 3: 2026-10-26 has only 1 slot with vacancies (cannot accommodate 2 disciplines)
    { id: "6", localId: "L1", data: "2026-10-26", hora: "08:00", vagas: 5, status: true }
  ]

  // For a student with 2 disciplines:
  const statusMap = calculateDatesStatus(allOptions, 2, refDate)

  // Date 1: 08:00 + 08:30 is valid -> available
  assert.equal(statusMap["2026-10-24"].status, "available")
  assert.equal(statusMap["2026-10-24"].validStartSlotsCount >= 1, true)

  // Date 2: slots exist but 0 vagas -> full
  assert.equal(statusMap["2026-10-25"].status, "full")
  assert.equal(statusMap["2026-10-25"].validStartSlotsCount, 0)

  // Date 3: only 1 slot, student needs 2 consecutive slots -> full
  assert.equal(statusMap["2026-10-26"].status, "full")
  assert.equal(statusMap["2026-10-26"].validStartSlotsCount, 0)

  console.log("✓ Test 5: calculateDatesStatus calendar indicators passed")
}

console.log("\nAll scheduling-utils tests passed successfully!")
