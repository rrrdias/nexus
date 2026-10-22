import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { auditLogs, users } from '../db/schema';
import { sql, desc, and, or, eq, ilike, gte, lte } from 'drizzle-orm';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditQueryDto } from './dto/audit-query.dto';

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
  ) {}

  async onModuleInit() {
    try {
      await this.db.execute(sql`
        ALTER TABLE "audit_log" ALTER COLUMN "userId" DROP NOT NULL;
        ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "userEmail" text;
        ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "userName" text;
        ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'SYSTEM';
        ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'SUCCESS';
        ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "details" text;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginAt" timestamp;
        DO $$ BEGIN
          ALTER TABLE "audit_log" ALTER COLUMN "timestamp" TYPE timestamptz USING "timestamp" AT TIME ZONE 'UTC';
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
        DO $$ BEGIN
          ALTER TABLE "user" ALTER COLUMN "lastLoginAt" TYPE timestamptz USING "lastLoginAt" AT TIME ZONE 'UTC';
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
        CREATE INDEX IF NOT EXISTS "idx_audit_log_category" ON "audit_log" ("category");
        CREATE INDEX IF NOT EXISTS "idx_audit_log_timestamp" ON "audit_log" ("timestamp" DESC);
      `);
      this.logger.log('Tabela audit_log e índices de auditoria validados.');
    } catch (err: any) {
      this.logger.warn(`Aviso ao migrar colunas de audit_log: ${err.message}`);
    }
  }

  /**
   * Grava um registro de auditoria de forma não-bloqueante e resiliente.
   */
  async record(dto: CreateAuditLogDto): Promise<void> {
    try {
      let detailsStr: string | null = null;
      if (dto.details) {
        detailsStr =
          typeof dto.details === 'object'
            ? JSON.stringify(dto.details)
            : String(dto.details);
      }

      await this.db.insert(auditLogs).values({
        userId: dto.userId || null,
        userEmail: dto.userEmail || null,
        userName: dto.userName || null,
        action: dto.action,
        category: dto.category || 'SYSTEM',
        status: dto.status || 'SUCCESS',
        ipAddress: dto.ipAddress || null,
        userAgent: dto.userAgent || null,
        details: detailsStr,
      });

      // Se for login bem-sucedido e tiver userId, atualiza lastLoginAt no usuário
      if (dto.category === 'AUTH' && dto.action === 'LOGIN' && dto.userId) {
        await this.db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, dto.userId))
          .catch((e: any) =>
            this.logger.warn(`Erro ao atualizar lastLoginAt: ${e.message}`),
          );
      }
    } catch (error: any) {
      // Falha na gravação de log nunca deve derrubar o fluxo da aplicação
      this.logger.error(
        `Erro ao gravar log de auditoria [${dto.action}]: ${error.message}`,
      );
    }
  }

  /**
   * Busca registros de auditoria paginados com filtros flexíveis.
   */
  async findAll(query: AuditQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(query.size) || 20));
    const offset = (page - 1) * size;

    const conditions: any[] = [];

    if (query.category && query.category !== 'ALL') {
      conditions.push(eq(auditLogs.category, query.category));
    }

    if (query.status && query.status !== 'ALL') {
      conditions.push(eq(auditLogs.status, query.status));
    }

    if (query.userId) {
      conditions.push(eq(auditLogs.userId, query.userId));
    }

    if (query.startDate) {
      const start = new Date(query.startDate);
      if (!isNaN(start.getTime())) {
        conditions.push(gte(auditLogs.timestamp, start));
      }
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      if (!isNaN(end.getTime())) {
        // Se a data não possui horário específico, ajusta para o final do dia
        if (query.endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        conditions.push(lte(auditLogs.timestamp, end));
      }
    }

    if (query.search) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(auditLogs.action, s),
          ilike(auditLogs.userName, s),
          ilike(auditLogs.userEmail, s),
          ilike(auditLogs.ipAddress, s),
          ilike(auditLogs.details, s),
          ilike(users.name, s),
          ilike(users.email, s),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, logs] = await Promise.all([
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause),
      this.db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userEmail: sql<string>`coalesce(${auditLogs.userEmail}, ${users.email})`,
          userName: sql<string>`coalesce(${auditLogs.userName}, ${users.name})`,
          action: auditLogs.action,
          category: auditLogs.category,
          status: auditLogs.status,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          details: auditLogs.details,
          timestamp: auditLogs.timestamp,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.timestamp))
        .limit(size)
        .offset(offset),
    ]);

    const totalRecords = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / size) || 1;

    return {
      page,
      size,
      total_records: totalRecords,
      total_pages: totalPages,
      data: logs,
    };
  }

  /**
   * Obtém métricas e estatísticas para os cards do topo do painel.
   */
  async getStats() {
    const [statsResult] = await this.db
      .select({
        loginsToday: sql<number>`count(case when ${auditLogs.category} = 'AUTH' and ${auditLogs.action} = 'LOGIN' and ${auditLogs.status} = 'SUCCESS' and ${auditLogs.timestamp} >= CURRENT_DATE then 1 end)::int`,
        loginsFailedToday: sql<number>`count(case when ${auditLogs.category} = 'AUTH' and ${auditLogs.status} = 'FAILURE' and ${auditLogs.timestamp} >= CURRENT_DATE then 1 end)::int`,
        actionsToday: sql<number>`count(case when ${auditLogs.category} != 'AUTH' and ${auditLogs.timestamp} >= CURRENT_DATE then 1 end)::int`,
        uniqueUsersToday: sql<number>`count(distinct case when ${auditLogs.timestamp} >= CURRENT_DATE then coalesce(${auditLogs.userId}, ${auditLogs.userEmail}) end)::int`,
        totalLogsWeek: sql<number>`count(case when ${auditLogs.timestamp} >= CURRENT_DATE - INTERVAL '7 days' then 1 end)::int`,
      })
      .from(auditLogs);

    return {
      loginsToday: statsResult?.loginsToday || 0,
      loginsFailedToday: statsResult?.loginsFailedToday || 0,
      actionsToday: statsResult?.actionsToday || 0,
      uniqueUsersToday: statsResult?.uniqueUsersToday || 0,
      totalLogsWeek: statsResult?.totalLogsWeek || 0,
    };
  }

  /**
   * Exporta logs filtrados em formato estruturado para geração de CSV.
   */
  async exportData(query: AuditQueryDto) {
    const queryResult = await this.findAll({
      ...query,
      page: 1,
      size: 5000, // Limite de segurança para exportação
    });

    return queryResult.data.map((l) => ({
      Data: l.timestamp
        ? new Date(l.timestamp).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
          })
        : '-',
      Usuario: l.userName || 'Sistema / Anônimo',
      Email: l.userEmail || '-',
      Categoria: l.category,
      Acao: l.action,
      Status: l.status,
      IP: l.ipAddress || '-',
      Dispositivo: l.userAgent || '-',
      Detalhes: l.details || '',
    }));
  }
}
