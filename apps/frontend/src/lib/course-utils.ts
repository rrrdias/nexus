/**
 * Utilitário para manipulação, extração e formatação de nomes de cursos,
 * códigos de turmas e links de integração AVA / WhatsApp.
 */

export interface ParsedCourse {
  name: string
  code: string | null
  isOnline: boolean
}

/**
 * Separa com precisão o nome limpo da disciplina e o código da turma.
 * Trata variações como 'ON-LINE', hífens múltiplos, turmas sem traço, etc.
 * Exemplo: 'FORMAS CONSENSUAIS DE SOLUÇÃO DE CONFLITOS ON-LINE-S01020114-INT-B20262'
 * -> { name: 'FORMAS CONSENSUAIS DE SOLUÇÃO DE CONFLITOS', code: 'S01020114-INT-B20262', isOnline: true }
 */
export function splitCourseAndCode(fullCourse: string | null | undefined): ParsedCourse {
  if (!fullCourse) return { name: "-", code: null, isOnline: false }
  const str = fullCourse.trim()
  const isOnline = /\b(?:on-line|online)\b/i.test(str)

  // Padrão de código de turma típico da UniEVANGÉLICA / Moodle:
  // Ex: S01020114-INT-B20262, F24930324-INT-A20262, 095440037-01A20262, D0808T01-EAD-A20252
  const codeMatch = str.match(/(?:[-–—\s]+(?:on-line|online))?[-–—\s]+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)$/i)
                 || str.match(/[-–—\s]+([A-Za-z0-9_]{5,}(?:-[A-Za-z0-9_]+)*)$/)

  if (codeMatch) {
    const code = codeMatch[1].trim()
    let name = str.slice(0, codeMatch.index).trim()
    name = name.replace(/[-–—\s]*(?:on-line|online)[-–—\s]*$/i, "").trim()
    name = name.replace(/[-–—\s]+$/, "").trim()

    return {
      name: name || str,
      code,
      isOnline
    }
  }

  return { name: str, code: null, isOnline }
}

/**
 * Formata telefone com máscara brasileira (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX
 */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
  }
  return phone.trim() || null
}

/**
 * Gera link direto para conversa de WhatsApp
 */
export function getWhatsAppLink(phone: string | null | undefined, studentName: string): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length < 10) return null

  // Adiciona DDI 55 caso não tenha
  const fullPhone = cleaned.startsWith("55") ? cleaned : `55${cleaned}`
  const firstName = studentName ? studentName.trim().split(" ")[0] : "Aluno(a)"
  const text = encodeURIComponent(`Olá, ${firstName}! Sou o seu tutor no AVA da UniEVANGÉLICA e estou acompanhando o seu desenvolvimento nas disciplinas. Como posso te ajudar hoje?`)

  return `https://wa.me/${fullPhone}?text=${text}`
}

/**
 * Mapeamento de URLs base do Moodle por instituição
 */
export const MOODLE_BASE_URLS: Record<string, string> = {
  ead: "https://avaead.unievangelica.edu.br",
  uni: "https://avagrad.unievangelica.edu.br",
  uniego: "https://ava.uniego.edu.br",
  raizes: "https://ava.faculdaderaizes.edu.br",
  eefn: "https://ava.aee.edu.br",
}

export function buildMoodleUrl(institution: string | null | undefined, studentId: string | null | undefined): string | null {
  if (!institution || !studentId) return null
  const base = MOODLE_BASE_URLS[institution.toLowerCase()]
  if (!base) return null
  return `${base}/message/index.php?id=${studentId}`
}

export function buildMoodleProfileUrl(institution: string | null | undefined, studentId: string | null | undefined): string | null {
  if (!institution || !studentId) return null
  const base = MOODLE_BASE_URLS[institution.toLowerCase()]
  if (!base) return null
  return `${base}/user/profile.php?id=${studentId}`
}
