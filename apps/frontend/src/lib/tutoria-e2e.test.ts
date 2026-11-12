/**
 * apps/frontend/src/lib/tutoria-e2e.test.ts
 * Standalone Frontend E2E / Integration Test Suite for Multi-Tutor Hybrid Attendance
 *
 * Execution:
 *   npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts
 */

import assert from "node:assert/strict"

// 1. Configure test environment variables prior to importing Server Actions
process.env.TEST_AUTH_TOKEN = "mock-jwt-frontend-test-token"
process.env.NEXT_API_URL = "http://127.0.0.1:3999"

// Intercepted request storage
let capturedRequest: {
  url: string
  method: string
  headers: Record<string, string>
  body: any
} | null = null

let mockResponseHandler: (url: string, method: string, body: any) => Response = () => {
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

// 2. Global fetch mock to intercept Server Action requests
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

// 3. Import genuine Server Actions directly from apps/frontend/src/app/actions/tutoria (ZERO IN-TEST FALLBACKS)
import {
  getTutoriaTimeline,
  createTutoriaIntervencao,
  transferirTutoriaBastao,
  getTutoresAtivos,
  getTutoriaKanbanCards,
  createTutoriaKanbanCard,
  updateTutoriaKanbanCard,
} from "../app/actions/tutoria"

// 4. Import genuine presentation & validation utilities from apps/frontend/src/lib/tutoria-utils
import {
  formatTimelineEventDate,
  groupTimelineEventsByDate,
  getAuthorBadge,
  validateBatonPassInput,
  type TimelineEvent,
  type ActiveTutor,
} from "./tutoria-utils"

// ----------------------------------------------------------------------------
// Test Execution Engine
// ----------------------------------------------------------------------------
async function runFrontendE2ESuite() {
  console.log("================================================================================")
  console.log("NexusHub Tutoria: Frontend Standalone E2E / Server Actions Test Suite")
  console.log("Track: E2E Testing Track | Milestones E2-E5 (Feature F8)")
  console.log("================================================================================\n")

  let passed = 0
  let failed = 0

  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (err: any) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${err.message}`)
      failed++
    }
  }

  // ==========================================================================
  // Tier 1: Feature Coverage (Category-Partition Happy Paths: TC-T1-F8-01 .. 07)
  // ==========================================================================
  console.log("--- Tier 1: Feature F8 Coverage (Server Actions Happy Paths) ---")

  await test("TC-T1-F8-01: getTutoriaTimeline parses response and returns typed { success: true, events }", async () => {
    const mockEvents: TimelineEvent[] = [
      {
        id: "evt-01",
        atendimentoId: "card-100",
        matricula: "20240199",
        tipoEvento: "abertura",
        autorId: "tutor-1",
        autorNome: "Prof. Carlos Titular",
        createdAt: "2026-11-01T10:00:00Z",
      },
      {
        id: "evt-02",
        atendimentoId: "card-100",
        matricula: "20240199",
        tipoEvento: "contato_enviado",
        canalContato: "whatsapp",
        autorId: "tutor-2",
        autorNome: "Profa. Marina Colaboradora",
        observacoes: "Contato inicial de acolhimento realizado.",
        createdAt: "2026-11-02T14:30:00Z",
      },
    ]

    mockResponseHandler = () => new Response(JSON.stringify(mockEvents), { status: 200 })
    const res = await getTutoriaTimeline("20240199")

    assert.equal(res.success, true)
    assert.equal(res.events.length, 2)
    assert.equal(res.events[0].autorNome, "Prof. Carlos Titular")
    assert.equal(res.events[1].canalContato, "whatsapp")
    assert.equal(capturedRequest?.method, "GET")
    assert.match(capturedRequest?.url || "", /\/api\/tutoria\/aluno\/20240199\/timeline$/)
    assert.equal(capturedRequest?.headers["Authorization"], "Bearer mock-jwt-frontend-test-token")
  })

  await test("TC-T1-F8-02: createTutoriaIntervencao constructs valid JSON payload and handles 201 Created", async () => {
    mockResponseHandler = (_url, _method, body) => new Response(JSON.stringify({ id: "evt-new-123", ...body }), { status: 201 })

    const payload = {
      matricula: "20240199",
      atendimentoId: "card-100",
      tipoEvento: "contato_enviado" as const,
      canalContato: "whatsapp" as const,
      observacoes: "Tentativa de contato via WhatsApp sobre entrega de atividades.",
      metadata: { template: "aviso_prazo_ap1" },
    }

    const res = await createTutoriaIntervencao(payload)
    assert.equal(res.success, true)
    assert.equal(capturedRequest?.method, "POST")
    assert.match(capturedRequest?.url || "", /\/api\/tutoria\/intervencoes$/)
    assert.equal(capturedRequest?.body.matricula, "20240199")
    assert.equal(capturedRequest?.body.canalContato, "whatsapp")
    assert.deepEqual(capturedRequest?.body.metadata, { template: "aviso_prazo_ap1" })
  })

  await test("TC-T1-F8-03: transferirTutoriaBastao constructs correct endpoint and serializes transition notes", async () => {
    mockResponseHandler = () => new Response(JSON.stringify({ success: true, message: "Bastão transferido com sucesso." }), { status: 200 })

    const res = await transferirTutoriaBastao("card-uuid-456", {
      novoTutorId: "tutor-uuid-successor",
      notaTransicao: "Passagem de bastão pedagógico: aluno precisa de reforço em Algoritmos.",
    })

    assert.equal(res.success, true)
    assert.equal(capturedRequest?.method, "POST")
    assert.match(capturedRequest?.url || "", /\/api\/tutoria\/kanban\/card-uuid-456\/transferir$/)
    assert.equal(capturedRequest?.body.novoTutorId, "tutor-uuid-successor")
    assert.match(capturedRequest?.body.notaTransicao, /Passagem de bastão/)
  })

  await test("TC-T1-F8-04: getTutoresAtivos returns active tutor roster for dropdown consumption", async () => {
    const mockTutors: ActiveTutor[] = [
      { id: "t1", name: "Prof. Carlos Titular", email: "carlos@unievangelica.edu.br" },
      { id: "t2", name: "Profa. Marina Colaboradora", email: "marina@unievangelica.edu.br" },
      { id: "t3", name: "Prof. Roberto Sucessor", email: "roberto@unievangelica.edu.br" },
    ]

    mockResponseHandler = () => new Response(JSON.stringify(mockTutors), { status: 200 })
    const res = await getTutoresAtivos()

    assert.equal(res.success, true)
    assert.equal(res.tutores.length, 3)
    assert.equal(res.tutores[0].name, "Prof. Carlos Titular")
    assert.equal(capturedRequest?.method, "GET")
    assert.match(capturedRequest?.url || "", /\/api\/tutoria\/tutores$/)
  })

  await test("TC-T1-F8-05: updateTutoriaKanbanCard calls backend PATCH endpoint with auth header and body", async () => {
    mockResponseHandler = () => new Response(JSON.stringify({ id: "card-77", success: true }), { status: 200 })

    const res = await updateTutoriaKanbanCard("card-77", {
      statusKanban: "em_recuperacao",
      observacoes: "Aluno concordou com o plano de recuperação.",
    })

    assert.equal(res.success, true)
    assert.equal(capturedRequest?.method, "PATCH")
    assert.match(capturedRequest?.url || "", /\/api\/tutoria\/kanban\/card-77$/)
    assert.equal(capturedRequest?.body.statusKanban, "em_recuperacao")
    assert.equal(capturedRequest?.headers["Authorization"], "Bearer mock-jwt-frontend-test-token")
  })

  await test("TC-T1-F8-06: getTutoriaKanbanCards fetches and formats query params", async () => {
    mockResponseHandler = () => new Response(JSON.stringify({ cards: [], summary: { total: 0 } }), { status: 200 })
    const res = await getTutoriaKanbanCards({ statusKanban: "em_contato", periodo: "2026-2" })
    assert.equal(res.success, true)
    assert.equal(capturedRequest?.method, "GET")
    assert.match(capturedRequest?.url || "", /statusKanban=em_contato/)
    assert.match(capturedRequest?.url || "", /periodo=2026-2/)
  })

  await test("TC-T1-F8-07: createTutoriaKanbanCard calls POST /api/tutoria/kanban", async () => {
    mockResponseHandler = () => new Response(JSON.stringify({ id: "card-new-fe", created: true }), { status: 201 })
    const res = await createTutoriaKanbanCard({ matricula: "20240999", periodo: "2026-2" })
    assert.equal(res.success, true)
    assert.equal(capturedRequest?.method, "POST")
    assert.match(capturedRequest?.url || "", /\/api\/tutoria\/kanban$/)
  })

  // ==========================================================================
  // Tier 2: Boundary & Corner Cases (TC-T2-F8-01 .. 05)
  // ==========================================================================
  console.log("\n--- Tier 2: Feature F8 Boundary Value Analysis & Error Resilience ---")

  await test("TC-T2-F8-01: createTutoriaIntervencao rejects empty observation note before dispatching HTTP call", async () => {
    capturedRequest = null
    const res = await createTutoriaIntervencao({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "   ",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /obrigatórias/)
    assert.equal(capturedRequest, null) // Invariant: zero network call emitted
  })

  await test("TC-T2-F8-02: transferirTutoriaBastao rejects note shorter than 5 chars before dispatching HTTP call", async () => {
    capturedRequest = null
    const res = await transferirTutoriaBastao("card-1", {
      novoTutorId: "tutor-2",
      notaTransicao: "Ok",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /mínimo 5 caracteres/)
    assert.equal(capturedRequest, null)
  })

  await test("TC-T2-F8-03: getTutoriaTimeline recovers gracefully from backend 500 without crashing", async () => {
    mockResponseHandler = () => new Response(JSON.stringify({ error: "Internal Database Connection Timeout" }), { status: 500 })

    const res = await getTutoriaTimeline("20240199")
    assert.equal(res.success, false)
    assert.deepEqual(res.events, [])
    assert.match(res.error || "", /Internal Database|HTTP 500/)
  })

  await test("TC-T2-F8-04: updateTutoriaKanbanCard recovers gracefully from 404 Not Found", async () => {
    mockResponseHandler = () => new Response(JSON.stringify({ message: "Cartão de atendimento card-999 não encontrado." }), { status: 404 })

    const res = await updateTutoriaKanbanCard("card-999", {
      statusKanban: "revertido",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /não encontrado|HTTP 404/)
  })

  await test("TC-T2-F8-05: getTutoresAtivos returns empty roster gracefully on network disconnect", async () => {
    mockResponseHandler = () => {
      throw new Error("fetch failed: ECONNREFUSED 127.0.0.1:3999")
    }

    const res = await getTutoresAtivos()
    assert.equal(res.success, false)
    assert.deepEqual(res.tutores, [])
    assert.match(res.error || "", /fetch failed|ECONNREFUSED/)
  })

  // ==========================================================================
  // Additional Presentation & Utility Verifications (Data formatting & UI rules)
  // ==========================================================================
  console.log("\n--- Presentation & Utility Logic Verifications ---")

  await test("TC-FE-UTIL-01: formatTimelineEventDate parses ISO strings to DD/MM/YYYY HH:mm", async () => {
    const formatted = formatTimelineEventDate("2026-11-10T15:45:00Z")
    assert.match(formatted, /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)
    assert.equal(formatTimelineEventDate("invalid-date"), "Data inválida")
  })

  await test("TC-FE-UTIL-02: groupTimelineEventsByDate correctly creates 'Hoje' and 'Ontem' calendar buckets", async () => {
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    const events: TimelineEvent[] = [
      { id: "e1", matricula: "202401", tipoEvento: "abertura", autorId: "u1", autorNome: "Prof. A", createdAt: now.toISOString() },
      { id: "e2", matricula: "202401", tipoEvento: "contato_enviado", autorId: "u2", autorNome: "Prof. B", createdAt: yesterday.toISOString() },
      { id: "e3", matricula: "202401", tipoEvento: "intervencao_manual", autorId: "u1", autorNome: "Prof. A", createdAt: "2026-01-15T09:00:00Z" },
    ]

    const grouped = groupTimelineEventsByDate(events)
    assert.ok(grouped["Hoje"], "Bucket 'Hoje' deve existir")
    assert.equal(grouped["Hoje"].length, 1)
    assert.ok(grouped["Ontem"], "Bucket 'Ontem' deve existir")
    assert.equal(grouped["Ontem"].length, 1)
  })

  await test("TC-FE-UTIL-03: getAuthorBadge formats correct labels for Lead Tutor vs Collaborator", async () => {
    const currentUserId = "tutor-lead-1"
    const leadTutorId = "tutor-lead-1"

    const eventByLead: TimelineEvent = {
      id: "e1",
      matricula: "202401",
      tipoEvento: "abertura",
      autorId: "tutor-lead-1",
      autorNome: "Prof. Carlos",
      createdAt: new Date().toISOString(),
    }

    const eventByCollab: TimelineEvent = {
      id: "e2",
      matricula: "202401",
      tipoEvento: "contato_enviado",
      autorId: "tutor-collab-2",
      autorNome: "Profa. Marina",
      createdAt: new Date().toISOString(),
    }

    const badgeLead = getAuthorBadge(eventByLead, currentUserId, leadTutorId)
    assert.equal(badgeLead.label, "Você (Tutor Responsável)")
    assert.equal(badgeLead.variant, "lead")

    const badgeCollab = getAuthorBadge(eventByCollab, currentUserId, leadTutorId)
    assert.equal(badgeCollab.label, "Colaborador (Profa. Marina)")
    assert.equal(badgeCollab.variant, "collab")
  })

  await test("TC-FE-UTIL-04: validateBatonPassInput enforces self-transfer guard and note validation", async () => {
    // 1. Missing new tutor
    const r1 = validateBatonPassInput("", "tutor-1", "Nota pedagógica válida")
    assert.equal(r1.valid, false)
    assert.match(r1.error || "", /Selecione o novo tutor/)

    // 2. Self-transfer attempt
    const r2 = validateBatonPassInput("tutor-1", "tutor-1", "Nota pedagógica válida")
    assert.equal(r2.valid, false)
    assert.match(r2.error || "", /diferente do tutor responsável atual/)

    // 3. Short note
    const r3 = validateBatonPassInput("tutor-2", "tutor-1", "Curt")
    assert.equal(r3.valid, false)
    assert.match(r3.error || "", /mínimo de 5 caracteres/)

    // 4. Valid baton pass
    const r4 = validateBatonPassInput("tutor-2", "tutor-1", "Nota completa com orientações pedagógicas para continuidade.")
    assert.equal(r4.valid, true)
  })

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log("\n================================================================================")
  console.log(`Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`)
  console.log("================================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

// Execute standalone
runFrontendE2ESuite().catch((err) => {
  console.error("Fatal suite runner error:", err)
  process.exit(1)
})
