/**
 * apps/frontend/src/lib/tutoria-adversarial.test.ts
 * Empirical Adversarial & Stress Testing Suite for Milestone 3 (Frontend Server Actions)
 *
 * Verifies edge cases, boundary conditions, malformed payloads, error propagation,
 * and contract shape guarantees on apps/frontend/src/app/actions/tutoria.ts.
 *
 * Execution:
 *   npx tsx apps/frontend/src/lib/tutoria-adversarial.test.ts
 */

import assert from "node:assert/strict"

// Configure mock environment variables prior to importing Server Actions
process.env.TEST_AUTH_TOKEN = "adversarial-test-jwt-token"
process.env.NEXT_API_URL = "http://127.0.0.1:3999"

// Intercepted request storage
let capturedRequest: {
  url: string
  method: string
  headers: Record<string, string>
  body: any
} | null = null

function getCaptured() {
  assert.ok(capturedRequest !== null, "Expected capturedRequest to not be null")
  return capturedRequest
}

let mockResponseHandler: (url: string, method: string, body: any) => Response | Promise<Response> = () => {
  return new Response(JSON.stringify({ success: true }), { status: 200 })
}

// Global fetch mock to intercept Server Action requests
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

// Import genuine Server Actions directly
import {
  getTutoriaTimeline,
  createTutoriaIntervention,
  createTutoriaIntervencao,
  getTutoriaTutores,
  getTutoresAtivos,
  transferirTutoriaBastao,
  type TimelineEvent,
  type ActiveTutor,
  type TutoriaTipoEvento,
  type TutoriaCanalContato,
} from "../app/actions/tutoria"

async function runAdversarialTestSuite() {
  console.log("================================================================================")
  console.log("EMPIRICAL ADVERSARIAL STRESS TEST SUITE — NEXUSHUB TUTORIA (M3)")
  console.log("Scope: Boundary Analysis, Shape Invariants & Error Resilience")
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
      console.error(`    ${err.stack || err.message}`)
      failed++
    }
  }

  // ============================================================================
  // Group 0: Alias Equivalence Invariants
  // ============================================================================
  console.log("--- Group 0: Alias Equivalence & Function Reference Checks ---")

  await test("ADV-01: createTutoriaIntervencao is exact alias of createTutoriaIntervention", async () => {
    assert.strictEqual(
      createTutoriaIntervencao,
      createTutoriaIntervention,
      "createTutoriaIntervencao must be an exact reference alias to createTutoriaIntervention"
    )
  })

  await test("ADV-02: getTutoresAtivos is exact alias of getTutoriaTutores", async () => {
    assert.strictEqual(
      getTutoresAtivos,
      getTutoriaTutores,
      "getTutoresAtivos must be an exact reference alias to getTutoriaTutores"
    )
  })

  // ============================================================================
  // Group 1: getTutoriaTimeline Stress & Edge Cases
  // ============================================================================
  console.log("\n--- Group 1: getTutoriaTimeline Input Validation & Return Shape ---")

  await test("ADV-03: getTutoriaTimeline rejects empty string without network call", async () => {
    capturedRequest = null
    const res = await getTutoriaTimeline("")
    assert.equal(res.success, false)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.events, [])
    assert.match(res.error || "", /Matrícula é obrigatória/)
    assert.strictEqual(capturedRequest, null, "Should not emit HTTP request")
  })

  await test("ADV-04: getTutoriaTimeline rejects whitespace-only string without network call", async () => {
    capturedRequest = null
    const res = await getTutoriaTimeline("   \t\n  ")
    assert.equal(res.success, false)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.events, [])
    assert.match(res.error || "", /Matrícula é obrigatória/)
    assert.strictEqual(capturedRequest, null, "Should not emit HTTP request")
  })

  await test("ADV-05: getTutoriaTimeline handles valid matricula without atendimentoId", async () => {
    capturedRequest = null
    mockResponseHandler = () => new Response(JSON.stringify([]), { status: 200 })

    const res = await getTutoriaTimeline("20240199")
    assert.equal(res.success, true)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.events, [])
    const req = getCaptured()
    assert.match(req.url, /\/api\/tutoria\/aluno\/20240199\/timeline$/)
    assert.equal(req.method, "GET")
  })

  await test("ADV-06: getTutoriaTimeline handles valid matricula WITH atendimentoId (trimmed & encoded)", async () => {
    capturedRequest = null
    mockResponseHandler = () => new Response(JSON.stringify([]), { status: 200 })

    const res = await getTutoriaTimeline(" 20240199 ", " card-uuid-999 ")
    assert.equal(res.success, true)
    const req = getCaptured()
    assert.match(
      req.url,
      /\/api\/tutoria\/aluno\/20240199\/timeline\?atendimentoId=card-uuid-999$/
    )
  })

  await test("ADV-07: getTutoriaTimeline encodes special characters in matricula and query params", async () => {
    capturedRequest = null
    mockResponseHandler = () => new Response(JSON.stringify([]), { status: 200 })

    const res = await getTutoriaTimeline("MAT/2024#01", "CARD/100&foo=bar")
    assert.equal(res.success, true)
    const req = getCaptured()
    assert.ok(req.url.includes("MAT%2F2024%2301"))
    assert.ok(req.url.includes("atendimentoId=CARD%2F100%26foo%3Dbar"))
  })

  await test("ADV-08: getTutoriaTimeline populates BOTH data and events with array response", async () => {
    const rawEvents: TimelineEvent[] = [
      {
        id: "evt-1",
        matricula: "20240199",
        tipoEvento: "abertura",
        autorNome: "Tutor 1",
        createdAt: "2026-11-01T10:00:00Z",
      },
      {
        id: "evt-2",
        matricula: "20240199",
        tipoEvento: "contato_enviado",
        canalContato: "whatsapp",
        autorNome: "Tutor 2",
        createdAt: "2026-11-02T10:00:00Z",
      },
    ]

    mockResponseHandler = () => new Response(JSON.stringify(rawEvents), { status: 200 })
    const res = await getTutoriaTimeline("20240199")

    assert.equal(res.success, true)
    assert.strictEqual(res.data, res.events, "res.data and res.events should point to identical array")
    assert.equal(res.data.length, 2)
    assert.equal(res.events[0].id, "evt-1")
    assert.equal(res.data[1].id, "evt-2")
  })

  await test("ADV-09: getTutoriaTimeline populates BOTH data and events when response is { events: [...] }", async () => {
    const rawEvents: TimelineEvent[] = [
      {
        id: "evt-10",
        matricula: "20240199",
        tipoEvento: "intervencao_manual",
        autorNome: "Tutor 3",
        createdAt: "2026-11-03T10:00:00Z",
      },
    ]

    mockResponseHandler = () => new Response(JSON.stringify({ events: rawEvents }), { status: 200 })
    const res = await getTutoriaTimeline("20240199")

    assert.equal(res.success, true)
    assert.strictEqual(res.data, res.events)
    assert.equal(res.data.length, 1)
    assert.equal(res.data[0].id, "evt-10")
  })

  await test("ADV-10: getTutoriaTimeline populates BOTH data and events when response is { data: [...] }", async () => {
    const rawEvents: TimelineEvent[] = [
      {
        id: "evt-20",
        matricula: "20240199",
        tipoEvento: "passagem_bastao",
        autorNome: "Tutor 4",
        createdAt: "2026-11-04T10:00:00Z",
      },
    ]

    mockResponseHandler = () => new Response(JSON.stringify({ data: rawEvents }), { status: 200 })
    const res = await getTutoriaTimeline("20240199")

    assert.equal(res.success, true)
    assert.strictEqual(res.data, res.events)
    assert.equal(res.data.length, 1)
    assert.equal(res.data[0].id, "evt-20")
  })

  await test("ADV-11: getTutoriaTimeline handles backend 400 Bad Request gracefully without throwing", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ message: "Parâmetro matricula inválido ou formato incorreto." }), {
        status: 400,
      })

    const res = await getTutoriaTimeline("INVALID_MAT")
    assert.equal(res.success, false)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.events, [])
    assert.match(res.error || "", /Parâmetro matricula inválido|HTTP 400/)
  })

  await test("ADV-12: getTutoriaTimeline handles backend 404 Not Found gracefully without throwing", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ message: "Aluno não encontrado." }), { status: 404 })

    const res = await getTutoriaTimeline("99999999")
    assert.equal(res.success, false)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.events, [])
    assert.match(res.error || "", /Aluno não encontrado|HTTP 404/)
  })

  await test("ADV-13: getTutoriaTimeline handles backend 500 Internal Server Error without throwing", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ error: "Postgres connection pool exhausted" }), { status: 500 })

    const res = await getTutoriaTimeline("20240199")
    assert.equal(res.success, false)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.events, [])
    assert.match(res.error || "", /connection pool|HTTP 500/)
  })

  await test("ADV-14: getTutoriaTimeline handles total network refusal / throw without crashing", async () => {
    mockResponseHandler = () => {
      throw new Error("getaddrinfo ENOTFOUND backend.nexus.internal")
    }

    const res = await getTutoriaTimeline("20240199")
    assert.equal(res.success, false)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.events, [])
    assert.match(res.error || "", /ENOTFOUND|Erro ao carregar histórico/)
  })

  // ============================================================================
  // Group 2: createTutoriaIntervention Stress & Edge Cases
  // ============================================================================
  console.log("\n--- Group 2: createTutoriaIntervention Stress & Edge Cases ---")

  await test("ADV-15: createTutoriaIntervention rejects empty matricula without network call", async () => {
    capturedRequest = null
    const res = await createTutoriaIntervention({
      matricula: "",
      tipoEvento: "intervencao_manual",
      observacoes: "Observação com mais de 5 caracteres.",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /Matrícula é obrigatória/)
    assert.strictEqual(capturedRequest, null, "Should not emit HTTP request")
  })

  await test("ADV-16: createTutoriaIntervention rejects whitespace-only matricula without network call", async () => {
    capturedRequest = null
    const res = await createTutoriaIntervention({
      matricula: "   \n\t   ",
      tipoEvento: "intervencao_manual",
      observacoes: "Observação válida para o teste.",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /Matrícula é obrigatória/)
    assert.strictEqual(capturedRequest, null)
  })

  await test("ADV-17: createTutoriaIntervention rejects empty observacoes without network call", async () => {
    capturedRequest = null
    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /Observações são obrigatórias/)
    assert.strictEqual(capturedRequest, null)
  })

  await test("ADV-18: createTutoriaIntervention rejects whitespace-only observacoes without network call", async () => {
    capturedRequest = null
    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "       ",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /Observações são obrigatórias/)
    assert.strictEqual(capturedRequest, null)
  })

  await test("ADV-19: createTutoriaIntervention with observacoes under 5 characters when backend rejects (HTTP 400)", async () => {
    // If a short note (e.g. 3 chars) is sent and backend enforces validation returning 400 Bad Request
    mockResponseHandler = () =>
      new Response(
        JSON.stringify({
          statusCode: 400,
          message: ["observacoes must be longer than or equal to 5 characters"],
          error: "Bad Request",
        }),
        { status: 400 }
      )

    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "123",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /observacoes|Bad Request|HTTP 400/)
  })

  await test("ADV-20: createTutoriaIntervention with observacoes under 5 characters when backend accepts (HTTP 201)", async () => {
    mockResponseHandler = (_url, _method, body) =>
      new Response(JSON.stringify({ id: "evt-short-ok", ...body, createdAt: new Date().toISOString() }), {
        status: 201,
      })

    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "Nota",
    })

    assert.equal(res.success, true)
    assert.equal(res.id, "evt-short-ok")
    assert.equal(res.data?.id, "evt-short-ok")
  })

  const eventTypes: TutoriaTipoEvento[] = [
    "abertura",
    "mudanca_status",
    "contato_enviado",
    "intervencao_manual",
    "passagem_bastao",
    "finalizacao",
    "reabertura",
  ]

  for (const tipo of eventTypes) {
    await test(`ADV-21: createTutoriaIntervention correctly serializes event type: '${tipo}'`, async () => {
      capturedRequest = null
      mockResponseHandler = (_url, _method, body) =>
        new Response(JSON.stringify({ id: `evt-${tipo}`, ...body, createdAt: new Date().toISOString() }), {
          status: 201,
        })

      const res = await createTutoriaIntervention({
        matricula: "20240199",
        tipoEvento: tipo,
        observacoes: `Teste de intervenção para evento ${tipo}`,
      })

      assert.equal(res.success, true)
      const req = getCaptured()
      assert.equal(req.method, "POST")
      assert.equal(req.body.tipoEvento, tipo)
      assert.equal(req.body.matricula, "20240199")
    })
  }

  const contactChannels: TutoriaCanalContato[] = ["whatsapp", "email", "telefone", "ava", "outro"]

  for (const canal of contactChannels) {
    await test(`ADV-22: createTutoriaIntervention handles canalContato: '${canal}'`, async () => {
      capturedRequest = null
      mockResponseHandler = (_url, _method, body) =>
        new Response(JSON.stringify({ id: `evt-canal-${canal}`, ...body }), { status: 201 })

      const res = await createTutoriaIntervention({
        matricula: "20240199",
        tipoEvento: "contato_enviado",
        canalContato: canal,
        observacoes: `Contato realizado com sucesso pelo canal ${canal}.`,
      })

      assert.equal(res.success, true)
      const req = getCaptured()
      assert.equal(req.body.canalContato, canal)
    })
  }

  await test("ADV-23: createTutoriaIntervention without canalContato omits canalContato or sets undefined", async () => {
    capturedRequest = null
    mockResponseHandler = (_url, _method, body) =>
      new Response(JSON.stringify({ id: "evt-no-channel", ...body }), { status: 201 })

    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "Anotação pedagógica sem canal de comunicação.",
    })

    assert.equal(res.success, true)
    const req = getCaptured()
    assert.strictEqual(req.body.canalContato, undefined)
  })

  await test("ADV-24: createTutoriaIntervention trims optional fields (atendimentoId, periodo)", async () => {
    capturedRequest = null
    mockResponseHandler = (_url, _method, body) =>
      new Response(JSON.stringify({ id: "evt-trimmed", ...body }), { status: 201 })

    const res = await createTutoriaIntervention({
      matricula: " 20240199 ",
      atendimentoId: " card-uuid-123 ",
      periodo: " 2026-2 ",
      tipoEvento: "intervencao_manual",
      observacoes: " Observação com espaços laterais para testar trim. ",
      metadata: { source: "test-adversarial", tags: ["priority"] },
    })

    assert.equal(res.success, true)
    const req = getCaptured()
    assert.equal(req.body.matricula, "20240199")
    assert.equal(req.body.atendimentoId, "card-uuid-123")
    assert.equal(req.body.periodo, "2026-2")
    assert.equal(req.body.observacoes, "Observação com espaços laterais para testar trim.")
    assert.deepEqual(req.body.metadata, { source: "test-adversarial", tags: ["priority"] })
  })

  await test("ADV-25: createTutoriaIntervention return shape contains both data and id properties", async () => {
    const mockCreated: TimelineEvent = {
      id: "evt-uuid-returned-999",
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      autorNome: "Prof. Lead",
      observacoes: "Retorno completo do evento",
      createdAt: "2026-11-10T12:00:00Z",
    }

    mockResponseHandler = () => new Response(JSON.stringify(mockCreated), { status: 201 })

    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "Anotação para checagem de shape de retorno",
    })

    assert.equal(res.success, true)
    assert.equal(res.id, "evt-uuid-returned-999")
    assert.deepEqual(res.data, mockCreated)
  })

  await test("ADV-26: createTutoriaIntervention handles backend 400 Bad Request gracefully", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ message: "Payload inválido: statusKanban inexistente." }), { status: 400 })

    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "Tentando atualizar para etapa inválida",
      statusKanban: "status_que_nao_existe",
    })

    assert.equal(res.success, false)
    assert.strictEqual(res.data, undefined)
    assert.match(res.error || "", /Payload inválido|HTTP 400/)
  })

  await test("ADV-27: createTutoriaIntervention handles network throw gracefully", async () => {
    mockResponseHandler = () => {
      throw new Error("ECONNRESET: connection reset by peer")
    }

    const res = await createTutoriaIntervention({
      matricula: "20240199",
      tipoEvento: "intervencao_manual",
      observacoes: "Teste de queda de rede abrupta",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /ECONNRESET|Erro ao registrar intervenção/)
  })

  // ============================================================================
  // Group 3: getTutoriaTutores Stress & Return Shape
  // ============================================================================
  console.log("\n--- Group 3: getTutoriaTutores Shape & Error Handling ---")

  await test("ADV-28: getTutoriaTutores populates BOTH data and tutores from raw array response", async () => {
    const rawTutors: ActiveTutor[] = [
      { id: "tut-1", name: "Prof. Ana Silva", email: "ana@unievangelica.edu.br" },
      { id: "tut-2", name: "Prof. Bruno Souza", email: "bruno@unievangelica.edu.br" },
    ]

    mockResponseHandler = () => new Response(JSON.stringify(rawTutors), { status: 200 })
    const res = await getTutoriaTutores()

    assert.equal(res.success, true)
    assert.strictEqual(res.data, res.tutores, "res.data and res.tutores should point to identical array")
    assert.equal(res.data.length, 2)
    assert.equal(res.tutores[0].id, "tut-1")
    assert.equal(res.data[1].name, "Prof. Bruno Souza")
  })

  await test("ADV-29: getTutoriaTutores populates BOTH data and tutores when response is { tutores: [...] }", async () => {
    const rawTutors: ActiveTutor[] = [
      { id: "tut-3", name: "Prof. Clara Mendes", email: "clara@unievangelica.edu.br" },
    ]

    mockResponseHandler = () => new Response(JSON.stringify({ tutores: rawTutors }), { status: 200 })
    const res = await getTutoriaTutores()

    assert.equal(res.success, true)
    assert.strictEqual(res.data, res.tutores)
    assert.equal(res.data.length, 1)
    assert.equal(res.data[0].id, "tut-3")
  })

  await test("ADV-30: getTutoriaTutores populates BOTH data and tutores when response is { data: [...] }", async () => {
    const rawTutors: ActiveTutor[] = [
      { id: "tut-4", name: "Prof. Daniel Lima", email: "daniel@unievangelica.edu.br" },
    ]

    mockResponseHandler = () => new Response(JSON.stringify({ data: rawTutors }), { status: 200 })
    const res = await getTutoriaTutores()

    assert.equal(res.success, true)
    assert.strictEqual(res.data, res.tutores)
    assert.equal(res.data.length, 1)
    assert.equal(res.data[0].id, "tut-4")
  })

  await test("ADV-31: getTutoriaTutores handles empty array response cleanly", async () => {
    mockResponseHandler = () => new Response(JSON.stringify([]), { status: 200 })
    const res = await getTutoriaTutores()

    assert.equal(res.success, true)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.tutores, [])
  })

  await test("ADV-32: getTutoriaTutores handles backend 500 error gracefully without crashing", async () => {
    mockResponseHandler = () =>
      new Response(JSON.stringify({ error: "Service Unavailable: auth service unreachable" }), { status: 500 })

    const res = await getTutoriaTutores()
    assert.equal(res.success, false)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.tutores, [])
    assert.match(res.error || "", /Service Unavailable|HTTP 500/)
  })

  await test("ADV-33: getTutoriaTutores handles network drop throw without crashing", async () => {
    mockResponseHandler = () => {
      throw new Error("ETIMEDOUT: Connection timed out after 5000ms")
    }

    const res = await getTutoriaTutores()
    assert.equal(res.success, false)
    assert.deepEqual(res.data, [])
    assert.deepEqual(res.tutores, [])
    assert.match(res.error || "", /ETIMEDOUT|Erro ao buscar tutores/)
  })

  // ============================================================================
  // Group 4: transferirTutoriaBastao Stress & Boundary Tests
  // ============================================================================
  console.log("\n--- Group 4: transferirTutoriaBastao Boundary Tests ---")

  await test("ADV-34: transferirTutoriaBastao rejects empty card id", async () => {
    capturedRequest = null
    const res = await transferirTutoriaBastao("", {
      novoTutorId: "tutor-2",
      notaTransicao: "Nota de transição válida",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /ID do atendimento é obrigatório/)
    assert.strictEqual(capturedRequest, null)
  })

  await test("ADV-35: transferirTutoriaBastao rejects empty novoTutorId", async () => {
    capturedRequest = null
    const res = await transferirTutoriaBastao("card-100", {
      novoTutorId: "   ",
      notaTransicao: "Nota de transição válida",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /Selecione o novo tutor/)
    assert.strictEqual(capturedRequest, null)
  })

  await test("ADV-36: transferirTutoriaBastao rejects notaTransicao shorter than 5 chars", async () => {
    capturedRequest = null
    const res = await transferirTutoriaBastao("card-100", {
      novoTutorId: "tutor-2",
      notaTransicao: "1234",
    })

    assert.equal(res.success, false)
    assert.match(res.error || "", /mínimo 5 caracteres/)
    assert.strictEqual(capturedRequest, null)
  })

  await test("ADV-37: transferirTutoriaBastao serializes and trims input on valid request", async () => {
    capturedRequest = null
    mockResponseHandler = () =>
      new Response(JSON.stringify({ success: true, message: "Transferido com sucesso" }), { status: 200 })

    const res = await transferirTutoriaBastao(" card-uuid-100 ", {
      novoTutorId: " tutor-uuid-200 ",
      notaTransicao: "  Transferência com justificativa detalhada para o colega.  ",
    })

    assert.equal(res.success, true)
    const req = getCaptured()
    assert.match(req.url, /\/api\/tutoria\/kanban\/card-uuid-100\/transferir$/)
    assert.equal(req.body.novoTutorId, "tutor-uuid-200")
    assert.equal(req.body.notaTransicao, "Transferência com justificativa detalhada para o colega.")
  })

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("\n================================================================================")
  console.log(`Empirical Adversarial Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`)
  console.log("================================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

runAdversarialTestSuite().catch((err) => {
  console.error("Fatal adversarial runner error:", err)
  process.exit(1)
})
