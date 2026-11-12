/**
 * apps/backend/src/mail/mail.service.ts
 * Serviço corporativo de envio de e-mails via Microsoft 365 (Office 365) com retry e observabilidade.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { getMailConfig, MailConfig } from './mail.config';
import {
  getPasswordResetTemplate,
  getWelcomeUserTemplate,
  getSchedulingConfirmationTemplate,
  getTutoriaOrientationTemplate,
  SchedulingConfirmationParams,
  TutoriaOrientationParams,
} from './mail-templates';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface MailSendResult {
  success: boolean;
  messageId?: string;
  attempts: number;
  error?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly config: MailConfig;

  constructor() {
    this.config = getMailConfig();
  }

  async onModuleInit() {
    this.initTransporter();
  }

  private initTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.useSsl, // false para 587 (STARTTLS)
        requireTLS: this.config.useTls,
        auth: {
          user: this.config.user,
          pass: this.config.pass,
        },
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: false,
        },
        connectionTimeout: Math.min(this.config.timeoutSeconds, 8) * 1000,
        greetingTimeout: Math.min(this.config.timeoutSeconds, 8) * 1000,
        socketTimeout: this.config.timeoutSeconds * 1000,
      });

      if (this.config.observabilityEnabled) {
        this.logger.log(
          `Serviço de e-mail inicializado para host=${this.config.host}:${this.config.port} via ${this.config.user}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Falha ao instanciar transportador SMTP: ${err.message}`, err.stack);
    }
  }

  /**
   * Envio genérico de e-mail com retry automático configurável e observabilidade
   */
  async sendMail(options: SendMailOptions): Promise<MailSendResult> {
    if (!this.transporter) {
      this.initTransporter();
    }

    if (!this.transporter) {
      return {
        success: false,
        attempts: 0,
        error: 'Transporter SMTP não inicializado.',
      };
    }

    const maxAttempts = Math.max(1, this.config.retryMaxAttempts);
    const delayMs = Math.max(1, this.config.retryDelaySeconds) * 1000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (this.config.observabilityEnabled) {
          this.logger.log(
            `[Tentativa ${attempt}/${maxAttempts}] Enviando e-mail "${options.subject}" para ${options.to}`,
          );
        }

        const info = await this.transporter.sendMail({
          from: this.config.defaultFrom,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
          cc: options.cc,
          bcc: options.bcc,
        });

        if (this.config.observabilityEnabled) {
          this.logger.log(
            `E-mail enviado com sucesso para ${options.to} (MessageId: ${info.messageId}) na tentativa ${attempt}`,
          );
        }

        return {
          success: true,
          messageId: info.messageId,
          attempts: attempt,
        };
      } catch (err: any) {
        lastError = err;
        this.logger.warn(
          `Falha ao enviar e-mail para ${options.to} na tentativa ${attempt}/${maxAttempts}: ${err.message}`,
        );

        if (attempt < maxAttempts) {
          await new Promise((res) => setTimeout(res, delayMs));
        }
      }
    }

    this.logger.error(
      `Todas as ${maxAttempts} tentativas de envio de e-mail para ${options.to} falharam. Último erro: ${lastError?.message}`,
    );

    return {
      success: false,
      attempts: maxAttempts,
      error: lastError?.message || 'Falha ao conectar com servidor SMTP.',
    };
  }

  /**
   * Resolve a URL base pública do portal (prioriza domínio/IP real do cliente quando APP_URL for localhost)
   */
  private resolvePublicBaseUrl(originUrl?: string): string {
    const configured = (this.config.appUrl || '').trim().replace(/\/+$/, '');
    const isConfiguredLocalhost =
      !configured ||
      configured.includes('localhost') ||
      configured.includes('127.0.0.1');

    let chosen = configured || 'http://localhost:3002';
    if (isConfiguredLocalhost && originUrl && /^https?:\/\//i.test(originUrl.trim())) {
      chosen = originUrl.trim().replace(/\/+$/, '');
    }

    return chosen.endsWith('/nexus') ? chosen : `${chosen}/nexus`;
  }

  /**
   * 1. Enviar E-mail de Recuperação de Senha
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
    originUrl?: string,
  ): Promise<MailSendResult> {
    const baseUrl = this.resolvePublicBaseUrl(originUrl);
    const resetUrl = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = getPasswordResetTemplate(name, resetUrl);
    const result = await this.sendMail({ to, subject, html, text });
    if (!result.success && process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        `[DEV FALLBACK] Porta SMTP bloqueada/indisponível na rede local. Link de redefinição para ${to}: ${resetUrl}`,
      );
    }
    return result;
  }

  /**
   * 2. Enviar E-mail de Boas-Vindas para Novo Usuário Cadastrado
   */
  async sendWelcomeEmail(
    to: string,
    name: string,
    login: string,
    temporaryPassword?: string,
    originUrl?: string,
  ): Promise<MailSendResult> {
    const baseUrl = this.resolvePublicBaseUrl(originUrl);
    const accessUrl = `${baseUrl}/login`;
    const { subject, html, text } = getWelcomeUserTemplate(
      name,
      login,
      accessUrl,
      temporaryPassword,
    );
    return this.sendMail({ to, subject, html, text });
  }

  /**
   * 3. Enviar E-mail de Confirmação de Agendamento de Prova Presencial
   */
  async sendSchedulingConfirmation(
    to: string,
    params: SchedulingConfirmationParams,
  ): Promise<MailSendResult> {
    const { subject, html, text } = getSchedulingConfirmationTemplate(params);
    return this.sendMail({ to, subject, html, text });
  }

  /**
   * 4. Enviar E-mail de Orientação Pedagógica da Tutoria
   */
  async sendTutoriaOrientation(
    to: string,
    params: TutoriaOrientationParams,
  ): Promise<MailSendResult> {
    const { subject, html, text } = getTutoriaOrientationTemplate(params);
    return this.sendMail({ to, subject, html, text });
  }
}
