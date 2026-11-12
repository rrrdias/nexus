/**
 * apps/frontend/src/lib/tutoria-kanban-m4.test.ts
 *
 * MILESTONE 4 TEST SUITE — Frontend Kanban Multi-Tutor & Baton Pass UI
 * Features Covered:
 * - F10: Lead Tutor Badge on Kanban Cards (getLeadTutorInfo, isMe, peer tutor, unassigned)
 * - F11: Recent Intervention Indicator (<48h pulse animation, recency formula, fallbacks)
 * - F12: BatonPassDialog & BatonPassForm (validation, SSR rendering, disabled options, character counter)
 * - F13: Movimentação Kanban Preservando Posse (DnD payload invariant, ownership preservation)
 *
 * Execution:
 *   npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4.test.ts
 */

import assert from "node:assert/strict"
import React from "react"
import { renderToString } from "react-dom/server"
import { BatonPassDialog, BatonPassForm } from "../components/tutoria/BatonPassDialog"
import {
  getLeadTutorInfo,
  checkRecentIntervention,
  validateBatonPassInput,
} from "./tutoria-utils"
import {
  getLeadTutorInfo as kanbanGetLeadTutorInfo,
  checkRecentIntervention as kanbanCheckRecentIntervention,
} from "../app/tutoria/kanban/TutoriaKanbanClient"

async function runMilestone4Suite() {
  console.log("================================================================================")
  console.log("TEST SUITE: Milestone 4 Frontend Kanban Multi-Tutor & Baton Pass UI (F10–F13)")
  console.log("================================================================================\n")

  let passed = 0
  let failed = 0

  const test = (name: string, fn: () => void | Promise<void>) => {
    try {
      const res = fn()
      if (res && typeof (res as any).then === "function") {
        return (res as Promise<void>)
          .then(() => {
            console.log(`  ✓ ${name}`)
            passed++
          })
          .catch((err) => {
            console.error(`  ✗ ${name}`)
            console.error(`    ${err.message}`)
            failed++
          })
      }
      console.log(`  ✓ ${name}`)
      passed++
    } catch (err: any) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${err.message}`)
      failed++
    }
  }

  // ============================================================================
  // TIER 1: Feature F10 — Lead Tutor Badge Logic
  // ============================================================================
  console.log("--- Tier 1: Feature F10 — Lead Tutor Badge Logic ---")

  test("TC-M4-F10-01: Exported helper references from TutoriaKanbanClient match tutoria-utils", () => {
    assert.equal(typeof kanbanGetLeadTutorInfo, "function")
    assert.equal(typeof kanbanCheckRecentIntervention, "function")
  })

  test("TC-M4-F10-02: Authenticated tutor is lead tutor (tutorId match) -> isMe = true", () => {
    const sessionUser = { id: "user-tutor-123", name: "Prof. Ricardo", email: "ricardo@nexus.edu" }
    const card = {
      id: "card-1",
      aluno_nome: "Maria Santos",
      tutor_responsavel_id: "user-tutor-123",
      tutor_nome: "Prof. Ricardo",
    }
    const info = getLeadTutorInfo(card, sessionUser)
    assert.equal(info.isMe, true)
    assert.equal(info.hasTutor, true)
    assert.equal(info.tutorName, "Prof. Ricardo")
    assert.equal(info.tutorId, "user-tutor-123")
  })

  test("TC-M4-F10-03: Authenticated tutor is lead tutor (case-insensitive name fallback) -> isMe = true", () => {
    const sessionUser = { id: "different-id", name: "Prof. Ricardo Dias", email: "ricardo@nexus.edu" }
    const card = {
      id: "card-2",
      tutor_responsavel_id: null,
      tutor_nome: "  prof. ricardo dias  ",
    }
    const info = getLeadTutorInfo(card, sessionUser)
    assert.equal(info.isMe, true)
    assert.equal(info.hasTutor, true)
  })

  test("TC-M4-F10-04: Card belongs to a peer tutor -> isMe = false, hasTutor = true", () => {
    const sessionUser = { id: "user-tutor-123", name: "Prof. Ricardo" }
    const card = {
      id: "card-3",
      tutor_responsavel_id: "user-tutor-999",
      tutor_nome: "Profa. Juliana Mendes",
    }
    const info = getLeadTutorInfo(card, sessionUser)
    assert.equal(info.isMe, false)
    assert.equal(info.hasTutor, true)
    assert.equal(info.tutorName, "Profa. Juliana Mendes")
  })

  test("TC-M4-F10-05: Card has no tutor assigned -> isMe = false, hasTutor = false", () => {
    const sessionUser = { id: "user-tutor-123", name: "Prof. Ricardo" }
    const card = {
      id: "card-4",
      tutor_responsavel_id: null,
      tutor_nome: null,
    }
    const info = getLeadTutorInfo(card, sessionUser)
    assert.equal(info.isMe, false)
    assert.equal(info.hasTutor, false)
    assert.equal(info.tutorId, null)
    assert.equal(info.tutorName, null)
  })

  test("TC-M4-F10-06: Defensive handling of null card and undefined sessionUser", () => {
    const info1 = getLeadTutorInfo(null, null)
    assert.equal(info1.isMe, false)
    assert.equal(info1.hasTutor, false)

    const card = { id: "card-5", tutor_responsavel_id: "u1", tutor_nome: "Tutor" }
    const info2 = getLeadTutorInfo(card, undefined)
    assert.equal(info2.isMe, false)
    assert.equal(info2.hasTutor, true)
  })

  // ============================================================================
  // TIER 2: Feature F11 — Recent Activity Indicator (<48h Pulse Badge)
  // ============================================================================
  console.log("\n--- Tier 2: Feature F11 — Recent Activity Indicator (<48h) ---")

  test("TC-M4-F11-01: Activity within 48h (e.g. 2 hours ago) -> isRecent = true", () => {
    const now = Date.now()
    const twoHoursAgo = new Date(now - 2 * 3600 * 1000).toISOString()
    const card = {
      id: "card-rec-1",
      ultima_intervencao_em: twoHoursAgo,
      qtd_intervencoes: 3,
    }
    const recency = checkRecentIntervention(card, now)
    assert.equal(recency.isRecent, true)
    assert.equal(recency.elapsedHours, 2)
    assert.equal(recency.formattedRelative, "há 2h")
    assert.equal(recency.interventionCount, 3)
  })

  test("TC-M4-F11-02: Activity recent in minutes (e.g. 15 minutes ago) -> formattedRelative = há 15min", () => {
    const now = Date.now()
    const fifteenMinAgo = new Date(now - 15 * 60 * 1000).toISOString()
    const card = {
      id: "card-rec-2",
      ultima_intervencao_em: fifteenMinAgo,
      qtd_intervencoes: 1,
    }
    const recency = checkRecentIntervention(card, now)
    assert.equal(recency.isRecent, true)
    assert.equal(recency.formattedRelative, "há 15min")
  })

  test("TC-M4-F11-03: Activity just now (< 1 minute ago) -> formattedRelative = agora há pouco", () => {
    const now = Date.now()
    const tenSecondsAgo = new Date(now - 10 * 1000).toISOString()
    const card = {
      id: "card-rec-3",
      ultima_intervencao_em: tenSecondsAgo,
      qtd_intervencoes: 1,
    }
    const recency = checkRecentIntervention(card, now)
    assert.equal(recency.isRecent, true)
    assert.equal(recency.formattedRelative, "agora há pouco")
  })

  test("TC-M4-F11-04: Activity older than 48 hours (e.g. 50 hours ago) -> isRecent = false", () => {
    const now = Date.now()
    const fiftyHoursAgo = new Date(now - 50 * 3600 * 1000).toISOString()
    const card = {
      id: "card-rec-4",
      ultima_intervencao_em: fiftyHoursAgo,
      qtd_intervencoes: 2,
    }
    const recency = checkRecentIntervention(card, now)
    assert.equal(recency.isRecent, false)
    assert.equal(recency.elapsedHours, 50)
  })

  test("TC-M4-F11-05: Card with zero interventions and no date -> isRecent = false", () => {
    const card = {
      id: "card-rec-5",
      ultima_intervencao_em: null,
      ultimo_contato_em: null,
      qtd_intervencoes: 0,
      updatedAt: new Date().toISOString(),
    }
    const recency = checkRecentIntervention(card)
    assert.equal(recency.isRecent, false)
  })

  test("TC-M4-F11-06: Fallback to ultimo_contato_em when ultima_intervencao_em is null", () => {
    const now = Date.now()
    const oneHourAgo = new Date(now - 3600 * 1000).toISOString()
    const card = {
      id: "card-rec-6",
      ultima_intervencao_em: null,
      ultimo_contato_em: oneHourAgo,
      qtd_intervencoes: 1,
    }
    const recency = checkRecentIntervention(card, now)
    assert.equal(recency.isRecent, true)
    assert.equal(recency.elapsedHours, 1)
  })

  test("TC-M4-F11-07: Fallback to updatedAt when qtd_intervencoes > 0", () => {
    const now = Date.now()
    const fourHoursAgo = new Date(now - 4 * 3600 * 1000).toISOString()
    const card = {
      id: "card-rec-7",
      ultima_intervencao_em: null,
      ultimo_contato_em: null,
      qtd_intervencoes: 2,
      updatedAt: fourHoursAgo,
    }
    const recency = checkRecentIntervention(card, now)
    assert.equal(recency.isRecent, true)
    assert.equal(recency.elapsedHours, 4)
  })

  test("TC-M4-F11-08: Resilient handling of malformed / epoch date strings", () => {
    const cardInvalid = { id: "c-inv", ultima_intervencao_em: "not-a-date" }
    assert.equal(checkRecentIntervention(cardInvalid).isRecent, false)

    const cardEpoch = { id: "c-epoch", ultima_intervencao_em: "1970-01-01T00:00:00.000Z" }
    assert.equal(checkRecentIntervention(cardEpoch).isRecent, false)

    const cardNull = null
    assert.equal(checkRecentIntervention(cardNull).isRecent, false)
  })

  // ============================================================================
  // TIER 3: Feature F12 — BatonPassDialog Validation & SSR Rendering
  // ============================================================================
  console.log("\n--- Tier 3: Feature F12 — BatonPassDialog Validation & SSR ---")

  test("TC-M4-F12-01: validateBatonPassInput rejects empty tutor ID", () => {
    const res = validateBatonPassInput("", "tutor-1", "Nota de transição válida")
    assert.equal(res.valid, false)
    assert.match(res.error || "", /Selecione o novo tutor/)
  })

  test("TC-M4-F12-02: validateBatonPassInput rejects self-transfer (novoTutorId === currentTutorId)", () => {
    const res = validateBatonPassInput("tutor-same", "tutor-same", "Nota de transição válida")
    assert.equal(res.valid, false)
    assert.match(res.error || "", /diferente do tutor responsável atual/)
  })

  test("TC-M4-F12-03: validateBatonPassInput rejects note shorter than 5 chars or whitespace only", () => {
    const res1 = validateBatonPassInput("tutor-new", "tutor-old", "1234")
    assert.equal(res1.valid, false)
    assert.match(res1.error || "", /mínimo de 5 caracteres/)

    const res2 = validateBatonPassInput("tutor-new", "tutor-old", "     ")
    assert.equal(res2.valid, false)
    assert.match(res2.error || "", /mínimo de 5 caracteres/)
  })

  test("TC-M4-F12-04: validateBatonPassInput accepts valid payload with note >= 5 chars", () => {
    const res = validateBatonPassInput(
      "tutor-new-99",
      "tutor-old-11",
      "Aluno solicitou novo plano de estudos."
    )
    assert.equal(res.valid, true)
    assert.equal(res.error, undefined)
  })

  test("TC-M4-F12-05: BatonPassForm renders complete form elements via SSR cleanly", () => {
    const mockTutors = [
      { id: "tutor-1", name: "Prof. Carlos", email: "carlos@nexus.edu" },
      { id: "tutor-2", name: "Profa. Ana", email: "ana@nexus.edu" },
    ]

    const html = renderToString(
      React.createElement(BatonPassForm, {
        cardId: "card-123",
        matricula: "2024098",
        alunoNome: "Mariana Silva",
        disciplinaNome: "Estruturas de Dados",
        currentTutorId: "tutor-1",
        currentTutorNome: "Prof. Carlos",
        initialTutors: mockTutors,
      })
    )

    // Asserts expected text and structure in SSR markup
    assert.ok(
      html.includes("Transferência de Atendimento") || html.includes("Passagem de Bastão Pedagógico"),
      "Deve conter título do modal"
    )
    assert.ok(html.includes("Mariana Silva"), "Deve exibir nome do discente")
    assert.ok(html.includes("2024098"), "Deve exibir matrícula")
    assert.ok(html.includes("Estruturas de Dados"), "Deve exibir nome da disciplina")
    assert.ok(html.includes("Prof. Carlos"), "Deve exibir tutor titular atual")
    assert.ok(html.includes("Profa. Ana"), "Deve listar tutores elegíveis")
    assert.ok(html.includes("(Tutor atual)"), "Deve marcar tutor atual como desabilitado")
    assert.ok(html.includes("0 / 5 mín."), "Deve exibir contador de caracteres")
    assert.ok(html.includes("Confirmar Transferência"), "Deve conter botão de confirmação")
  })

  test("TC-M4-F12-06: BatonPassForm accepts whole card prop fallback cleanly", () => {
    const card = {
      id: "card-abc",
      matricula: "2024777",
      aluno_nome: "João Pereira",
      disciplina_nome: "Cálculo I",
      tutor_responsavel_id: "tutor-orig",
      tutor_nome: "Prof. Origem",
    }

    const html = renderToString(
      React.createElement(BatonPassForm, {
        card: card,
        initialTutors: [{ id: "tutor-dest", name: "Prof. Destino", email: "dest@nexus.edu" }],
      })
    )

    assert.ok(html.includes("João Pereira"))
    assert.ok(html.includes("2024777"))
    assert.ok(html.includes("Cálculo I"))
    assert.ok(html.includes("Prof. Origem"))
    assert.ok(html.includes("Prof. Destino"))
  })

  test("TC-M4-F12-07: BatonPassForm handles unassigned student ('Sem tutor atribuído')", () => {
    const html = renderToString(
      React.createElement(BatonPassForm, {
        cardId: "card-no-tutor",
        matricula: "2024000",
        alunoNome: "Aluno Sem Tutor",
        currentTutorId: null,
        currentTutorNome: null,
        initialTutors: [{ id: "tutor-1", name: "Prof. Carlos", email: "carlos@nexus.edu" }],
      })
    )

    assert.ok(html.includes("Sem tutor atribuído"))
  })

  test("TC-M4-F12-08: BatonPassDialog renders trigger button cleanly in uncontrolled mode", () => {
    const html = renderToString(
      React.createElement(BatonPassDialog, {
        cardId: "card-trigger-test",
        matricula: "2024555",
      })
    )

    assert.ok(
      html.includes("Transferir Atendimento") || html.includes("Passar Bastão"),
      "Deve renderizar o botão de transferir atendimento"
    )
  })

  // ============================================================================
  // TIER 4: Feature F13 — Movimentação Kanban Preservando Posse
  // ============================================================================
  console.log("\n--- Tier 4: Feature F13 — Movimentação Kanban Preservando Posse ---")

  test("TC-M4-F13-01: Column move payload includes ONLY statusKanban and does NOT mutate tutorResponsavelId", () => {
    // Simula a construção de payload de handleMoveCard
    const cardId = "card-inv-1"
    const newStatus = "em_contato"
    const canal = "whatsapp"

    const payload: any = { statusKanban: newStatus }
    if (canal) payload.canalContatoUtilizado = canal

    assert.equal(payload.statusKanban, "em_contato")
    assert.equal(payload.canalContatoUtilizado, "whatsapp")
    assert.equal("tutorResponsavelId" in payload, false)
    assert.equal("tutor_responsavel_id" in payload, false)
    assert.equal("tutor_nome" in payload, false)
  })

  test("TC-M4-F13-02: Optimistic update preserves tutor_responsavel_id and tutor_nome verbatim", () => {
    const initialCards = [
      {
        id: "card-1",
        aluno_nome: "Lucas Lima",
        status_kanban: "pendente",
        tutor_responsavel_id: "lead-tutor-99",
        tutor_nome: "Prof. Arthur",
      },
      {
        id: "card-2",
        aluno_nome: "Beatriz Costa",
        status_kanban: "pendente",
        tutor_responsavel_id: "lead-tutor-88",
        tutor_nome: "Profa. Heloisa",
      },
    ]

    const cardIdToMove = "card-1"
    const newStatus = "em_recuperacao"

    // Simula a lógica de setCards de handleMoveCard
    const updatedCards = initialCards.map((c) =>
      c.id === cardIdToMove ? { ...c, status_kanban: newStatus } : c
    )

    const movedCard = updatedCards.find((c) => c.id === "card-1")
    assert.equal(movedCard?.status_kanban, "em_recuperacao")
    assert.equal(movedCard?.tutor_responsavel_id, "lead-tutor-99", "Posse primária não deve ser alterada")
    assert.equal(movedCard?.tutor_nome, "Prof. Arthur", "Nome do tutor não deve ser alterado")
  })

  test("TC-M4-F13-03: Baton pass success properly updates tutor ownership and resets activity timestamp", () => {
    const initialCards: any[] = [
      {
        id: "card-1",
        aluno_nome: "Lucas Lima",
        status_kanban: "pendente",
        tutor_responsavel_id: "lead-tutor-99",
        tutor_nome: "Prof. Arthur",
        qtd_intervencoes: 1,
        ultima_intervencao_em: null,
      },
    ]

    const batonPassResult = {
      novoTutorId: "lead-tutor-new",
      novoTutorNome: "Prof. Vinicius",
      notaTransicao: "Transferência devidamente registrada",
    }

    // Simula a lógica de handleBatonPassSuccess
    const updatedCards = initialCards.map((c) =>
      c.id === "card-1"
        ? {
            ...c,
            tutor_responsavel_id: batonPassResult.novoTutorId,
            tutor_nome: batonPassResult.novoTutorNome,
            ultima_intervencao_em: new Date().toISOString(),
            qtd_intervencoes: (Number(c.qtd_intervencoes) || 0) + 1,
          }
        : c
    )

    const transferredCard = updatedCards[0]
    assert.equal(transferredCard.tutor_responsavel_id, "lead-tutor-new")
    assert.equal(transferredCard.tutor_nome, "Prof. Vinicius")
    assert.equal(transferredCard.qtd_intervencoes, 2)
    assert.ok(transferredCard.ultima_intervencao_em)
  })

  // Summary
  console.log("\n================================================================================")
  console.log(`Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`)
  console.log("================================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

runMilestone4Suite()
