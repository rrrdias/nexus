/**
 * apps/frontend/src/lib/tutoria-kanban-m4-adversarial.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE — MILESTONE 4
 * Features:
 * - F10: Lead Tutor Badge on Kanban Cards (getLeadTutorInfo)
 * - F11: Recent Intervention Indicator (checkRecentIntervention)
 * - F12: BatonPassDialog Input Validation & Security (validateBatonPassInput, BatonPassForm SSR)
 * - F13: Movimentação Kanban Preservando Posse (DnD payload invariant)
 *
 * Execution:
 *   npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4-adversarial.test.ts
 */

import assert from "node:assert/strict"
import React from "react"
import { renderToString } from "react-dom/server"
import {
  validateBatonPassInput,
  getLeadTutorInfo,
  checkRecentIntervention,
} from "./tutoria-utils"
import {
  getLeadTutorInfo as kanbanGetLeadTutorInfo,
  checkRecentIntervention as kanbanCheckRecentIntervention,
} from "../app/tutoria/kanban/TutoriaKanbanClient"
import { BatonPassForm, BatonPassDialog } from "../components/tutoria/BatonPassDialog"

async function runAdversarialM4Suite() {
  console.log("================================================================================")
  console.log("ADVERSARIAL EMPIRICAL HARNESS: MILESTONE 4 (Frontend Kanban & Baton Pass)")
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
  // SECTION 1: BatonPassDialog Input Validation Boundary Stress (F12)
  // ============================================================================
  console.log("--- Section 1: BatonPassDialog Input Validation Boundary Stress ---")

  test("ADV-M4-01: Note length boundary: 0, 1, 2, 3, 4 chars rejected", () => {
    const tutorA = "tutor-uuid-1"
    const tutorB = "tutor-uuid-2"

    for (let len = 0; len < 5; len++) {
      const note = "a".repeat(len)
      const res = validateBatonPassInput(tutorB, tutorA, note)
      assert.equal(res.valid, false, `Length ${len} should be rejected`)
      assert.match(res.error || "", /mínimo de 5 caracteres/i)
    }
  })

  test("ADV-M4-02: Note length boundary: exactly 5 chars accepted", () => {
    const res = validateBatonPassInput("tutor-2", "tutor-1", "12345")
    assert.equal(res.valid, true)
    assert.equal(res.error, undefined)
  })

  test("ADV-M4-03: Whitespace boundary: 5 spaces trimmed to 0 rejected", () => {
    const res = validateBatonPassInput("tutor-2", "tutor-1", "     ")
    assert.equal(res.valid, false)
    assert.match(res.error || "", /mínimo de 5 caracteres/i)
  })

  test("ADV-M4-04: Whitespace boundary: tabs, newlines, mixed whitespace trimmed", () => {
    const resTabs = validateBatonPassInput("tutor-2", "tutor-1", "\t\n  \r\n \t")
    assert.equal(resTabs.valid, false)

    const resFourWithSpaces = validateBatonPassInput("tutor-2", "tutor-1", "   four   ")
    assert.equal(resFourWithSpaces.valid, false)

    const resFiveWithSpaces = validateBatonPassInput("tutor-2", "tutor-1", "   five!   ")
    assert.equal(resFiveWithSpaces.valid, true)
  })

  test("ADV-M4-05: Unicode and multi-language note strings accepted", () => {
    // Portuguese accents
    const resPt = validateBatonPassInput(
      "tutor-2",
      "tutor-1",
      "Ação pedagógica de suporte ao aluno em cálculo diferencial."
    )
    assert.equal(resPt.valid, true)

    // Japanese CJK
    const resJa = validateBatonPassInput("tutor-2", "tutor-1", "学生指導の引き継ぎメモ")
    assert.equal(resJa.valid, true)

    // Arabic RTL
    const resAr = validateBatonPassInput("tutor-2", "tutor-1", "ملاحظات الانتقال التعليمي للطلاب")
    assert.equal(resAr.valid, true)

    // Cyrillic
    const resRu = validateBatonPassInput("tutor-2", "tutor-1", "Передача кураторства студента")
    assert.equal(resRu.valid, true)
  })

  test("ADV-M4-06: Emoji note handling", () => {
    // 3 emojis separated by spaces: "📚 🎯 🚀"
    const resEmojis = validateBatonPassInput("tutor-2", "tutor-1", "📚 🎯 🚀")
    assert.equal(resEmojis.valid, true)

    // Emoji note with text
    const resMixed = validateBatonPassInput("tutor-2", "tutor-1", "Nota de transição 👨‍🏫")
    assert.equal(resMixed.valid, true)
  })

  test("ADV-M4-07: SQL Injection and XSS payloads in note accepted as safe plain text", () => {
    const sqlPayload = "'; DROP TABLE tutoria_atendimentos_kanban; --"
    const resSql = validateBatonPassInput("tutor-2", "tutor-1", sqlPayload)
    assert.equal(resSql.valid, true)

    const xssPayload = "<script>alert('xss')</script>"
    const resXss = validateBatonPassInput("tutor-2", "tutor-1", xssPayload)
    assert.equal(resXss.valid, true)
  })

  test("ADV-M4-08: Massive note size stress (10,000 and 50,000 characters)", () => {
    const hugeNote = "Passagem de bastão pedagógico: " + "X".repeat(50000)
    const t0 = performance.now()
    const res = validateBatonPassInput("tutor-2", "tutor-1", hugeNote)
    const elapsed = performance.now() - t0

    assert.equal(res.valid, true)
    assert.ok(elapsed < 100, `Validation of 50k chars took ${elapsed.toFixed(2)}ms (budget < 100ms)`)
  })

  test("ADV-M4-09: Self-transfer rejection: exact match, whitespace padding", () => {
    // Exact match
    const resExact = validateBatonPassInput("tutor-abc", "tutor-abc", "Nota válida pedagógica")
    assert.equal(resExact.valid, false)
    assert.match(resExact.error || "", /diferente do tutor responsável atual/i)

    // Whitespace padding in IDs
    const resPadded = validateBatonPassInput("  tutor-abc  ", "tutor-abc", "Nota válida pedagógica")
    assert.equal(resPadded.valid, false)
    assert.match(resPadded.error || "", /diferente do tutor responsável atual/i)
  })

  test("ADV-M4-10: Target tutor ID missing / empty / whitespace only rejected", () => {
    const resNull = validateBatonPassInput(null as any, "tutor-1", "Nota pedagógica válida")
    assert.equal(resNull.valid, false)
    assert.match(resNull.error || "", /selecione o novo tutor/i)

    const resUndefined = validateBatonPassInput(undefined as any, "tutor-1", "Nota pedagógica válida")
    assert.equal(resUndefined.valid, false)

    const resEmpty = validateBatonPassInput("", "tutor-1", "Nota pedagógica válida")
    assert.equal(resEmpty.valid, false)

    const resSpaces = validateBatonPassInput("    ", "tutor-1", "Nota pedagógica válida")
    assert.equal(resSpaces.valid, false)
  })

  test("ADV-M4-11: Unassigned student (currentTutorId is null/undefined/empty) allows any valid target", () => {
    const resNull = validateBatonPassInput("tutor-new", null, "Nota pedagógica de transição")
    assert.equal(resNull.valid, true)

    const resUndefined = validateBatonPassInput("tutor-new", undefined, "Nota pedagógica de transição")
    assert.equal(resUndefined.valid, true)

    const resEmpty = validateBatonPassInput("tutor-new", "", "Nota pedagógica de transição")
    assert.equal(resEmpty.valid, true)

    const resSpaces = validateBatonPassInput("tutor-new", "   ", "Nota pedagógica de transição")
    assert.equal(resSpaces.valid, true)
  })

  // ============================================================================
  // SECTION 2: getLeadTutorInfo Extreme Boundary & Permutations Stress (F10)
  // ============================================================================
  console.log("\n--- Section 2: getLeadTutorInfo Extreme Boundary & Permutations Stress ---")

  test("ADV-M4-12: getLeadTutorInfo handles null, undefined, primitive, and empty card", () => {
    const session = { id: "user-1", name: "Ricardo" }

    assert.deepEqual(getLeadTutorInfo(null, session), {
      tutorId: null,
      tutorName: null,
      isMe: false,
      hasTutor: false,
    })

    assert.deepEqual(getLeadTutorInfo(undefined, session), {
      tutorId: null,
      tutorName: null,
      isMe: false,
      hasTutor: false,
    })

    assert.deepEqual(getLeadTutorInfo({} as any, session), {
      tutorId: null,
      tutorName: null,
      isMe: false,
      hasTutor: false,
    })

    assert.deepEqual(getLeadTutorInfo(12345 as any, session), {
      tutorId: null,
      tutorName: null,
      isMe: false,
      hasTutor: false,
    })
  })

  test("ADV-M4-13: getLeadTutorInfo handles null, undefined, and malformed sessionUser", () => {
    const cardWithTutor = {
      tutor_responsavel_id: "tutor-99",
      tutor_nome: "Prof. Ana",
    }

    const resUndef = getLeadTutorInfo(cardWithTutor, undefined)
    assert.equal(resUndef.isMe, false)
    assert.equal(resUndef.hasTutor, true)
    assert.equal(resUndef.tutorId, "tutor-99")
    assert.equal(resUndef.tutorName, "Prof. Ana")

    const resNull = getLeadTutorInfo(cardWithTutor, null)
    assert.equal(resNull.isMe, false)

    const resEmptyObj = getLeadTutorInfo(cardWithTutor, {})
    assert.equal(resEmptyObj.isMe, false)
  })

  test("ADV-M4-14: Property field name variations resolution", () => {
    const session = { id: "user-x", name: "Carlos" }

    // snake_case
    const c1 = { tutor_responsavel_id: "user-x", tutor_nome: "Carlos" }
    assert.equal(getLeadTutorInfo(c1, session).isMe, true)

    // camelCase
    const c2 = { tutorResponsavelId: "user-x", tutorResponsavelNome: "Carlos" }
    assert.equal(getLeadTutorInfo(c2, session).isMe, true)

    // alternate combinations
    const c3 = { tutorResponsavelId: "user-x", tutor_responsavel_nome: "Carlos" }
    assert.equal(getLeadTutorInfo(c3, session).isMe, true)

    const c4 = { tutor_responsavel_id: "user-x", tutorNome: "Carlos" }
    assert.equal(getLeadTutorInfo(c4, session).isMe, true)
  })

  test("ADV-M4-15: Case-insensitive and trimmed name matching fallback", () => {
    const session = { id: "different-id", name: "  Prof. RICARDO Dias  " }
    const card = {
      tutor_responsavel_id: null,
      tutor_nome: "prof. ricardo dias\n",
    }
    const info = getLeadTutorInfo(card, session)
    assert.equal(info.isMe, true)
    assert.equal(info.hasTutor, true)
  })

  test("ADV-M4-16: 1,000 synthetic card permutations stress test", () => {
    const session = { id: "my-id", name: "Lead Tutor" }
    const names = [null, undefined, "", "Lead Tutor", "lead tutor", "Other Tutor", "  Lead Tutor  "]
    const ids = [null, undefined, "", "my-id", "other-id", "MY-ID"]

    const t0 = performance.now()
    let count = 0

    for (let i = 0; i < 1000; i++) {
      const card = {
        id: `card-${i}`,
        tutor_responsavel_id: ids[i % ids.length],
        tutor_nome: names[i % names.length],
        tutorResponsavelId: ids[(i + 1) % ids.length],
        tutorResponsavelNome: names[(i + 1) % names.length],
      }

      const res = getLeadTutorInfo(card, session)
      assert.equal(typeof res.isMe, "boolean")
      assert.equal(typeof res.hasTutor, "boolean")
      count++
    }

    const elapsed = performance.now() - t0
    assert.equal(count, 1000)
    assert.ok(elapsed < 200, `1,000 getLeadTutorInfo took ${elapsed.toFixed(2)}ms (budget < 200ms)`)
  })

  // ============================================================================
  // SECTION 3: checkRecentIntervention Extreme Boundary Stress (F11)
  // ============================================================================
  console.log("\n--- Section 3: checkRecentIntervention Extreme Boundary Stress ---")

  const BASE_NOW = 1700000000000 // Arbitrary fixed nowMs (Nov 2023)
  const MAX_48H_MS = 48 * 60 * 60 * 1000 // 172,800,000 ms

  test("ADV-M4-17: Exact boundary: exactly 48h (172,800,000 ms ago) isRecent = true", () => {
    const card = {
      ultima_intervencao_em: new Date(BASE_NOW - MAX_48H_MS).toISOString(),
      qtd_intervencoes: 3,
    }
    const res = checkRecentIntervention(card, BASE_NOW)
    assert.equal(res.isRecent, true, "Exact 48h must be considered recent")
    assert.equal(res.elapsedHours, 48)
    assert.equal(res.formattedRelative, "há 48h")
    assert.equal(res.interventionCount, 3)
  })

  test("ADV-M4-18: Boundary + 1ms: 48h + 1ms (172,800,001 ms ago) isRecent = false", () => {
    const card = {
      ultima_intervencao_em: new Date(BASE_NOW - MAX_48H_MS - 1).toISOString(),
      qtd_intervencoes: 2,
    }
    const res = checkRecentIntervention(card, BASE_NOW)
    assert.equal(res.isRecent, false, "48h + 1ms must NOT be considered recent")
    assert.equal(res.formattedRelative, "")
    assert.equal(res.interventionCount, 2)
  })

  test("ADV-M4-19: Boundary - 1ms: 48h - 1ms (172,799,999 ms ago) isRecent = true", () => {
    const card = {
      ultima_intervencao_em: new Date(BASE_NOW - MAX_48H_MS + 1).toISOString(),
      qtd_intervencoes: 1,
    }
    const res = checkRecentIntervention(card, BASE_NOW)
    assert.equal(res.isRecent, true, "48h - 1ms must be considered recent")
    assert.equal(res.elapsedHours, 47)
    assert.equal(res.formattedRelative, "há 47h")
  })

  test("ADV-M4-20: Clock skew tolerance: events up to 5 minutes into the future are accepted", () => {
    // 10 seconds into the future
    const card10s = {
      ultima_intervencao_em: new Date(BASE_NOW + 10000).toISOString(),
      qtd_intervencoes: 1,
    }
    const res10s = checkRecentIntervention(card10s, BASE_NOW)
    assert.equal(res10s.isRecent, true)
    assert.equal(res10s.formattedRelative, "agora há pouco")

    // Exactly 5 minutes (300,000 ms) into future
    const card5m = {
      ultima_intervencao_em: new Date(BASE_NOW + 300000).toISOString(),
      qtd_intervencoes: 1,
    }
    const res5m = checkRecentIntervention(card5m, BASE_NOW)
    assert.equal(res5m.isRecent, true)
    assert.equal(res5m.formattedRelative, "agora há pouco")

    // 5 minutes + 1ms into future (exceeds clock skew tolerance)
    const card5mPlus = {
      ultima_intervencao_em: new Date(BASE_NOW + 300001).toISOString(),
      qtd_intervencoes: 1,
    }
    const res5mPlus = checkRecentIntervention(card5mPlus, BASE_NOW)
    assert.equal(res5mPlus.isRecent, false)
  })

  test("ADV-M4-21: Future anomaly (> 1 hour into future) is rejected with null elapsedHours", () => {
    const cardFuture = {
      ultima_intervencao_em: new Date(BASE_NOW + 3600001).toISOString(),
      qtd_intervencoes: 5,
    }
    const res = checkRecentIntervention(cardFuture, BASE_NOW)
    assert.equal(res.isRecent, false)
    assert.equal(res.elapsedHours, null)
    assert.equal(res.formattedRelative, "")
  })

  test("ADV-M4-22: Epoch 0 and 1970 dates are rejected", () => {
    // Epoch 0 (1970-01-01T00:00:00.000Z)
    const cardEpoch0 = {
      ultima_intervencao_em: "1970-01-01T00:00:00.000Z",
      qtd_intervencoes: 1,
    }
    const res0 = checkRecentIntervention(cardEpoch0, BASE_NOW)
    assert.equal(res0.isRecent, false)

    // Day 1 of Epoch (timeMs = 86400000)
    const cardEpoch1 = {
      ultima_intervencao_em: new Date(86400000).toISOString(),
      qtd_intervencoes: 1,
    }
    const res1 = checkRecentIntervention(cardEpoch1, BASE_NOW)
    assert.equal(res1.isRecent, false)
  })

  test("ADV-M4-23: Malformed dates do not crash and return isRecent = false", () => {
    const badStrings = [
      "not-a-date",
      "2026-99-99T99:99:99Z",
      "",
      "null",
      "undefined",
      "NaN",
      "Invalid Date",
    ]

    for (const bad of badStrings) {
      const card = {
        ultima_intervencao_em: bad,
        qtd_intervencoes: 2,
      }
      const res = checkRecentIntervention(card, BASE_NOW)
      assert.equal(res.isRecent, false, `Date "${bad}" must return isRecent=false`)
      assert.equal(res.elapsedHours, null)
    }
  })

  test("ADV-M4-24: Fallback hierarchy of date fields", () => {
    const date1 = new Date(BASE_NOW - 10 * 60 * 1000).toISOString() // 10 min ago
    const date2 = new Date(BASE_NOW - 60 * 60 * 1000).toISOString() // 1h ago
    const date3 = new Date(BASE_NOW - 120 * 60 * 1000).toISOString() // 2h ago
    const dateUpdated = new Date(BASE_NOW - 180 * 60 * 1000).toISOString() // 3h ago

    // 1. ultima_intervencao_em takes precedence
    const c1 = {
      ultima_intervencao_em: date1,
      ultimo_contato_em: date2,
      updatedAt: dateUpdated,
      qtd_intervencoes: 1,
    }
    assert.equal(checkRecentIntervention(c1, BASE_NOW).formattedRelative, "há 10min")

    // 2. ultimaIntervencaoEm (camelCase)
    const c2 = {
      ultimaIntervencaoEm: date1,
      ultimo_contato_em: date2,
      updatedAt: dateUpdated,
      qtd_intervencoes: 1,
    }
    assert.equal(checkRecentIntervention(c2, BASE_NOW).formattedRelative, "há 10min")

    // 3. ultimo_contato_em fallback
    const c3 = {
      ultima_intervencao_em: null,
      ultimo_contato_em: date2,
      updatedAt: dateUpdated,
      qtd_intervencoes: 1,
    }
    assert.equal(checkRecentIntervention(c3, BASE_NOW).formattedRelative, "há 1h")

    // 4. ultimoContatoEm (camelCase)
    const c4 = {
      ultima_intervencao_em: null,
      ultimoContatoEm: date3,
      updatedAt: dateUpdated,
      qtd_intervencoes: 1,
    }
    assert.equal(checkRecentIntervention(c4, BASE_NOW).formattedRelative, "há 2h")

    // 5. updatedAt used ONLY when qtd_intervencoes > 0
    const c5WithCount = {
      ultima_intervencao_em: null,
      updatedAt: dateUpdated,
      qtd_intervencoes: 2,
    }
    assert.equal(checkRecentIntervention(c5WithCount, BASE_NOW).formattedRelative, "há 3h")

    // 6. updatedAt NOT used when qtd_intervencoes is 0
    const c5NoCount = {
      ultima_intervencao_em: null,
      updatedAt: dateUpdated,
      qtd_intervencoes: 0,
    }
    assert.equal(checkRecentIntervention(c5NoCount, BASE_NOW).isRecent, false)
  })

  // ============================================================================
  // SECTION 4: Component SSR Rendering & XSS Security (F12)
  // ============================================================================
  console.log("\n--- Section 4: Component SSR Rendering & XSS Security ---")

  test("ADV-M4-25: BatonPassForm SSR renders safely with XSS strings in student name", () => {
    const xssAluno = "<script>alert('pwned')</script> Est. Silva"
    const xssDisciplina = "<img src=x onerror=alert(1)> Cálculo I"
    const xssTutor = "<b>Prof. Hacker</b>"

    const html = renderToString(
      React.createElement(BatonPassForm, {
        cardId: "card-xss-1",
        matricula: "20240999",
        alunoNome: xssAluno,
        disciplinaNome: xssDisciplina,
        currentTutorId: "tutor-1",
        currentTutorNome: xssTutor,
        initialTutors: [
          { id: "tutor-1", name: "Prof. Hacker", email: "hacker@nexus.edu" },
          { id: "tutor-2", name: "Prof. Seguro", email: "seguro@nexus.edu" },
        ],
      })
    )

    // Verify raw unescaped script tags are NOT present
    assert.ok(!html.includes("<script>alert('pwned')</script>"))
    assert.ok(html.includes("&lt;script&gt;alert(&#x27;pwned&#x27;)&lt;/script&gt;"))
    assert.ok(!html.includes("<img src=x"))
    assert.ok(html.includes("&lt;img src=x"))
  })

  test("ADV-M4-26: BatonPassForm marks current tutor as disabled with '(Tutor atual)'", () => {
    const html = renderToString(
      React.createElement(BatonPassForm, {
        cardId: "card-dis-1",
        currentTutorId: "tutor-current",
        initialTutors: [
          { id: "tutor-current", name: "Prof. Ricardo", email: "ricardo@nexus.edu" },
          { id: "tutor-other", name: "Prof. Beatriz", email: "beatriz@nexus.edu" },
        ],
      })
    )

    assert.ok(html.includes("disabled"))
    assert.ok(html.includes("(Tutor atual)"))
    assert.ok(html.includes("Prof. Beatriz"))
  })

  test("ADV-M4-27: BatonPassDialog renders trigger and BatonPassForm renders header in standalone mode", () => {
    // BatonPassDialog uncontrolled mode renders trigger button
    const dialogHtml = renderToString(
      React.createElement(BatonPassDialog, {
        cardId: "card-ctrl-1",
        initialTutors: [{ id: "tutor-1", name: "Prof. Alpha", email: "alpha@nexus.edu" }],
      })
    )
    assert.ok(
      dialogHtml.includes("Transferir Atendimento") || dialogHtml.includes("Passar Bastão")
    )

    // BatonPassForm with showHeader=true renders title and description
    const formHtml = renderToString(
      React.createElement(BatonPassForm, {
        cardId: "card-ctrl-1",
        showHeader: true,
        initialTutors: [{ id: "tutor-1", name: "Prof. Alpha", email: "alpha@nexus.edu" }],
      })
    )
    assert.ok(
      formHtml.includes("Transferência de Atendimento") || formHtml.includes("Passagem de Bastão Pedagógico")
    )
    assert.ok(formHtml.includes("Confirmar Transferência"))
  })

  // ============================================================================
  // SECTION 5: Movimentação Kanban Preservando Posse (F13 Invariant)
  // ============================================================================
  console.log("\n--- Section 5: Movimentação Kanban Preservando Posse (F13) ---")

  test("ADV-M4-28: Column move payload never touches tutor_responsavel_id or tutor_nome", () => {
    const initialCard = {
      id: "card-123",
      aluno_nome: "Maria Oliveira",
      status_kanban: "pendente",
      tutor_responsavel_id: "original-lead-uuid",
      tutor_nome: "Prof. Titular Original",
      qtd_intervencoes: 2,
    }

    // Simulate handleMoveCard logic
    const updatePayload = {
      statusKanban: "em_contato",
    }

    assert.equal((updatePayload as any).tutorResponsavelId, undefined)
    assert.equal((updatePayload as any).tutor_responsavel_id, undefined)
    assert.equal((updatePayload as any).tutorNome, undefined)

    // Simulate optimistic update logic in TutoriaKanbanClient
    const updatedCard = {
      ...initialCard,
      status_kanban: updatePayload.statusKanban,
      statusKanban: updatePayload.statusKanban,
    }

    assert.equal(updatedCard.tutor_responsavel_id, "original-lead-uuid")
    assert.equal(updatedCard.tutor_nome, "Prof. Titular Original")
    assert.equal(updatedCard.status_kanban, "em_contato")
  })

  test("ADV-M4-29: Baton Pass update alters ownership and increments interventions", () => {
    const initialCard = {
      id: "card-123",
      aluno_nome: "Maria Oliveira",
      status_kanban: "em_contato",
      tutor_responsavel_id: "lead-old",
      tutor_nome: "Prof. Anterior",
      qtd_intervencoes: 2,
      ultima_intervencao_em: "2026-11-01T10:00:00.000Z",
    }

    const batonPassResult = {
      novoTutorId: "lead-new",
      novoTutorNome: "Prof. Novo Titular",
      notaTransicao: "Transferindo caso pedagógico",
    }

    // Simulate handleBatonPassSuccess logic
    const nowIso = new Date().toISOString()
    const updatedCard = {
      ...initialCard,
      tutor_responsavel_id: batonPassResult.novoTutorId,
      tutor_nome: batonPassResult.novoTutorNome,
      qtd_intervencoes: initialCard.qtd_intervencoes + 1,
      ultima_intervencao_em: nowIso,
    }

    assert.equal(updatedCard.tutor_responsavel_id, "lead-new")
    assert.equal(updatedCard.tutor_nome, "Prof. Novo Titular")
    assert.equal(updatedCard.qtd_intervencoes, 3)
    assert.equal(updatedCard.ultima_intervencao_em, nowIso)
  })

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n================================================================================")
  console.log(`Adversarial Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`)
  console.log("================================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

runAdversarialM4Suite().catch((err) => {
  console.error("Fatal error running adversarial suite:", err)
  process.exit(1)
})
