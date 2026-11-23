/**
 * apps/frontend/src/lib/tutoria-teologia.test.ts
 * Suite de testes para Server Actions e regras do submódulo Tutoria > Teologia.
 */

import assert from "node:assert/strict"

process.env.TEST_AUTH_TOKEN = "mock-jwt-frontend-test-token"
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

import {
  getTutoriaTeologiaSummary,
  getTutoriaTeologiaEngagementList,
  getTutoriaTeologiaDisciplinas,
  getTutoriaTeologiaExportData,
  getTutoriaTeologiaStudentLogs,
  addAlunosToTutoriaGrupo,
  removeAlunoFromTutoriaGrupo,
} from "../app/actions/tutoria"

async function runTests() {
  console.log("=== Running Tutoria > Teologia Frontend Actions Tests ===")

  // 1. Summary Teologia
  mockResponseHandler = () =>
    new Response(
      JSON.stringify({ total_alunos_unicos: 12, total_critico: 4 }),
      { status: 200 },
    )
  const summary = await getTutoriaTeologiaSummary("2026-2", "ead")
  assert.equal(capturedRequest?.method, "GET")
  assert.ok(capturedRequest?.url.includes("/api/tutoria/teologia/summary?periodo=2026-2&institution=ead"))
  assert.equal(summary.total_alunos_unicos, 12)

  // 2. Engagement List Teologia (sem statusKanban)
  mockResponseHandler = () =>
    new Response(
      JSON.stringify({
        data: [
          {
            matricula: "D2610339",
            nota_fase1: "85.00",
            nota_fase2: "70.00",
            nota_fase3: "0.00",
          },
        ],
        pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
      }),
      { status: 200 },
    )
  const listRes = await getTutoriaTeologiaEngagementList({
    periodo: "2026-2",
    institution: "ead",
    grupoRisco: "critico",
    page: 1,
    limit: 15,
  })
  assert.ok(capturedRequest?.url.includes("/api/tutoria/teologia/engajamento?"))
  assert.ok(!capturedRequest?.url.includes("statusKanban"))
  assert.equal(listRes.data[0].nota_fase1, "85.00")

  // 3. Disciplinas Teologia
  mockResponseHandler = () => new Response(JSON.stringify([]), { status: 200 })
  const discRes = await getTutoriaTeologiaDisciplinas("2026-2", "ead")
  assert.equal(discRes.success, true)
  assert.ok(capturedRequest?.url.includes("/api/tutoria/teologia/disciplinas"))

  // 4. Export Data Teologia
  mockResponseHandler = () => new Response(JSON.stringify([]), { status: 200 })
  await getTutoriaTeologiaExportData({ periodo: "2026-2", institution: "ead" })
  assert.ok(capturedRequest?.url.includes("/api/tutoria/teologia/exportar"))

  // 5. Detalhes + Notas (Fase 1, 2 e 3) de Teologia
  mockResponseHandler = () =>
    new Response(
      JSON.stringify({
        logs: [{ id: "1", conteudo_nome: "Atividade 1" }],
        discente: { curso_nome: "Teologia" },
        grades: { fase1: "90.00", fase2: "60.00", fase3: null },
      }),
      { status: 200 },
    )
  const logsRes = await getTutoriaTeologiaStudentLogs("D2610339", "4407", "ead")
  assert.ok(
    capturedRequest?.url.includes(
      "/api/tutoria/teologia/aluno/D2610339/logs?institution=ead&disciplinaId=4407",
    ),
  )
  assert.equal(logsRes.grades?.fase1, "90.00")
  assert.equal(logsRes.grades?.fase2, "60.00")
  assert.equal(logsRes.grades?.fase3, null)

  // 6. Add & Remove grupo alunos com encoding correto de matrícula
  mockResponseHandler = () =>
    new Response(
      JSON.stringify({ success: true, addedCount: 2, skippedCount: 0 }),
      { status: 200 },
    )
  const addRes = await addAlunosToTutoriaGrupo("teologia", ["D2610339", "D2620379"])
  assert.equal(capturedRequest?.method, "POST")
  assert.ok(capturedRequest?.url.endsWith("/api/tutoria/grupos/teologia/alunos"))
  assert.equal(addRes.addedCount, 2)

  mockResponseHandler = () =>
    new Response(
      JSON.stringify({ success: true, removed: true, matricula: "D/2610339" }),
      { status: 200 },
    )
  const remRes = await removeAlunoFromTutoriaGrupo("teologia", "D/2610339")
  assert.equal(capturedRequest?.method, "DELETE")
  assert.ok(
    capturedRequest?.url.includes("/api/tutoria/grupos/teologia/alunos/D%2F2610339?institution=ead"),
  )
  assert.equal(remRes.removed, true)

  console.log("✅ All 7 Tutoria > Teologia frontend tests passed!")
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err)
  process.exit(1)
})
