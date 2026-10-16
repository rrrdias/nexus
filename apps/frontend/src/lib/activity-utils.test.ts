import assert from "node:assert/strict"
import {
  parseActivities,
  isDateString,
  isValidGrade,
  classifyActivityPhase,
  isEvaluativeActivity,
  normalizeName,
} from "./activity-utils"

console.log("Starting tests for activity-utils.ts...")

// Test 1: 3-part format Nome:Nota:Data (notas_lista_fase1..3 from Moodle)
{
  const parsed = parseActivities(
    "APS2 - Atividade Prática Supervisionada:16.7:20/02/2026|APS3 - Atividade Prática Supervisionada:16.7:26/02/2026"
  )
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].nome, "APS2 - Atividade Prática Supervisionada")
  assert.equal(parsed[0].status, "Avaliado")
  assert.equal(parsed[0].nota, "16.7")
  assert.equal(parsed[0].data, "20/02/2026")

  assert.equal(parsed[1].nome, "APS3 - Atividade Prática Supervisionada")
  assert.equal(parsed[1].status, "Avaliado")
  assert.equal(parsed[1].nota, "16.7")
  assert.equal(parsed[1].data, "26/02/2026")
  console.log("✓ Test 1: 3-part Nome:Nota:Data parsed with grade and date")
}

// Test 2: 3-part format Nome:Status:Data (progresso_lista_fase1..3 from Moodle)
{
  const parsed = parseActivities(
    "APS1 - Atividade Prática Supervisionada:Concluído:10/02/2026|APS4 - Atividade Prática Supervisionada:Pendente:-"
  )
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].status, "Concluído")
  assert.equal(parsed[0].nota, null)
  assert.equal(parsed[0].data, "10/02/2026")

  assert.equal(parsed[1].status, "Pendente")
  assert.equal(parsed[1].nota, null)
  assert.equal(parsed[1].data, "-")
  console.log("✓ Test 2: 3-part Nome:Status:Data parsed with status and date")
}

// Test 3: Truncated GROUP_CONCAT fragment at end of lista_notas without ':'
{
  const rawTruncated =
    "APS1 - Atividade Prática Supervisionada:16.7:100:10/02/2026|APS9 - Atividade Prática"
  const parsed = parseActivities(rawTruncated)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].nome, "APS1 - Atividade Prática Supervisionada")
  assert.equal(parsed[0].nota, "16.7")
  console.log("✓ Test 3: Truncated 1-part fragment ignored without creating phantom activity")
}

// Test 4: Date validation rejects partial truncated dates
{
  assert.equal(isDateString("20/02/2026"), true)
  assert.equal(isDateString("2026-02-20"), true)
  assert.equal(isDateString("20/0"), false)
  assert.equal(isDateString("20/"), false)
  assert.equal(isValidGrade("16.7"), true)
  assert.equal(isValidGrade("Concluído"), false)
  console.log("✓ Test 4: Date and grade validation edge cases passed")
}

// Test 5: Phase reconciliation simulation for G2610162 (APS2 and APS3 in Phase 1 of progress, but in notas_lista_fase2/3)
{
  const progF1 = parseActivities(
    "APS1 - Atividade Prática Supervisionada:Concluído:10/02/2026|APS2 - Atividade Prática Supervisionada:Concluído:20/02/2026|APS3 - Atividade Prática Supervisionada:Concluído:26/02/2026|APS4 - Atividade Prática Supervisionada:Concluído:05/03/2026"
  )
  const progF2 = parseActivities(
    "APS5 - Atividade Prática Supervisionada:Concluído:12/03/2026|APS9 - Atividade Prática Supervisionada:Concluído:18/03/2026"
  )
  const progF3 = parseActivities(
    "APS10 - Atividade Prática Supervisionada:Pendente:-"
  )

  // Misclassified in Moodle's grades SQL because of LIKE '%2%' / LIKE '%3%'
  const notasF2 = parseActivities("APS2 - Atividade Prática Supervisionada:16.7:20/02/2026")
  const notasF3 = parseActivities("APS3 - Atividade Prática Supervisionada:16.7:26/02/2026")

  const f1Keys = new Set(progF1.map(a => normalizeName(a.nome)))
  const f2Keys = new Set(progF2.map(a => normalizeName(a.nome)))
  const f3Keys = new Set(progF3.map(a => normalizeName(a.nome)))

  // APS2 and APS3 belong to f1Keys, not f2Keys or f3Keys
  assert.equal(f1Keys.has(normalizeName(notasF2[0].nome)), true)
  assert.equal(f2Keys.has(normalizeName(notasF2[0].nome)), false)
  assert.equal(f1Keys.has(normalizeName(notasF3[0].nome)), true)
  assert.equal(f3Keys.has(normalizeName(notasF3[0].nome)), false)
  console.log("✓ Test 5: Authoritative phase reconciliation for G2610162 verified")
}

// Test 6: Truncated 2-part and 3-part tails at the end of multi-item lista_notas (e.g. 'Nome:' or 'Nome:-:3')
{
  const rawTruncated2Part =
    "APS1 - Atividade Prática Supervisionada:16.7:16.7:10/02/2026|APS7 - Atividade Prática Supervisionada:"
  const parsed2 = parseActivities(rawTruncated2Part)
  assert.equal(parsed2.length, 1)
  assert.equal(parsed2[0].nome, "APS1 - Atividade Prática Supervisionada")

  const rawTruncated3Part =
    "APS1 - Atividade Prática Supervisionada:16.7:16.7:10/02/2026|Revisando Conteúdo - Fase 1:-:2"
  const parsed3 = parseActivities(rawTruncated3Part)
  assert.equal(parsed3.length, 1)
  assert.equal(parsed3[0].nome, "APS1 - Atividade Prática Supervisionada")

  const rawTruncatedDate =
    "APS6 - Atividade Prática Supervisionada:0.0:3.3:15/06/20"
  const parsedDate = parseActivities(rawTruncatedDate)
  assert.equal(parsedDate.length, 1)
  assert.equal(parsedDate[0].data, "-")
  assert.equal(isDateString("15/06/20"), false)
  assert.equal(isDateString("15/06/202"), false)
  console.log("✓ Test 6: Truncated 2-part/3-part/date tails in lista_notas safely handled")
}

// Test 7: Evaluative activity filter (isEvaluativeActivity) and Daily - Semana XX phase classification
{
  assert.equal(isEvaluativeActivity("Entrega 1 — Apresentação"), true)
  assert.equal(isEvaluativeActivity("Entrega 1 — Carta de Apresentação"), true)
  assert.equal(isEvaluativeActivity("AVALIAÇÃO ORAL - Apresentação do Pôster"), true)
  assert.equal(isEvaluativeActivity("Apresentação da Disciplina"), false)
  assert.equal(isEvaluativeActivity("Daily - Semana 07"), true)
  assert.equal(isEvaluativeActivity("Depoimento da Instituição Concedente"), true)
  assert.equal(isEvaluativeActivity("Relatório Final Consolidado"), true)
  assert.equal(isEvaluativeActivity("Tarefa 10"), true)

  assert.equal(classifyActivityPhase("Daily - Semana 01"), 1)
  assert.equal(classifyActivityPhase("Daily - Semana 05"), 2)
  assert.equal(classifyActivityPhase("Daily - Semana 09"), 3)
  assert.equal(classifyActivityPhase("Depoimento da Instituição Concedente", 3), 3)
  console.log("✓ Test 7: Evaluative activity filter and Daily phase classification verified")
}

console.log("\nAll activity-utils tests passed successfully!")

