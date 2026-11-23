import assert from "node:assert/strict"
import {
  splitCourseAndCode,
  formatPhone,
  getWhatsAppLink,
  buildMoodleUrl,
  buildMoodleProfileUrl,
} from "./course-utils"
import {
  createStudentSessionToken,
  verifyStudentSessionToken,
} from "./student-session"
import {
  isPasswordHash,
  hashPassword,
  verifyPassword,
} from "./password"
import {
  DEFAULT_PERIOD,
  getAcademicPhaseDates,
} from "./academic-config"
import {
  getOnlineTurmasAction,
  getTurmaGradesWithStudentsAction,
  triggerSyncGradesMirrorAction,
  exportAcademicGradesAction,
} from "../app/actions/academic-grades"

async function runCoreUtilsTests() {
  console.log("Starting tests for core-utils (course-utils, student-session, password, academic-config)...")

  // 1. course-utils.ts
  {
    const parsedOnline = splitCourseAndCode(
      "FORMAS CONSENSUAIS DE SOLUÇÃO DE CONFLITOS ON-LINE-S01020114-INT-B20262",
    )
    assert.equal(parsedOnline.name, "FORMAS CONSENSUAIS DE SOLUÇÃO DE CONFLITOS")
    assert.equal(parsedOnline.code, "S01020114-INT-B20262")
    assert.equal(parsedOnline.isOnline, true)

    const parsedPlain = splitCourseAndCode("DIREITO CONSTITUCIONAL")
    assert.equal(parsedPlain.name, "DIREITO CONSTITUCIONAL")
    assert.equal(parsedPlain.code, null)
    assert.equal(parsedPlain.isOnline, false)

    assert.deepEqual(splitCourseAndCode(null), { name: "-", code: null, isOnline: false })
    assert.deepEqual(splitCourseAndCode(""), { name: "-", code: null, isOnline: false })

    assert.equal(formatPhone("62999998888"), "(62) 99999-8888")
    assert.equal(formatPhone("(62) 3310-6600"), "(62) 3310-6600")
    assert.equal(formatPhone(null), null)
    assert.equal(formatPhone("   "), null)

    const waUrl = getWhatsAppLink("62999998888", "Maria Silva")
    assert.ok(waUrl)
    assert.ok(waUrl.startsWith("https://wa.me/5562999998888?text="))
    assert.match(decodeURIComponent(waUrl), /Maria/)
    assert.equal(getWhatsAppLink("12345", "Maria"), null)

    assert.equal(
      buildMoodleUrl("ead", "123"),
      "https://avaead.unievangelica.edu.br/message/index.php?id=123",
    )
    assert.equal(
      buildMoodleProfileUrl("UNI", "456"),
      "https://avagrad.unievangelica.edu.br/user/profile.php?id=456",
    )
    assert.equal(
      buildMoodleUrl("uniego", "789"),
      "https://ava.uniego.edu.br/message/index.php?id=789",
    )
    assert.equal(
      buildMoodleProfileUrl("raizes", "101"),
      "https://ava.faculdaderaizes.edu.br/user/profile.php?id=101",
    )
    assert.equal(
      buildMoodleUrl("eefn", "202"),
      "https://ava.aee.edu.br/message/index.php?id=202",
    )
    assert.equal(buildMoodleUrl("unknown", "123"), null)
    assert.equal(buildMoodleProfileUrl("ead", ""), null)

    console.log("✓ Test 1: course-utils functions passed")
  }

  // 2. student-session.ts
  {
    const secret = "test-secret-key-2026"
    const token = await createStudentSessionToken("2026001a", secret)
    assert.ok(token.startsWith("2026001A."))

    const validRes = await verifyStudentSessionToken(token, "2026001a", secret)
    assert.equal(validRes.valid, true)
    assert.equal(validRes.matricula, "2026001A")

    const mismatchRes = await verifyStudentSessionToken(token, "2026002", secret)
    assert.equal(mismatchRes.valid, false)

    const parts = token.split(".")
    const tamperedSig = parts[2].slice(0, -1) + (parts[2].endsWith("a") ? "b" : "a")
    const tamperedRes = await verifyStudentSessionToken(
      `${parts[0]}.${parts[1]}.${tamperedSig}`,
      "2026001A",
      secret,
    )
    assert.equal(tamperedRes.valid, false)

    const invalidFormatRes = await verifyStudentSessionToken("invalid.token", undefined, secret)
    assert.equal(invalidFormatRes.valid, false)

    const missingRes = await verifyStudentSessionToken(null, undefined, secret)
    assert.equal(missingRes.valid, false)

    console.log("✓ Test 2: student-session HMAC token creation & verification passed")
  }

  // 3. password.ts
  {
    const hashed = await hashPassword("SenhaSegura!2026")
    assert.equal(isPasswordHash(hashed), true)
    assert.equal(isPasswordHash("plain-text"), false)

    assert.equal(await verifyPassword("SenhaSegura!2026", hashed), true)
    assert.equal(await verifyPassword("SenhaErrada", hashed), false)

    // Plaintext timing-safe fallback compatibility
    assert.equal(await verifyPassword("legado123", "legado123"), true)
    assert.equal(await verifyPassword("legado124", "legado123"), false)
    assert.equal(await verifyPassword("qualquer", null), false)

    console.log("✓ Test 3: password hashing & verification passed")
  }

  // 4. academic-config.ts
  {
    assert.ok(typeof DEFAULT_PERIOD === "string" && DEFAULT_PERIOD.length > 0)
    const phases = getAcademicPhaseDates()

    for (const key of ["fase1", "fase2", "fase3"] as const) {
      const phase = phases[key]
      assert.ok(phase.inicio instanceof Date && !isNaN(phase.inicio.getTime()))
      assert.ok(phase.fim instanceof Date && !isNaN(phase.fim.getTime()))
      assert.ok(phase.inicio.getTime() <= phase.fim.getTime())
    }

    console.log("✓ Test 4: academic-config period & phase dates passed")
  }

  // 5. academic-grades.ts Server Actions
  {
    const prevFetch = globalThis.fetch
    const prevToken = process.env.TEST_AUTH_TOKEN
    const prevUrl = process.env.NEXT_API_URL

    process.env.TEST_AUTH_TOKEN = "mock-jwt-grades-test"
    process.env.NEXT_API_URL = "http://127.0.0.1:3999"

    const calls: { url: string; method: string; body: any }[] = []
    let nextStatus = 200
    let nextBody: any = { data: [], meta: { total: 0 } }

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      const method = init?.method || "GET"
      const body = init?.body ? JSON.parse(init.body as string) : null
      calls.push({ url, method, body })
      return new Response(JSON.stringify(nextBody), { status: nextStatus })
    }) as any

    try {
      nextStatus = 200
      nextBody = { data: [{ id: "t1", turma: "DIR-ON-20262" }], meta: { total: 1 } }
      const listRes = await getOnlineTurmasAction({ periodo: "2026-2", search: "DIR" })
      assert.equal(listRes.success, true)
      assert.match(calls[0].url, /\/api\/academic\/grades\/turmas\?periodo=2026-2&search=DIR$/)

      nextBody = { turma: { id: "t1" }, alunos: [], meta: { total: 0 } }
      const studentsRes = await getTurmaGradesWithStudentsAction("t1", {
        statusMatricula: "suspenso",
        statusNota: "pendente",
      })
      assert.equal(studentsRes.success, true)
      assert.match(
        calls[1].url,
        /\/api\/academic\/grades\/turmas\/t1\/alunos\?statusMatricula=suspenso&statusNota=pendente$/,
      )

      nextBody = { status: "completed", mirror: { turmasEspelhadas: 2 } }
      const syncRes = await triggerSyncGradesMirrorAction({ periodo: "2026-2", correlateAfter: true })
      assert.equal(syncRes.success, true)
      assert.equal(calls[2].method, "POST")
      assert.deepEqual(calls[2].body, { periodo: "2026-2", correlateAfter: true })

      nextStatus = 500
      nextBody = { message: "Erro simulado no espelho" }
      const errRes = await exportAcademicGradesAction({ periodo: "2026-2" })
      assert.equal(errRes.success, false)
      assert.match(errRes.error || "", /Erro simulado no espelho/)

      console.log("✓ Test 5: academic-grades Server Actions (happy path & error resilience) passed")
    } finally {
      globalThis.fetch = prevFetch
      if (prevToken === undefined) delete process.env.TEST_AUTH_TOKEN
      else process.env.TEST_AUTH_TOKEN = prevToken
      if (prevUrl === undefined) delete process.env.NEXT_API_URL
      else process.env.NEXT_API_URL = prevUrl
    }
  }

  console.log("\nAll core-utils tests passed successfully!")
}

runCoreUtilsTests().catch((err) => {
  console.error("core-utils tests failed:", err)
  process.exit(1)
})
