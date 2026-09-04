/**
 * Utilitário central de parsing, classificação e manipulação de atividades e notas do AVA (Moodle).
 */

export interface Activity {
  nome: string
  status: string
  nota?: string | null
  notaMax?: string | null
  data: string
}

export function normalizeName(name: string): string {
  if (!name) return ""
  return name
    .toLowerCase()
    .replace(/ª/g, "a")
    .replace(/º/g, "o")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[\u2010-\u2015\u2212\u002d]/g, "-") // normaliza hífens e travessões
    .replace(/\s+/g, " ")
    .trim()
}

export function isDateString(val: string | null | undefined): boolean {
  if (!val) return false
  const clean = val.trim()
  return clean.includes("/") || /^\d{2,4}-\d{2}-\d{2}/.test(clean)
}

export function isValidGrade(val: string | null | undefined): boolean {
  if (!val) return false
  const clean = val.trim()
  if (isDateString(clean)) return false
  if (/^(concl|pend|feito|realiz|avaliad|nunca|sem|none|-|null)/i.test(clean)) return false
  // Deve ser um número inteiro ou decimal válido (ex: 100, 98, 9.8, 85, 0, 2.5, 3.3)
  return /^\d+(?:[.,]\d+)?$/.test(clean)
}

export function parseActivities(raw: string | null | undefined): Activity[] {
  if (!raw) return []
  return raw.split("|").map(item => {
    const parts = item.split(":")
    const nome = parts[0]?.trim() || ""
    const second = parts[1]?.trim() || "-"
    const third = parts[2]?.trim() || "-"
    const fourth = parts[3]?.trim() || "-"

    // Formato 4 partes: Nome : Nota : NotaMax : Data
    if (parts.length >= 4) {
      const hasGrade = isValidGrade(second)
      const dataStr = isDateString(fourth) ? fourth : isDateString(third) ? third : "-"
      const maxGrade = isValidGrade(third) ? third : isValidGrade(fourth) ? fourth : "100"

      return {
        nome,
        status: hasGrade ? "Avaliado" : (second === "-" ? "Pendente" : second),
        nota: hasGrade ? second : null,
        notaMax: maxGrade,
        data: dataStr,
      }
    }

    // Formato 3 partes: (Nome : Status : Data) ou (Nome : Nota : NotaMax)
    if (parts.length === 3) {
      if (isDateString(third)) {
        return {
          nome,
          status: second || "Pendente",
          nota: null,
          notaMax: null,
          data: third,
        }
      }

      const hasGrade = isValidGrade(second)
      return {
        nome,
        status: hasGrade ? "Avaliado" : (second === "-" ? "Pendente" : second),
        nota: hasGrade ? second : null,
        notaMax: isValidGrade(third) ? third : "100",
        data: "-",
      }
    }

    // Formato 2 partes: (Nome : Data) ou (Nome : Nota) ou (Nome : Status)
    if (isDateString(second)) {
      return {
        nome,
        status: "Concluído",
        nota: null,
        notaMax: null,
        data: second,
      }
    }

    if (isValidGrade(second)) {
      return {
        nome,
        status: "Avaliado",
        nota: second,
        notaMax: "100",
        data: "-",
      }
    }

    return {
      nome,
      status: second || "Pendente",
      nota: null,
      notaMax: null,
      data: "-",
    }
  }).filter(a => a.nome)
}

/**
 * Classifica rigorosamente em qual Fase (1, 2 ou 3) a atividade pertence.
 */
export function classifyActivityPhase(name: string): 1 | 2 | 3 {
  const norm = normalizeName(name)

  // 1. Verificações / Provas / VAs explícitas
  if (norm.includes("1a verificacao") || norm.includes("1a va") || norm.includes("va 1") || norm.includes("va1") || norm.includes("fase 1") || norm.includes("entrega 1") || norm.includes("revisando conteudo - fase 1") || norm.includes("revisando conteudo - fase1")) {
    return 1
  }
  if (norm.includes("2a verificacao") || norm.includes("2a va") || norm.includes("va 2") || norm.includes("va2") || norm.includes("fase 2") || norm.includes("entrega 2") || norm.includes("entrega 3") || norm.includes("revisando conteudo - fase 2") || norm.includes("revisando conteudo - fase2")) {
    return 2
  }
  if (norm.includes("3a verificacao") || norm.includes("3a va") || norm.includes("va 3") || norm.includes("va3") || norm.includes("fase 3") || norm.includes("exame") || norm.includes("final") || norm.includes("entrega 4") || norm.includes("entrega 5") || norm.includes("entrega 6") || norm.includes("entrega 7") || norm.includes("revisando conteudo - fase 3") || norm.includes("revisando conteudo - fase3")) {
    return 3
  }

  // 2. APS (Atividade Prática Supervisionada) -> APS 1 a 6 = Fase 1, APS 7 a 12 = Fase 2, APS 13 a 17 = Fase 3
  const matchAps = norm.match(/(?:aps\s*|atividade\s+pratica\s+supervisionada\s*)(\d+)/i)
  if (matchAps && matchAps[1]) {
    const apsNum = parseInt(matchAps[1], 10)
    if (apsNum >= 13) return 3
    if (apsNum >= 7) return 2
    return 1 // APS 1 a 6
  }

  // 3. Unidades Temáticas / Fixações (UT 01 a 04 = Fase 1, UT 05 a 08 = Fase 2, UT 09 a 12 = Fase 3)
  const matchUnit = norm.match(/(?:unidade\s+tematica|unidade|ut|fixacao\s*-\s*unidade\s+tematica)\s*(\d+)/i)
  if (matchUnit && matchUnit[1]) {
    const unitNum = parseInt(matchUnit[1], 10)
    if (unitNum >= 9) return 3
    if (unitNum >= 5) return 2
    return 1 // UT 1 a 4
  }

  // 4. Entregas (Extensionistas / Projetos)
  const matchEntrega = norm.match(/(?:entrega)\s*(\d+)/i)
  if (matchEntrega && matchEntrega[1]) {
    const entNum = parseInt(matchEntrega[1], 10)
    if (entNum >= 4) return 3
    if (entNum >= 2) return 2
    return 1
  }

  return 1
}

export function isEvaluativeActivity(name: string): boolean {
  const norm = normalizeName(name)
  return (
    norm.includes("verificacao") ||
    norm.includes("avaliacao") ||
    norm.includes("prova") ||
    norm.includes("va") ||
    norm.includes("fase") ||
    norm.includes("exame") ||
    norm.includes("entrega") ||
    norm.includes("aps")
  )
}
