/**
 * apps/frontend/src/lib/tutoria-tier5-adversarial.test.ts
 *
 * Tier 5: Adversarial Hardening & White-Box Stress Test Suite
 * Multi-Tutor Hybrid Attendance, Timeline & Audit Trail (NexusHub Tutoria)
 *
 * Covers:
 * 1. Server Actions HTTP Resilience (400, 401, 403, 404, 500, 503, HTML error pages, malformed payloads)
 * 2. Baton Pass Validation Engine (empty, whitespace, short note, self-transfer, unassigned cards, unicode)
 * 3. Timeline Presentation & Date Utilities (missing authors, invalid dates, extreme timestamps, calendar buckets)
 * 4. Lead Tutor Resolution & Authority Badges (casing, nulls, self vs collaborator vs lead)
 * 5. Recent Activity Pulse Badge 48h Boundary Analysis (exact boundaries, clock skew, epoch, future anomalies)
 * 6. Kanban Client State Mutation & Ownership Preservation (drag-and-drop state, baton pass synchronization)
 *
 * Execution:
 *   npx tsx apps/frontend/src/lib/tutoria-tier5-adversarial.test.ts
 */

import assert from "node:assert/strict"

// ----------------------------------------------------------------------------
// 1. Environment & Global Fetch Mock Infrastructure
// ----------------------------------------------------------------------------
process.env.TEST_AUTH_TOKEN = "mock-jwt-tier5-adversarial-token"
process.env.NEXT_API_URL = "http://127.0.0.1:3999"

let capturedRequest: {
  url: string
  method: string
  headers: Record<string, string>
  body: any
} | null = null

let mockResponseHandler: (url: string, method: string, body: any) => Response = () => {
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = input.toString()
  const method = init?.method || "GET"
  const rawHeaders = init?.headers || {}
  const headers: Record<string, string> = {}

  if (rawHeaders instanceof Headers) {
    rawHeaders.forEach((v, k) => {
      headers[k] = v
    })
  } else if (Array.isArray(rawHeaders)) {
    rawHeaders.forEach(([k, v]) => {
      headers[k] = v
    })
  } else {
    Object.assign(headers, rawHeaders)
  }

  let body = null
  if (init?.body) {
    try {
      body = JSON.parse(init.body as string)
    } catch {
      body = init.body
    }
  }

  capturedRequest = { url, method, headers, body }
  return mockResponseHandler(url, method, body)
}

// ----------------------------------------------------------------------------
// 2. Genuine Imports Under Test
// ----------------------------------------------------------------------------
import {
  getTutoriaTimeline,
  createTutoriaIntervention,
  transferirTutoriaBastao,
  getTutoriaTutores,
  getTutoresAtivos,
  updateTutoriaKanbanCard,
  getTutoriaKanbanCards,
} from "../app/actions/tutoria"

import {
  formatTimelineEventDate,
  groupTimelineEventsByDate,
  getAuthorBadge,
  validateBatonPassInput,
  getLeadTutorInfo,
  checkRecentIntervention,
  type TimelineEvent,
  type ActiveTutor,
} from "./tutoria-utils"

// ----------------------------------------------------------------------------
// 3. Test Runner Framework
// ----------------------------------------------------------------------------
let passed = 0
let failed = 0

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    if (err.stack) {
      console.error(`    ${err.stack.split("\n").slice(1, 3).join("\n")}`)
    }
    failed++
  }
}

// ----------------------------------------------------------------------------
// 4. Test Suite Execution
// ----------------------------------------------------------------------------
async function runTier5AdversarialSuite() {
  console.log("================================================================================")
  console.log("NexusHub Tutoria: Tier 5 Frontend Adversarial Hardening Suite")
  console.log("================================================================================\n")

  // ==========================================================================
  // SECTION 1: Server Actions HTTP Resilience & Error Handling (400, 401, 403, 500, HTML)
  // ==========================================================================
  console.log("--- Section 1: Server Actions Error Resilience (HTTP 400, 401, 403, 500, Non-JSON) ---")

  await test("ADV-SA-01: getTutoriaTimeline rejects whitespace matricula before HTTP call", async () => {
    capturedRequest = null
    const res = await getTutoriaTimeline("   ")
    assert.equal(res.success, false)
    assert.equal(res.error, "Matrícula é obrigatória.")
    assert.equal(capturedRequest, null, "Should not dispatch fetch request")
  })

  await test("ADV-SA-02: getTutoriaTimeline handles 400 Bad Request with structured error message", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ message: "Formato de matrícula inválido." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })

    const res = await getTutoriaTimeline("INV-@@@")
    assert.equal(res.success, false)
    assert.match(res.error || "", /Formato de matrícula inválido/)
    assert.deepEqual(res.events, [])
  })

  await test("ADV-SA-03: getTutoriaTimeline handles 403 Forbidden without crashing", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ message: "Acesso restrito ao módulo de tutoria." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })

    const res = await getTutoriaTimeline("20240199")
    assert.equal(res.success, false)
    assert.match(res.error || "", /Acesso restrito/)
    assert.deepEqual(res.events, [])
  })

  await test("ADV-SA-04: getTutoriaTimeline handles 500 with non-JSON HTML body (e.g. Gateway/Nginx crash)", async () => {
    mockResponseHandler = () =>
      new Response("<html><body>502 Bad Gateway / Internal Server Error</body></html>", {
        status: 500,
        headers: { "Content-Type": "text/html" },
      })

    const res = await getTutoriaTimeline("20240199")
    assert.equal(res.success, false)
    assert.match(res.error || "", /Erro HTTP 500 na API/)
    assert.deepEqual(res.events, [])
  })

  await test("ADV-SA-05: getTutoriaTimeline parses alternate wrapped responses { data: [...] } and { events: [...] }", async () => {
    const mockList = [
      {
        id: "evt-wrapped",
        matricula: "20240199",
        tipoEvento: "abertura" as const,
        autorId: "t1",
        autorNome: "Tutor Teste",
        createdAt: "2026-11-01T10:00:00Z",
      },
    ]

    mockResponseHandler = () => new Response(JSON.stringify({ data: mockList }), { status: 200 })
    const resData = await getTutoriaTimeline("20240199")
    assert.equal(resData.success, true)
    assert.equal(resData.events.length, 1)

    mockResponseHandler = () => new Response(JSON.stringify({ events: mockList }), { status: 200 })
    const resEvents = await getTutoriaTimeline("20240199")
    assert.equal(resEvents.success, true)
    assert.equal(resEvents.events.length, 1)
  })

  await test("ADV-SA-06: getTutoriaTimeline properly encodes special characters and slashes in matricula", async () => {
    mockResponseHandler = () => new Response(JSON.stringify([]), { status: 200 })
    await getTutoriaTimeline("MAT/2026-A#99", "card/special-1")

    assert.ok(capturedRequest)
    assert.match(capturedRequest!.url, /MAT%2F2026-A%2399/)
    assert.match(capturedRequest!.url, /atendimentoId=card%2Fspecial-1/)
  })

  await test("ADV-SA-07: createTutoriaIntervention rejects empty and whitespace-only notes", async () => {
    capturedRequest = null
    const res1 = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "",
    })
    assert.equal(res1.success, false)
    assert.equal(capturedRequest, null)

    const res2 = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "     \t\n   ",
    })
    assert.equal(res2.success, false)
    assert.equal(capturedRequest, null)
  })

  await test("ADV-SA-08: createTutoriaIntervention preserves HTML and script strings without unescaped execution", async () => {
    const dangerousNote = `<script>alert('xss')</script><img src="x" onerror="stealCookie()"/>`
    mockResponseHandler = (_url, _method, body) =>
      new Response(JSON.stringify({ id: "evt-xss", ...body }), { status: 201 })

    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: dangerousNote,
    })

    assert.equal(res.success, true)
    assert.equal(capturedRequest?.body.observacoes, dangerousNote)
  })

  await test("ADV-SA-09: transferirTutoriaBastao rejects note shorter than 5 characters after trimming", async () => {
    capturedRequest = null
    const res = await transferirTutoriaBastao("card-1", {
      novoTutorId: "tutor-2",
      notaTransicao: "  abcd  ",
    })
    assert.equal(res.success, false)
    assert.match(res.error || "", /mínimo 5 caracteres/)
    assert.equal(capturedRequest, null)
  })

  await test("ADV-SA-10: transferirTutoriaBastao handles backend 400 rejection (already assigned)", async () => {
    mockResponseHandler = () =>
      new Response(
        JSON.stringify({ message: "O discente já possui este tutor como responsável principal." }),
        { status: 400 }
      )

    const res = await transferirTutoriaBastao("card-1", {
      novoTutorId: "tutor-current",
      notaTransicao: "Tentativa de auto-atribuição duplicada",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /já possui este tutor como responsável/)
  })

  await test("ADV-SA-11: getTutoriaTutores handles backend 500 error and returns empty array safely", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ message: "Erro de conexão ao banco de tutores." }), {
        status: 500,
      })

    const res = await getTutoriaTutores()
    assert.equal(res.success, false)
    assert.deepEqual(res.tutores, [])
    assert.match(res.error || "", /Erro de conexão/)
  })

  await test("ADV-SA-12: updateTutoriaKanbanCard handles 404 Not Found and returns error object", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ message: "Atendimento card-unknown não encontrado." }), {
        status: 404,
      })

    const res = await updateTutoriaKanbanCard("card-unknown", { statusKanban: "em_recuperacao" })
    assert.equal(res.success, false)
    assert.match(res.error || "", /não encontrado/)
  })

  // ==========================================================================
  // SECTION 2: Baton Pass Input Validation Engine (`validateBatonPassInput`)
  // ==========================================================================
  console.log("\n--- Section 2: Baton Pass Validation Engine (validateBatonPassInput) ---")

  await test("ADV-BP-01: Rejects null, undefined, empty, and whitespace new tutor ID", () => {
    assert.deepEqual(validateBatonPassInput("", "current-tutor", "Nota válida para teste"), {
      valid: false,
      error: "Selecione o novo tutor responsável.",
    })
    assert.deepEqual(validateBatonPassInput("   \t  ", "current-tutor", "Nota válida para teste"), {
      valid: false,
      error: "Selecione o novo tutor responsável.",
    })
    assert.deepEqual(validateBatonPassInput(null as any, "current-tutor", "Nota válida para teste"), {
      valid: false,
      error: "Selecione o novo tutor responsável.",
    })
  })

  await test("ADV-BP-02: Enforces self-transfer guard (target === current lead tutor)", () => {
    const resExact = validateBatonPassInput("tutor-same", "tutor-same", "Nota válida pedagógica")
    assert.equal(resExact.valid, false)
    assert.match(resExact.error || "", /diferente do tutor responsável atual/)

    // Com whitespace
    const resWhitespace = validateBatonPassInput(" tutor-same ", "tutor-same", "Nota válida pedagógica")
    assert.equal(resWhitespace.valid, false)
    assert.match(resWhitespace.error || "", /diferente do tutor responsável atual/)
  })

  await test("ADV-BP-03: Allows assigning tutor to unassigned card (currentTutorId is null/empty)", () => {
    const resNull = validateBatonPassInput("tutor-new", null, "Atribuição inicial de tutor")
    assert.equal(resNull.valid, true)

    const resEmpty = validateBatonPassInput("tutor-new", "", "Atribuição inicial de tutor")
    assert.equal(resEmpty.valid, true)
  })

  await test("ADV-BP-04: Enforces minimum note length boundary (0, 4, 5 chars)", () => {
    assert.equal(validateBatonPassInput("tutor-new", "tutor-old", "").valid, false)
    assert.equal(validateBatonPassInput("tutor-new", "tutor-old", "1234").valid, false)
    assert.equal(validateBatonPassInput("tutor-new", "tutor-old", "  1234  ").valid, false)
    assert.equal(validateBatonPassInput("tutor-new", "tutor-old", "12345").valid, true)
    assert.equal(validateBatonPassInput("tutor-new", "tutor-old", "  12345  ").valid, true)
  })

  await test("ADV-BP-05: Handles extreme note lengths (5,000 chars) and unicode / emojis", () => {
    const largeNote = "A".repeat(5000)
    assert.equal(validateBatonPassInput("tutor-new", "tutor-old", largeNote).valid, true)

    const unicodeNote = "Transferência para Profa. Inês: reforço em Cálculo I 📚✏️"
    assert.equal(validateBatonPassInput("tutor-new", "tutor-old", unicodeNote).valid, true)
  })

  // ==========================================================================
  // SECTION 3: Timeline Presentation & Date Utilities (`formatTimelineEventDate`, `groupTimelineEventsByDate`)
  // ==========================================================================
  console.log("\n--- Section 3: Timeline Presentation & Date Utilities ---")

  await test("ADV-TL-01: formatTimelineEventDate returns 'Data inválida' for null, undefined, empty, or garbage", () => {
    assert.equal(formatTimelineEventDate(""), "Data inválida")
    assert.equal(formatTimelineEventDate(null as any), "Data inválida")
    assert.equal(formatTimelineEventDate(undefined as any), "Data inválida")
    assert.equal(formatTimelineEventDate("garbage-non-date"), "Data inválida")
  })

  await test("ADV-TL-02: formatTimelineEventDate formats leap years, epoch, and future timestamps accurately", () => {
    const leapDate = formatTimelineEventDate("2024-02-29T15:30:00Z")
    assert.match(leapDate, /29\/02\/2024/)

    const futureDate = formatTimelineEventDate("2099-12-31T23:59:59Z")
    assert.match(futureDate, /31\/12\/2099/)
  })

  await test("ADV-TL-03: groupTimelineEventsByDate handles empty, null, and corrupt event collections", () => {
    assert.deepEqual(groupTimelineEventsByDate([]), {})
    assert.deepEqual(groupTimelineEventsByDate(null as any), {})

    const corruptEvents: any[] = [
      null,
      undefined,
      {},
      { id: "e1" }, // missing createdAt
      { id: "e2", createdAt: "invalid-iso" },
    ]
    assert.deepEqual(groupTimelineEventsByDate(corruptEvents), {})
  })

  await test("ADV-TL-04: groupTimelineEventsByDate correctly buckets 'Hoje', 'Ontem', and past dates", () => {
    const now = new Date()
    const todayIso = now.toISOString()

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yestIso = yesterday.toISOString()

    const pastDate = new Date(now)
    pastDate.setDate(pastDate.getDate() - 5)
    const pastIso = pastDate.toISOString()

    const events: TimelineEvent[] = [
      {
        id: "e-today",
        matricula: "202401",
        tipoEvento: "intervencao_manual",
        autorId: "t1",
        autorNome: "Tutor 1",
        createdAt: todayIso,
      },
      {
        id: "e-yesterday",
        matricula: "202401",
        tipoEvento: "contato_enviado",
        canalContato: "whatsapp",
        autorId: "t2",
        autorNome: "Tutor 2",
        createdAt: yestIso,
      },
      {
        id: "e-past",
        matricula: "202401",
        tipoEvento: "abertura",
        autorId: "t1",
        autorNome: "Tutor 1",
        createdAt: pastIso,
      },
    ]

    const grouped = groupTimelineEventsByDate(events)
    assert.ok(grouped["Hoje"], "Should have 'Hoje' bucket")
    assert.equal(grouped["Hoje"].length, 1)
    assert.equal(grouped["Hoje"][0].id, "e-today")

    assert.ok(grouped["Ontem"], "Should have 'Ontem' bucket")
    assert.equal(grouped["Ontem"].length, 1)
    assert.equal(grouped["Ontem"][0].id, "e-yesterday")

    const pastKeys = Object.keys(grouped).filter((k) => k !== "Hoje" && k !== "Ontem")
    assert.equal(pastKeys.length, 1)
    assert.equal(grouped[pastKeys[0]][0].id, "e-past")
  })

  // ==========================================================================
  // SECTION 4: Lead Tutor Resolution & Author Authority Badges
  // ==========================================================================
  console.log("\n--- Section 4: Lead Tutor Resolution & Authority Badges ---")

  await test("ADV-LB-01: getLeadTutorInfo handles camelCase and snake_case attributes with null fallbacks", () => {
    const emptyCard = getLeadTutorInfo(null)
    assert.equal(emptyCard.tutorId, null)
    assert.equal(emptyCard.tutorName, null)
    assert.equal(emptyCard.hasTutor, false)
    assert.equal(emptyCard.isMe, false)

    const snakeCard = { tutor_responsavel_id: "t-123", tutor_nome: "Prof. Carlos" }
    const resSnake = getLeadTutorInfo(snakeCard, { id: "t-123", name: "Prof. Carlos" })
    assert.equal(resSnake.tutorId, "t-123")
    assert.equal(resSnake.tutorName, "Prof. Carlos")
    assert.equal(resSnake.hasTutor, true)
    assert.equal(resSnake.isMe, true)

    const camelCard = { tutorResponsavelId: "t-456", tutorResponsavelNome: "Profa. Marina" }
    const resCamel = getLeadTutorInfo(camelCard, { id: "other-user", name: "profa. marina" })
    assert.equal(resCamel.tutorId, "t-456")
    assert.equal(resCamel.tutorName, "Profa. Marina")
    assert.equal(resCamel.hasTutor, true)
    // Matches by name case-insensitively
    assert.equal(resCamel.isMe, true)
  })

  await test("ADV-LB-02: getAuthorBadge evaluates all 4 multi-tutor author persona permutations", () => {
    const baseEvent: TimelineEvent = {
      id: "evt-1",
      matricula: "202401",
      tipoEvento: "intervencao_manual",
      autorId: "user-alice",
      autorNome: "Alice Titular",
      createdAt: "2026-11-01T10:00:00Z",
    }

    // Persona 1: Alice viewing her own action when she is the Lead Tutor
    const badgeLeadMe = getAuthorBadge(baseEvent, "user-alice", "user-alice")
    assert.equal(badgeLeadMe.label, "Você (Tutor Responsável)")
    assert.equal(badgeLeadMe.variant, "lead")

    // Persona 2: Alice viewing her own action when Bob is the Lead Tutor
    const badgeCollabMe = getAuthorBadge(baseEvent, "user-alice", "user-bob")
    assert.equal(badgeCollabMe.label, "Você (Colaborador)")
    assert.equal(badgeCollabMe.variant, "collab")

    // Persona 3: Charlie viewing Alice's action when Alice is the Lead Tutor
    const badgeLeadOther = getAuthorBadge(baseEvent, "user-charlie", "user-alice")
    assert.equal(badgeLeadOther.label, "Tutor Responsável (Alice Titular)")
    assert.equal(badgeLeadOther.variant, "lead")

    // Persona 4: Charlie viewing Alice's action when Bob is the Lead Tutor
    const badgeCollabOther = getAuthorBadge(baseEvent, "user-charlie", "user-bob")
    assert.equal(badgeCollabOther.label, "Colaborador (Alice Titular)")
    assert.equal(badgeCollabOther.variant, "collab")
  })

  await test("ADV-LB-03: getAuthorBadge safely falls back when autorNome is missing/empty", () => {
    const eventWithoutName: TimelineEvent = {
      id: "evt-noname",
      matricula: "202401",
      tipoEvento: "intervencao_manual",
      autorId: "user-anon",
      autorNome: "" as any,
      createdAt: "2026-11-01T10:00:00Z",
    }

    const badge = getAuthorBadge(eventWithoutName, "user-viewer", "user-anon")
    assert.equal(badge.label, "Tutor Responsável (Tutor)")
    assert.equal(badge.variant, "lead")
  })

  // ==========================================================================
  // SECTION 5: Recent Activity Pulse Badge 48-Hour Boundary Analysis
  // ==========================================================================
  console.log("\n--- Section 5: Recent Activity Pulse Badge 48h Boundary Analysis ---")

  const NOW_FIXED = 1731304800000 // Fixed deterministic reference time

  await test("ADV-REC-01: Returns false for null card, empty dates, and 0 intervention count", () => {
    assert.equal(checkRecentIntervention(null, NOW_FIXED).isRecent, false)
    assert.equal(checkRecentIntervention({}, NOW_FIXED).isRecent, false)
    assert.equal(
      checkRecentIntervention({ qtd_intervencoes: 0, ultima_intervencao_em: null }, NOW_FIXED).isRecent,
      false
    )
  })

  await test("ADV-REC-02: Returns false for epoch 1970 date and unparseable dates", () => {
    const epochCard = { ultima_intervencao_em: "1970-01-01T00:00:00Z", qtd_intervencoes: 1 }
    assert.equal(checkRecentIntervention(epochCard, NOW_FIXED).isRecent, false)

    const invalidDateCard = { ultima_intervencao_em: "invalid-iso-string", qtd_intervencoes: 1 }
    assert.equal(checkRecentIntervention(invalidDateCard, NOW_FIXED).isRecent, false)
  })

  await test("ADV-REC-03: Ignores future anomalies (>1h ahead) but tolerates slight clock skew (-2 min)", () => {
    // 2 hours in the future
    const futureCard = {
      ultima_intervencao_em: new Date(NOW_FIXED + 2 * 3600 * 1000).toISOString(),
      qtd_intervencoes: 1,
    }
    assert.equal(checkRecentIntervention(futureCard, NOW_FIXED).isRecent, false)

    // 2 minutes in the future (acceptable server/client clock skew)
    const skewCard = {
      ultima_intervencao_em: new Date(NOW_FIXED + 2 * 60 * 1000).toISOString(),
      qtd_intervencoes: 1,
    }
    const skewRes = checkRecentIntervention(skewCard, NOW_FIXED)
    assert.equal(skewRes.isRecent, true)
    assert.equal(skewRes.formattedRelative, "agora há pouco")
  })

  await test("ADV-REC-04: Formats relative time accurately for minutes and hours", () => {
    // 30 seconds ago
    const justNowCard = {
      ultima_intervencao_em: new Date(NOW_FIXED - 30 * 1000).toISOString(),
      qtd_intervencoes: 1,
    }
    assert.equal(checkRecentIntervention(justNowCard, NOW_FIXED).formattedRelative, "agora há pouco")

    // 25 minutes ago
    const minsCard = {
      ultima_intervencao_em: new Date(NOW_FIXED - 25 * 60 * 1000).toISOString(),
      qtd_intervencoes: 1,
    }
    assert.equal(checkRecentIntervention(minsCard, NOW_FIXED).formattedRelative, "há 25min")

    // 4 hours ago
    const hoursCard = {
      ultima_intervencao_em: new Date(NOW_FIXED - 4 * 3600 * 1000).toISOString(),
      qtd_intervencoes: 1,
    }
    assert.equal(checkRecentIntervention(hoursCard, NOW_FIXED).formattedRelative, "há 4h")
  })

  await test("ADV-REC-05: Strict Boundary Test at 48.0 Hours (47.9h vs 48.0h vs 48.01h vs 72h)", () => {
    const H48_MS = 48 * 3600 * 1000

    // 1. Just inside boundary: 47 hours and 59 minutes ago (47.98h)
    const insideCard = {
      ultima_intervencao_em: new Date(NOW_FIXED - (H48_MS - 60000)).toISOString(),
      qtd_intervencoes: 1,
    }
    const insideRes = checkRecentIntervention(insideCard, NOW_FIXED)
    assert.equal(insideRes.isRecent, true, "47.98h must be considered recent")
    assert.equal(insideRes.elapsedHours, 47)
    assert.equal(insideRes.formattedRelative, "há 47h")

    // 2. Exactly at boundary: 48.00 hours ago
    const boundaryCard = {
      ultima_intervencao_em: new Date(NOW_FIXED - H48_MS).toISOString(),
      qtd_intervencoes: 1,
    }
    const boundaryRes = checkRecentIntervention(boundaryCard, NOW_FIXED)
    assert.equal(boundaryRes.isRecent, true, "Exact 48.0h must be considered recent")
    assert.equal(boundaryRes.elapsedHours, 48)

    // 3. Just outside boundary: 48 hours and 1 minute ago (48.016h)
    const outsideCard = {
      ultima_intervencao_em: new Date(NOW_FIXED - (H48_MS + 60000)).toISOString(),
      qtd_intervencoes: 1,
    }
    const outsideRes = checkRecentIntervention(outsideCard, NOW_FIXED)
    assert.equal(outsideRes.isRecent, false, "48.016h must NOT be considered recent")
    assert.equal(outsideRes.elapsedHours, 48)
    assert.equal(outsideRes.formattedRelative, "")

    // 4. Well past boundary: 72 hours ago
    const oldCard = {
      ultima_intervencao_em: new Date(NOW_FIXED - 72 * 3600 * 1000).toISOString(),
      qtd_intervencoes: 1,
    }
    const oldRes = checkRecentIntervention(oldCard, NOW_FIXED)
    assert.equal(oldRes.isRecent, false)
    assert.equal(oldRes.elapsedHours, 72)
  })

  await test("ADV-REC-06: Date precedence handles fallback from ultima_intervencao to ultimo_contato to updatedAt", () => {
    // Falls back to ultimo_contato_em
    const contactCard = {
      ultimo_contato_em: new Date(NOW_FIXED - 2 * 3600 * 1000).toISOString(),
      qtd_intervencoes: 0,
    }
    const contactRes = checkRecentIntervention(contactCard, NOW_FIXED)
    assert.equal(contactRes.isRecent, true)
    assert.equal(contactRes.formattedRelative, "há 2h")

    // Falls back to updatedAt when count > 0
    const updatedCard = {
      updatedAt: new Date(NOW_FIXED - 3 * 3600 * 1000).toISOString(),
      qtd_intervencoes: 2,
    }
    const updatedRes = checkRecentIntervention(updatedCard, NOW_FIXED)
    assert.equal(updatedRes.isRecent, true)
    assert.equal(updatedRes.formattedRelative, "há 3h")
  })

  // ==========================================================================
  // SECTION 6: Kanban Client State Mutation & Multi-Tutor Invariant Simulation
  // ==========================================================================
  console.log("\n--- Section 6: Kanban State Mutation & Invariant Simulation ---")

  await test("ADV-KB-01: Drag-and-drop status update strictly preserves tutor_responsavel_id", () => {
    const initialCards = [
      {
        id: "card-alpha",
        matricula: "202401",
        status_kanban: "pendente",
        tutor_responsavel_id: "lead-tutor-carlos",
        tutor_nome: "Prof. Carlos Titular",
      },
      {
        id: "card-beta",
        matricula: "202402",
        status_kanban: "em_contato",
        tutor_responsavel_id: "lead-tutor-marina",
        tutor_nome: "Profa. Marina Titular",
      },
    ]

    // Simulate collaborator dragging card-alpha to 'em_recuperacao'
    const targetCardId = "card-alpha"
    const newStatus = "em_recuperacao"

    const updatedCards = initialCards.map((c) =>
      c.id === targetCardId ? { ...c, status_kanban: newStatus } : c
    )

    // Assert status updated
    assert.equal(updatedCards[0].status_kanban, "em_recuperacao")
    // Assert lead tutor strictly preserved
    assert.equal(updatedCards[0].tutor_responsavel_id, "lead-tutor-carlos")
    assert.equal(updatedCards[0].tutor_nome, "Prof. Carlos Titular")
    // Assert untouched card completely identical
    assert.deepEqual(updatedCards[1], initialCards[1])
  })

  await test("ADV-KB-02: Baton pass success updates both snake_case and camelCase tutor IDs and names", () => {
    const cardBefore = {
      id: "card-alpha",
      matricula: "202401",
      status_kanban: "em_contato",
      tutor_responsavel_id: "tutor-old",
      tutorResponsavelId: "tutor-old",
      tutor_nome: "Prof. Carlos Antigo",
      tutorResponsavelNome: "Prof. Carlos Antigo",
    }

    const batonPassResult = {
      novoTutorId: "tutor-new-roberto",
      novoTutorNome: "Prof. Roberto Sucessor",
      notaTransicao: "Transferência de bastão pedagógico realizada.",
    }

    // Mirror handleBatonPassSuccess logic from TutoriaKanbanClient.tsx
    const cardAfter = {
      ...cardBefore,
      tutor_responsavel_id: batonPassResult.novoTutorId,
      tutorResponsavelId: batonPassResult.novoTutorId,
      tutor_nome: batonPassResult.novoTutorNome,
      tutorResponsavelNome: batonPassResult.novoTutorNome,
    }

    assert.equal(cardAfter.tutor_responsavel_id, "tutor-new-roberto")
    assert.equal(cardAfter.tutorResponsavelId, "tutor-new-roberto")
    assert.equal(cardAfter.tutor_nome, "Prof. Roberto Sucessor")
    assert.equal(cardAfter.tutorResponsavelNome, "Prof. Roberto Sucessor")
    assert.equal(cardAfter.status_kanban, "em_contato", "Status kanban unchanged")
  })

  // ==========================================================================
  // Summary & Outcomes
  // ==========================================================================
  console.log("\n================================================================================")
  console.log(`Tier 5 Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`)
  console.log("================================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runTier5AdversarialSuite()
