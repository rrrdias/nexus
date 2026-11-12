/**
 * apps/backend/src/mail/mail.config.ts
 * Configurações SMTP para o serviço de mensageria de e-mails (Microsoft 365 / Office 365).
 */

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  defaultFrom: string;
  useTls: boolean;
  useSsl: boolean;
  timeoutSeconds: number;
  retryMaxAttempts: number;
  retryDelaySeconds: number;
  observabilityEnabled: boolean;
  appUrl: string;
}

export function getMailConfig(): MailConfig {
  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || 'sistemas.ted@aee.edu.br';
  const pass = process.env.SMTP_PASS || 'b4<VB93wu2';
  const fromName = process.env.SMTP_FROM_NAME || 'Sistemas TED';
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'sistemas.ted@aee.edu.br';
  const defaultFrom =
    process.env.DEFAULT_FROM_EMAIL || `${fromName} <${fromEmail}>`;
  const useTls = (process.env.EMAIL_USE_TLS || 'true').toLowerCase() === 'true';
  const useSsl =
    (process.env.EMAIL_USE_SSL || 'false').toLowerCase() === 'true';
  const timeoutSeconds = parseInt(process.env.EMAIL_TIMEOUT || '20', 10);
  const retryMaxAttempts = parseInt(
    process.env.EMAIL_RETRY_MAX_ATTEMPTS || '3',
    10,
  );
  const retryDelaySeconds = parseInt(
    process.env.EMAIL_RETRY_DELAY_SECONDS || '5',
    10,
  );
  const observabilityEnabled =
    (process.env.OPERATION_OBSERVABILITY_ENABLED || 'true').toLowerCase() ===
    'true';
  const appUrl = (
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3002'
  ).replace(/\/$/, '');

  return {
    host,
    port,
    user,
    pass,
    fromName,
    fromEmail,
    defaultFrom,
    useTls,
    useSsl,
    timeoutSeconds,
    retryMaxAttempts,
    retryDelaySeconds,
    observabilityEnabled,
    appUrl,
  };
}
