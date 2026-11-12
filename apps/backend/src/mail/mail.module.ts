/**
 * apps/backend/src/mail/mail.module.ts
 * Módulo Global de Envio de E-mails do NexusHub.
 */

import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
