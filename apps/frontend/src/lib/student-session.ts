const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutos

export function getStudentSessionSecret(): string {
  return (
    process.env.STUDENT_SESSION_SECRET ||
    "nexus_student_session_secret_key_2026"
  )
}

const encoder = new TextEncoder()

async function computeHmacHex(secret: string, message: string): Promise<string> {
  const cryptoObj = globalThis.crypto
  const keyData = encoder.encode(secret)
  const cryptoKey = await cryptoObj.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await cryptoObj.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message)
  )
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function verifyHmacHex(
  secret: string,
  message: string,
  hexSignature: string
): Promise<boolean> {
  try {
    const cryptoObj = globalThis.crypto
    const keyData = encoder.encode(secret)
    const cryptoKey = await cryptoObj.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
    const bytes = hexSignature.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []
    const sigBuf = new Uint8Array(bytes)
    return await cryptoObj.subtle.verify(
      "HMAC",
      cryptoKey,
      sigBuf,
      encoder.encode(message)
    )
  } catch {
    return false
  }
}

export async function createStudentSessionToken(
  matricula: string,
  secret = getStudentSessionSecret()
): Promise<string> {
  const normMatricula = matricula.trim().toUpperCase()
  const timestamp = Date.now().toString()
  const payload = `${normMatricula}:${timestamp}`
  const hmac = await computeHmacHex(secret, payload)
  return `${normMatricula}.${timestamp}.${hmac}`
}

export async function verifyStudentSessionToken(
  token: string | undefined | null,
  expectedMatricula?: string,
  secret = getStudentSessionSecret()
): Promise<{ valid: boolean; matricula?: string; reason?: string }> {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Token não fornecido." }
  }

  const parts = token.trim().split(".")
  if (parts.length !== 3) {
    return { valid: false, reason: "Formato de token inválido." }
  }

  const [matricula, timestampStr, signature] = parts
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return { valid: false, reason: "Timestamp inválido." }
  }

  const now = Date.now()
  if (timestamp > now + 60000 || now - timestamp > SESSION_TTL_MS) {
    return {
      valid: false,
      reason: "Sessão expirada (limite de 30 minutos excedido).",
    }
  }

  const payload = `${matricula.trim().toUpperCase()}:${timestampStr}`
  const isMatch = await verifyHmacHex(secret, payload, signature)
  if (!isMatch) {
    return { valid: false, reason: "Assinatura inválida." }
  }

  if (
    expectedMatricula &&
    matricula.trim().toUpperCase() !== expectedMatricula.trim().toUpperCase()
  ) {
    return {
      valid: false,
      reason: "Matrícula não coincide com a sessão ativa.",
    }
  }

  return { valid: true, matricula: matricula.trim().toUpperCase() }
}
