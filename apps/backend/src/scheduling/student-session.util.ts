import * as crypto from 'crypto';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos em milissegundos

export function getStudentSessionSecret(): string {
  return (
    process.env.STUDENT_SESSION_SECRET ||
    'nexus_student_session_secret_key_2026'
  );
}

export function createStudentSessionToken(
  matricula: string,
  secret = getStudentSessionSecret(),
): string {
  const normMatricula = matricula.trim().toUpperCase();
  const timestamp = Date.now().toString();
  const payload = `${normMatricula}:${timestamp}`;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `${normMatricula}.${timestamp}.${hmac}`;
}

export function verifyStudentSessionToken(
  token: string | undefined | null,
  expectedMatricula?: string,
  secret = getStudentSessionSecret(),
): { valid: boolean; matricula?: string; reason?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token de sessão do estudante não fornecido.' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Formato de token de sessão inválido.' };
  }

  const [matricula, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, reason: 'Timestamp de sessão inválido.' };
  }

  const now = Date.now();
  // Tolerância de 60s para clock skew
  if (timestamp > now + 60000 || now - timestamp > SESSION_TTL_MS) {
    return {
      valid: false,
      reason:
        'Sessão de agendamento expirada (limite de 30 minutos excedido).',
    };
  }

  const expectedPayload = `${matricula.trim().toUpperCase()}:${timestampStr}`;
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(expectedPayload)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedHmac, 'hex');

    if (
      sigBuf.length === 0 ||
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return {
        valid: false,
        reason: 'Assinatura criptográfica de sessão inválida.',
      };
    }
  } catch {
    return {
      valid: false,
      reason: 'Erro ao verificar assinatura criptográfica de sessão.',
    };
  }

  if (
    expectedMatricula &&
    matricula.trim().toUpperCase() !== expectedMatricula.trim().toUpperCase()
  ) {
    return {
      valid: false,
      reason:
        'Matrícula da sessão não coincide com a matrícula informada na requisição.',
    };
  }

  return { valid: true, matricula: matricula.trim().toUpperCase() };
}
