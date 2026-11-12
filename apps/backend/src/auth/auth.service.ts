import {
  Injectable,
  Inject,
  Optional,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users, userGroups, groups, passwordResetTokens } from '../db/schema';
import { eq, or, and, gt, isNull, sql } from 'drizzle-orm';
import { verifyPassword, hashPassword } from '../users/password.util';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private hasEnsuredPasswordResetTable = false;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private jwtService: JwtService,
    @Optional() private readonly mailService?: MailService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensurePasswordResetTable();
  }

  async ensurePasswordResetTable() {
    if (this.hasEnsuredPasswordResetTable) return;
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
          "id" text PRIMARY KEY,
          "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
          "email" text NOT NULL,
          "token" text NOT NULL UNIQUE,
          "expires_at" timestamp with time zone NOT NULL,
          "used_at" timestamp with time zone,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "idx_pwd_reset_token" ON "password_reset_tokens" ("token");
        CREATE INDEX IF NOT EXISTS "idx_pwd_reset_user" ON "password_reset_tokens" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_pwd_reset_email" ON "password_reset_tokens" ("email");
      `);
      this.hasEnsuredPasswordResetTable = true;
    } catch (err: any) {
      console.warn(
        '[AuthService] Erro ao garantir schema de password_reset_tokens:',
        err?.message,
      );
    }
  }

  async login(
    login: string,
    pass: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const ipAddress = context?.ipAddress;
    const userAgent = context?.userAgent;

    const userResult = await this.db
      .select()
      .from(users)
      .where(or(eq(users.email, login), eq(users.userid, login)))
      .limit(1);

    if (userResult.length === 0) {
      await this.auditService?.record({
        userEmail: login,
        action: 'LOGIN_FAILED',
        category: 'AUTH',
        status: 'FAILURE',
        ipAddress,
        userAgent,
        details: 'Usuário não encontrado',
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const user = userResult[0];
    const isMatch = await verifyPassword(pass, user.password as string);
    if (!isMatch) {
      await this.auditService?.record({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        action: 'LOGIN_FAILED',
        category: 'AUTH',
        status: 'FAILURE',
        ipAddress,
        userAgent,
        details: 'Senha incorreta',
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      await this.auditService?.record({
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        action: 'LOGIN_BLOCKED',
        category: 'AUTH',
        status: 'FAILURE',
        ipAddress,
        userAgent,
        details: 'Tentativa de login com conta desativada',
      });
      throw new UnauthorizedException('Usuário inativo');
    }

    const adminGroups = await this.db
      .select()
      .from(userGroups)
      .innerJoin(groups, eq(userGroups.groupId, groups.id))
      .where(eq(userGroups.userId, user.id));

    const isSuperAdmin = adminGroups.some(
      (g) => g.group.name === 'Super Admin',
    );

    const groupNames = adminGroups.map((g) => g.group.name);

    await this.auditService?.record({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: 'LOGIN',
      category: 'AUTH',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      details: {
        isSuperAdmin,
        groups: groupNames,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      isSuperAdmin,
      isDisabled: !user.isActive,
    };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        isSuperAdmin,
        groups: groupNames,
      },
    };
  }

  /**
   * Solicita redefinição de senha com envio de e-mail e token temporário seguro
   */
  async forgotPassword(
    identifier: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensurePasswordResetTable();

    const cleanId = identifier?.trim();
    if (!cleanId) {
      throw new BadRequestException('Informe o usuário ou e-mail cadastrado.');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.email, cleanId), eq(users.userid, cleanId)))
      .limit(1);

    // Se o usuário existir e estiver ativo, geramos e enviamos o token
    if (user && user.isActive) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora de validade

      await this.db.insert(passwordResetTokens).values({
        userId: user.id,
        email: user.email,
        token: resetToken,
        expiresAt,
        createdAt: new Date(),
      });

      if (this.mailService) {
        this.mailService
          .sendPasswordResetEmail(
            user.email,
            user.name || user.userid || 'Usuário',
            resetToken,
          )
          .then((res) => {
            this.auditService?.record({
              userId: user.id,
              userEmail: user.email,
              userName: user.name,
              action: 'PASSWORD_RESET_REQUESTED',
              category: 'AUTH',
              status: res.success ? 'SUCCESS' : 'FAILURE',
              ipAddress: context?.ipAddress,
              userAgent: context?.userAgent,
              details: res.success
                ? 'E-mail de redefinição de senha disparado com sucesso'
                : `Falha no envio SMTP: ${res.error}`,
            });
          })
          .catch((err) => {
            console.error('[AuthService] Erro ao enviar e-mail de recuperação:', err?.message);
          });
      } else {
        await this.auditService?.record({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          action: 'PASSWORD_RESET_REQUESTED',
          category: 'AUTH',
          status: 'SUCCESS',
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
          details: 'Token de redefinição de senha gerado',
        });
      }
    } else {
      await this.auditService?.record({
        userEmail: cleanId,
        action: 'PASSWORD_RESET_REQUESTED_UNKNOWN',
        category: 'AUTH',
        status: 'WARNING',
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        details: 'Tentativa de redefinição para identificador não localizado ou inativo',
      });
    }

    // Mensagem padronizada para prevenir user enumeration
    return {
      success: true,
      message:
        'Se as credenciais estiverem cadastradas, um e-mail com as instruções para redefinição foi enviado.',
    };
  }

  /**
   * Redefine a senha utilizando o token de recuperação
   */
  async resetPassword(
    token: string,
    newPass: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.ensurePasswordResetTable();

    const cleanToken = token?.trim();
    if (!cleanToken) {
      throw new BadRequestException('Token de recuperação não informado.');
    }

    if (!newPass || newPass.trim().length < 6) {
      throw new BadRequestException('A nova senha deve ter no mínimo 6 caracteres.');
    }

    const [resetRecord] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, cleanToken),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!resetRecord) {
      throw new BadRequestException(
        'Este link de redefinição é inválido ou já expirou. Por favor, solicite um novo link.',
      );
    }

    const hashedPassword = await hashPassword(newPass.trim());

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          password: hashedPassword,
        })
        .where(eq(users.id, resetRecord.userId));

      await tx
        .update(passwordResetTokens)
        .set({
          usedAt: new Date(),
        })
        .where(eq(passwordResetTokens.id, resetRecord.id));
    });

    await this.auditService?.record({
      userId: resetRecord.userId,
      userEmail: resetRecord.email,
      action: 'PASSWORD_RESET_COMPLETED',
      category: 'AUTH',
      status: 'SUCCESS',
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      details: 'Senha redefinida com sucesso via token de e-mail',
    });

    return {
      success: true,
      message: 'Senha alterada com sucesso! Você já pode realizar login.',
    };
  }
}
