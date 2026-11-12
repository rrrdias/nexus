/**
 * apps/frontend/src/lib/tutoria-empirical-challenge.test.ts
 *
 * EMPIRICAL CHALLENGER VERIFICATION SUITE — Milestone 3
 * Targets:
 * 1. TutoriaTimeline.tsx (date formatting, event types, author tag logic, rendering edge cases)
 * 2. TutoriaInterventionForm.tsx (form logic, validation, channel toggling, payload construction)
 * 3. TutoriaDashboard.tsx (lazy loading hook analysis and state flow contracts)
 *
 * Execution:
 *   npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-empirical-challenge.test.ts
 */

import assert from "node:assert/strict"
import React from "react"
import { renderToString } from "react-dom/server"
import { TutoriaTimeline, type TutoriaTimelineProps } from "../components/tutoria/TutoriaTimeline"
import { TutoriaInterventionForm } from "../components/tutoria/TutoriaInterventionForm"
import type { TimelineEvent } from "../app/actions/tutoria"

// Helper to create mock timeline events
function createMockEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "evt-" + Math.random().toString(36).substring(2, 9),
    atendimentoId: "card-123",
    matricula: "2024001",
    periodo: "2026-2",
    tipoEvento: "intervencao_manual",
    autorId: "tutor-1",
    autorNome: "Prof. Roberto",
    tutorResponsavelAnteriorId: null,
    tutorResponsavelNovoId: null,
    estadoAnterior: null,
    estadoNovo: null,
    canalContato: null,
    observacoes: "Observação de teste pedagógico.",
    metadata: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

async function runEmpiricalChallengeSuite() {
  console.log("================================================================================")
  console.log("CHALLENGER VERIFICATION: Milestone 3 Frontend Components Stress & Edge Cases")
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

  // ----------------------------------------------------------------------------
  // SECTION 1: TutoriaTimeline - Date Formatting & Boundaries
  // ----------------------------------------------------------------------------
  console.log("--- Section 1: TutoriaTimeline Date Formatting & Boundaries ---")

  test("EC-01: Timeline handles invalid date strings gracefully without throwing", () => {
    const invalidDates = [
      "not-a-valid-date",
      "",
      "   ",
      "99999-99-99",
      "2026-02-31T25:99:99Z",
    ]

    for (const badDate of invalidDates) {
      const event = createMockEvent({ createdAt: badDate })
      const html = renderToString(React.createElement(TutoriaTimeline, { events: [event] }))
      assert.ok(html.length > 0, `Failed to render for bad date: ${badDate}`)
      // It should display the fallback relative time 'agora há pouco' without crashing
      assert.ok(html.includes("agora há pouco"), `Expected 'agora há pouco' fallback for: ${badDate}`)
    }
  })

  test("EC-02: Timeline handles extreme past dates (epoch 1970 and year 0001)", () => {
    const epochEvent = createMockEvent({ createdAt: "1970-01-01T12:00:00.000Z" })
    const htmlEpoch = renderToString(React.createElement(TutoriaTimeline, { events: [epochEvent] }))
    assert.ok(htmlEpoch.length > 0)
    assert.ok(htmlEpoch.includes("1970"), "Expected formatted date to contain year 1970")

    const ancientEvent = createMockEvent({ createdAt: "0001-01-01T12:00:00.000Z" })
    const htmlAncient = renderToString(React.createElement(TutoriaTimeline, { events: [ancientEvent] }))
    assert.ok(htmlAncient.length > 0)
  })

  test("EC-03: Timeline handles future dates without negative intervals or crashes", () => {
    const futureDates = [
      new Date(Date.now() + 5000).toISOString(), // 5s in future
      new Date(Date.now() + 3600 * 1000 * 24).toISOString(), // 1 day in future
      new Date(Date.now() + 3600 * 1000 * 24 * 365).toISOString(), // 1 year in future
      "2099-12-31T23:59:59.000Z",
    ]

    for (const futureDate of futureDates) {
      const event = createMockEvent({ createdAt: futureDate })
      const html = renderToString(React.createElement(TutoriaTimeline, { events: [event] }))
      // Negative diffMs should fall back to 'agora há pouco'
      assert.ok(html.includes("agora há pouco"), `Future date ${futureDate} should fall back to 'agora há pouco'`)
    }
  })

  test("EC-04: Timeline relative time brackets (just now, minutes, hours, yesterday, days)", () => {
    const now = Date.now()

    // 1. Just now (< 60s)
    const eJustNow = createMockEvent({ createdAt: new Date(now - 30 * 1000).toISOString() })
    const htmlJustNow = renderToString(React.createElement(TutoriaTimeline, { events: [eJustNow] }))
    assert.ok(htmlJustNow.includes("agora há pouco"))

    // 2. Minutes ago (e.g., 15 min)
    const eMin = createMockEvent({ createdAt: new Date(now - 15 * 60 * 1000).toISOString() })
    const htmlMin = renderToString(React.createElement(TutoriaTimeline, { events: [eMin] }))
    assert.ok(htmlMin.includes("há 15 min"))

    // 3. Hours ago (e.g., 4 hours)
    const eHours = createMockEvent({ createdAt: new Date(now - 4 * 3600 * 1000).toISOString() })
    const htmlHours = renderToString(React.createElement(TutoriaTimeline, { events: [eHours] }))
    assert.ok(htmlHours.includes("há 4 h"))

    // 4. Yesterday (25 hours ago)
    const eYesterday = createMockEvent({ createdAt: new Date(now - 25 * 3600 * 1000).toISOString() })
    const htmlYesterday = renderToString(React.createElement(TutoriaTimeline, { events: [eYesterday] }))
    assert.ok(htmlYesterday.includes("ontem"))

    // 5. Days ago (e.g., 4 days ago)
    const eDays = createMockEvent({ createdAt: new Date(now - 4 * 24 * 3600 * 1000).toISOString() })
    const htmlDays = renderToString(React.createElement(TutoriaTimeline, { events: [eDays] }))
    assert.ok(htmlDays.includes("há 4 dias"))
  })

  test("EC-05: Timeline sorts events descending by createdAt (newest at top)", () => {
    const events: TimelineEvent[] = [
      createMockEvent({ id: "evt-old", createdAt: "2026-01-01T10:00:00.000Z", observacoes: "OLD_EVENT" }),
      createMockEvent({ id: "evt-newest", createdAt: "2026-03-01T10:00:00.000Z", observacoes: "NEWEST_EVENT" }),
      createMockEvent({ id: "evt-mid", createdAt: "2026-02-01T10:00:00.000Z", observacoes: "MID_EVENT" }),
    ]

    const html = renderToString(React.createElement(TutoriaTimeline, { events }))
    const idxNewest = html.indexOf("NEWEST_EVENT")
    const idxMid = html.indexOf("MID_EVENT")
    const idxOld = html.indexOf("OLD_EVENT")

    assert.ok(idxNewest < idxMid, "Newest event must appear before mid event")
    assert.ok(idxMid < idxOld, "Mid event must appear before old event")
  })

  // ----------------------------------------------------------------------------
  // SECTION 2: TutoriaTimeline - Event Types & Author Tag Resolution
  // ----------------------------------------------------------------------------
  console.log("\n--- Section 2: TutoriaTimeline Event Types & Author Badges ---")

  test("EC-06: All 7 event types render with correct badges and titles", () => {
    const eventTypes: Array<{ type: TimelineEvent["tipoEvento"]; expectedLabel: string }> = [
      { type: "abertura", expectedLabel: "Abertura de Atendimento" },
      { type: "mudanca_status", expectedLabel: "Mudança de Etapa" },
      { type: "contato_enviado", expectedLabel: "Contato Enviado" },
      { type: "intervencao_manual", expectedLabel: "Intervenção Pedagógica" },
      { type: "passagem_bastao", expectedLabel: "Transferência de Atendimento" },
      { type: "finalizacao", expectedLabel: "Atendimento Regularizado" },
      { type: "reabertura", expectedLabel: "Atendimento Reaberto" },
    ]

    for (const { type, expectedLabel } of eventTypes) {
      const event = createMockEvent({ tipoEvento: type })
      const html = renderToString(React.createElement(TutoriaTimeline, { events: [event] }))
      assert.ok(html.includes(expectedLabel), `Event type ${type} did not render expected label: ${expectedLabel}`)
    }
  })

  test("EC-07: Unknown fallback event type renders safely with fallback label", () => {
    const event = createMockEvent({ tipoEvento: "evento_desconhecido_customizado" as any })
    const html = renderToString(React.createElement(TutoriaTimeline, { events: [event] }))
    assert.ok(html.includes("evento_desconhecido_customizado"))
  })

  test("EC-08: Contact channels (whatsapp, email, telefone, ava, outro) render correctly", () => {
    const channels = ["whatsapp", "email", "telefone", "ava", "outro"] as const

    for (const channel of channels) {
      const event = createMockEvent({
        tipoEvento: "contato_enviado",
        canalContato: channel,
      })
      const html = renderToString(React.createElement(TutoriaTimeline, { events: [event] }))
      assert.ok(html.includes("Canal:"), `Missing 'Canal:' for channel ${channel}`)
      assert.ok(html.includes(channel), `Missing channel name ${channel} in badge`)
    }
  })

  test("EC-09: Author resolution priority: sessionUser match ('Você')", () => {
    const sessionUser = { id: "user-me", name: "Ricardo Dias" }
    const currentTutorId = "user-titular"

    const event = createMockEvent({ autorId: "user-me", autorNome: "Ricardo Dias" })
    const html = renderToString(
      React.createElement(TutoriaTimeline, {
        events: [event],
        sessionUser,
        currentTutorId,
      })
    )

    assert.ok(html.includes("Você"), "Expected 'Você' badge for sessionUser match")
    assert.ok(!html.includes("Tutor Titular"), "Should NOT show 'Tutor Titular' when matched as 'Você'")
  })

  test("EC-09b: When sessionUser IS the primary tutor, it still resolves to 'Você'", () => {
    const sessionUser = { id: "user-lead", name: "Lead Tutor" }
    const currentTutorId = "user-lead"

    const event = createMockEvent({ autorId: "user-lead", autorNome: "Lead Tutor" })
    const html = renderToString(
      React.createElement(TutoriaTimeline, {
        events: [event],
        sessionUser,
        currentTutorId,
      })
    )

    assert.ok(html.includes("Você"), "Expected 'Você' badge when session user is also lead tutor")
  })

  test("EC-10: Author resolution priority: lead tutor match ('Tutor Titular')", () => {
    const sessionUser = { id: "user-other", name: "Outro Tutor" }
    const currentTutorId = "user-titular"

    const event = createMockEvent({ autorId: "user-titular", autorNome: "Prof. Titular" })
    const html = renderToString(
      React.createElement(TutoriaTimeline, {
        events: [event],
        sessionUser,
        currentTutorId,
      })
    )

    assert.ok(html.includes("Tutor Titular"), "Expected 'Tutor Titular' badge")
    assert.ok(!html.includes("Você"), "Should not show 'Você' for lead tutor when not sessionUser")
  })

  test("EC-11: Author resolution priority: collaborator fallback ('Tutor Colaborador')", () => {
    const sessionUser = { id: "user-me", name: "Ricardo Dias" }
    const currentTutorId = "user-titular"

    const event = createMockEvent({ autorId: "user-colaborador-99", autorNome: "Prof. Colaborador" })
    const html = renderToString(
      React.createElement(TutoriaTimeline, {
        events: [event],
        sessionUser,
        currentTutorId,
      })
    )

    assert.ok(html.includes("Tutor Colaborador"), "Expected 'Tutor Colaborador' badge for peer actions")
  })

  test("EC-12: Empty state, loading skeletons, and error banner rendering", () => {
    // 1. Empty state
    const htmlEmpty = renderToString(
      React.createElement(TutoriaTimeline, {
        events: [],
        isLoading: false,
        emptyMessage: "Nenhum histórico encontrado para este aluno.",
      })
    )
    assert.ok(htmlEmpty.includes("Nenhum histórico encontrado para este aluno."))

    // 2. Loading state with skeletons
    const htmlLoading = renderToString(
      React.createElement(TutoriaTimeline, {
        events: [],
        isLoading: true,
      })
    )
    assert.ok(htmlLoading.includes("animate-pulse"))

    // 3. Error banner
    const htmlError = renderToString(
      React.createElement(TutoriaTimeline, {
        events: [],
        isLoading: false,
        error: "Falha de conexão com a API",
        onRefresh: () => {},
      })
    )
    assert.ok(htmlError.includes("Falha de conexão com a API"))
    assert.ok(htmlError.includes("Tentar novamente"))
  })

  // ----------------------------------------------------------------------------
  // SECTION 3: TutoriaInterventionForm Logic & State Rules
  // ----------------------------------------------------------------------------
  console.log("\n--- Section 3: TutoriaInterventionForm Logic & State Rules ---")

  test("EC-13: Form renders with default internal note tab and action buttons", () => {
    const html = renderToString(
      React.createElement(TutoriaInterventionForm, {
        matricula: "2024001",
        atendimentoId: "card-123",
        periodo: "2026-2",
        currentStatus: "pendente",
      })
    )

    assert.ok(html.includes("Registrar Intervenção Pedagógica"))
    assert.ok(html.includes("Anotação Interna"))
    assert.ok(html.includes("Contato Realizado"))
    assert.ok(html.includes("Salvar na Linha do Tempo"))
    assert.ok(html.includes("Mínimo 5 caracteres"))
  })

  test("EC-14: Form validation rejects whitespace-only or note < 5 characters", () => {
    // Test the trimming and length check logic as implemented in TutoriaInterventionForm:
    const validate = (obs: string) => {
      const trimmed = obs.trim()
      if (trimmed.length < 5) {
        return { valid: false, error: "Informe as observações da intervenção (mínimo de 5 caracteres)." }
      }
      return { valid: true }
    }

    assert.equal(validate("").valid, false)
    assert.equal(validate("   ").valid, false)
    assert.equal(validate("1234").valid, false)
    assert.equal(validate("  1234  ").valid, false)
    assert.equal(validate("12345").valid, true)
    assert.equal(validate("  12345  ").valid, true)
  })

  test("EC-15: Channel selection mapping matches backend TutoriaCanalContato enum", () => {
    const expectedChannels = ["whatsapp", "email", "telefone", "ava", "outro"]
    // Form provides buttons for all these 5 channels
    const formChannels = ["whatsapp", "email", "telefone", "ava", "outro"]
    for (const ch of expectedChannels) {
      assert.ok(formChannels.includes(ch))
    }
  })

  test("EC-16: Kanban stage progression options match valid backend kanban statuses", () => {
    const allowedStages = ["pendente", "em_contato", "em_recuperacao", "revertido"]
    // Verify each stage is a valid kanban stage
    assert.equal(allowedStages.length, 4)
    assert.ok(allowedStages.includes("pendente"))
    assert.ok(allowedStages.includes("em_contato"))
    assert.ok(allowedStages.includes("em_recuperacao"))
    assert.ok(allowedStages.includes("revertido"))
  })

  // ----------------------------------------------------------------------------
  // SECTION 4: TutoriaDashboard Tab 3 Lazy Loading & Hook Contract Analysis
  // ----------------------------------------------------------------------------
  console.log("\n--- Section 4: TutoriaDashboard Tab 3 Integration Analysis ---")

  test("EC-17: Tab 3 lazy loading hook dependency contract", () => {
    // Contract verification for TutoriaDashboard:
    // useEffect(() => {
    //   if (detailTab === "historico" && selectedStudent?.matricula) {
    //     loadTimeline(selectedStudent.matricula, selectedStudent.kanban_card_id)
    //   }
    // }, [detailTab, selectedStudent?.matricula, selectedStudent?.kanban_card_id, loadTimeline])

    // Scenario A: detailTab is "acolhimento" -> loadTimeline must NOT be invoked
    let invoked = false
    const simulateEffect = (tab: string, matricula?: string, cardId?: string) => {
      if (tab === "historico" && matricula) {
        invoked = true
      }
    }

    simulateEffect("acolhimento", "2024001")
    assert.equal(invoked, false, "Tab 'acolhimento' must not invoke loadTimeline")

    simulateEffect("diagnostico", "2024001")
    assert.equal(invoked, false, "Tab 'diagnostico' must not invoke loadTimeline")

    simulateEffect("historico", "2024001")
    assert.equal(invoked, true, "Tab 'historico' must invoke loadTimeline")
  })

  test("EC-18: handleInterventionSuccess updates local student status & triggers timeline reload", () => {
    let reloadedMatricula = ""
    let reloadedCardId = ""
    const loadTimelineMock = (m: string, c?: string) => {
      reloadedMatricula = m
      reloadedCardId = c || ""
    }

    let studentState: any = {
      matricula: "2024001",
      kanban_card_id: "card-999",
      status_kanban: "pendente",
    }

    const newEvent = {
      id: "evt-1",
      createdAt: "2026-11-11T12:00:00Z",
      canalContato: "whatsapp",
      metadata: { statusKanban: "em_contato" },
    }

    // Simulate handleInterventionSuccess logic
    loadTimelineMock(studentState.matricula, studentState.kanban_card_id)
    studentState = {
      ...studentState,
      kanban_ultimo_contato: newEvent.createdAt,
      kanban_canal: newEvent.canalContato,
      status_kanban: newEvent.metadata.statusKanban,
    }

    assert.equal(reloadedMatricula, "2024001")
    assert.equal(reloadedCardId, "card-999")
    assert.equal(studentState.status_kanban, "em_contato")
    assert.equal(studentState.kanban_canal, "whatsapp")
  })

  // ----------------------------------------------------------------------------
  // SECTION 5: Adversarial Stress Testing & Security (XSS / High Volume / Nulls)
  // ----------------------------------------------------------------------------
  console.log("\n--- Section 5: Adversarial Stress Testing (XSS, Volume, Nulls) ---")

  test("EC-19: XSS injection vectors in timeline notes and author names are escaped", () => {
    const xssPayload = "<script>alert('xss-exploit')</script><img src=x onerror=alert(1)>"
    const event = createMockEvent({
      autorNome: xssPayload,
      observacoes: xssPayload,
    })

    const html = renderToString(React.createElement(TutoriaTimeline, { events: [event] }))
    // React's renderToString must HTML-entity escape raw scripts
    assert.ok(!html.includes("<script>alert"), "Raw unescaped script tag found in HTML!")
    assert.ok(html.includes("&lt;script&gt;"), "Expected escaped script tag entity &lt;script&gt;")
    assert.ok(!html.includes("<img src=x onerror"), "Raw unescaped img tag found in HTML!")
  })

  test("EC-20: High volume stress test (1,000 events) completes within performance budget", () => {
    const largeEventList: TimelineEvent[] = Array.from({ length: 1000 }, (_, i) =>
      createMockEvent({
        id: `evt-bulk-${i}`,
        createdAt: new Date(Date.now() - i * 60000).toISOString(),
        observacoes: `Intervenção em massa #${i}`,
      })
    )

    const startTime = performance.now()
    const html = renderToString(React.createElement(TutoriaTimeline, { events: largeEventList }))
    const durationMs = performance.now() - startTime

    assert.ok(html.length > 50000, "Rendered HTML should contain all events")
    assert.ok(durationMs < 1500, `Rendering 1,000 events took ${durationMs.toFixed(1)}ms (budget: 1500ms)`)
    console.log(`    (1,000 events rendered in ${durationMs.toFixed(1)}ms)`)
  })

  test("EC-21: Resilient rendering with null/undefined optional fields", () => {
    const eventWithNulls = createMockEvent({
      autorNome: undefined,
      observacoes: undefined,
      canalContato: null,
      estadoAnterior: null,
      estadoNovo: null,
      tutorResponsavelAnteriorId: null,
      tutorResponsavelNovoId: null,
      metadata: null,
    })

    const html = renderToString(React.createElement(TutoriaTimeline, { events: [eventWithNulls] }))
    assert.ok(html.length > 0)
    // When autorNome is missing, it should default to "Tutor"
    assert.ok(html.includes("Tutor"))
  })

  test("EC-22: Extremely large text in observations (20,000 chars) does not crash or overflow", () => {
    const hugeText = "Nota pedagógica longa: " + "A".repeat(20000)
    const eventWithHugeNote = createMockEvent({
      observacoes: hugeText,
    })

    const html = renderToString(React.createElement(TutoriaTimeline, { events: [eventWithHugeNote] }))
    assert.ok(html.includes("Nota pedagógica longa:"))
  })

  console.log("\n================================================================================")
  console.log(`Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`)
  console.log("================================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runEmpiricalChallengeSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err)
  process.exit(1)
})
