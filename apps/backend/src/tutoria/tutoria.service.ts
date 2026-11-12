import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CacheService } from '../cache/cache.service';
import { TutoriaSyncService } from './tutoria-sync.service';
import { EngagementFilterDto } from './dto/engagement-filter.dto';
import { KanbanFilterDto } from './dto/kanban-filter.dto';
import { CreateKanbanCardDto } from './dto/create-kanban-card.dto';
import { UpdateKanbanCardDto } from './dto/update-kanban-card.dto';
import { CreateIntervencaoDto } from './dto/create-intervencao.dto';
import { TransferirTutorDto } from './dto/transferir-tutor.dto';
import { SendTutoriaEmailDto } from './dto/send-tutoria-email.dto';
import { MailService } from '../mail/mail.service';

export {
  EngagementFilterDto,
  KanbanFilterDto,
  CreateKanbanCardDto,
  UpdateKanbanCardDto,
  CreateIntervencaoDto,
  TransferirTutorDto,
  SendTutoriaEmailDto,
};

@Injectable()
export class TutoriaService implements OnModuleInit {
  private hasEnsuredKanbanTable = false;
  private hasEnsuredTimelineTable = false;
  private tutorInfoCache = new Map<
    string,
    { name: string; email: string | null; timestamp: number }
  >();
  private static readonly TUTOR_CACHE_TTL_MS = 60_000;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private readonly syncService: TutoriaSyncService,
    @Optional() private readonly cacheService?: CacheService,
    @Optional() private readonly mailService?: MailService,
  ) {}

  async resolveTutorInfo(
    userId?: string,
  ): Promise<{ id: string | null; name: string; email: string | null }> {
    if (!userId) {
      return { id: null, name: 'Tutor Atuante', email: null };
    }

    const now = Date.now();
    const cached = this.tutorInfoCache.get(userId);
    if (cached && now - cached.timestamp < TutoriaService.TUTOR_CACHE_TTL_MS) {
      return { id: userId, name: cached.name, email: cached.email };
    }

    try {
      const rows = (await this.db.execute(sql`
        SELECT id, name, email
        FROM "user"
        WHERE id = ${userId}
        LIMIT 1;
      `)) as any[];

      if (rows && rows.length > 0) {
        const info = {
          name: String(rows[0].name || rows[0].email || 'Tutor Atuante'),
          email: rows[0].email ? String(rows[0].email) : null,
          timestamp: now,
        };
        this.tutorInfoCache.set(userId, info);
        return { id: userId, name: info.name, email: info.email };
      }
    } catch (err: any) {
      console.warn(
        '[TutoriaService] Erro ao resolver info do tutor:',
        err?.message,
      );
    }
    return { id: userId, name: 'Tutor Atuante', email: null };
  }

  async onModuleInit() {
    await this.ensureKanbanTable();
    await this.ensureTimelineTable();
  }

  // Garante que a tabela e todas as colunas necessárias existam no banco de dados
  async ensureKanbanTable() {
    if (this.hasEnsuredKanbanTable) return;
    try {
      if (!this.db || typeof this.db.execute !== 'function') {
        return;
      }

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS tutoria_atendimentos_kanban (
          id text PRIMARY KEY DEFAULT gen_random_uuid(),
          plano_acao_id text,
          "sourceInstitution" text DEFAULT 'ead' NOT NULL,
          periodo text NOT NULL,
          matricula text NOT NULL,
          aluno_nome text,
          aluno_email text,
          disciplina_codigo text,
          disciplina_nome text,
          status_kanban text DEFAULT 'pendente' NOT NULL,
          tutor_responsavel_id text,
          observacoes text,
          canal_contato_utilizado text,
          ultimo_contato_em timestamp with time zone,
          data_resolucao timestamp with time zone,
          "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
          "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);

      await this.db.execute(sql`
        ALTER TABLE tutoria_atendimentos_kanban
        ADD COLUMN IF NOT EXISTS aluno_nome text,
        ADD COLUMN IF NOT EXISTS aluno_email text,
        ADD COLUMN IF NOT EXISTS disciplina_codigo text,
        ADD COLUMN IF NOT EXISTS disciplina_nome text,
        ADD COLUMN IF NOT EXISTS canal_contato_utilizado text,
        ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamp with time zone,
        ADD COLUMN IF NOT EXISTS data_resolucao timestamp with time zone,
        ADD COLUMN IF NOT EXISTS plano_acao_id text,
        ADD COLUMN IF NOT EXISTS tutor_responsavel_id text,
        ADD COLUMN IF NOT EXISTS tutor_iniciador_id text,
        ADD COLUMN IF NOT EXISTS ultima_intervencao_em timestamp with time zone,
        ADD COLUMN IF NOT EXISTS qtd_intervencoes integer DEFAULT 0;
      `);

      this.hasEnsuredKanbanTable = true;
    } catch (err: any) {
      console.warn(
        '[TutoriaService] Erro ao garantir schema do Kanban:',
        err?.message,
      );
    }
  }

  // Garante que a tabela de histórico (timeline) de atendimentos e índices existam no banco de dados
  async ensureTimelineTable() {
    if (this.hasEnsuredTimelineTable) return;
    try {
      if (!this.db || typeof this.db.execute !== 'function') {
        return;
      }

      // 1. Garante primeiro a tabela do Kanban antes de estabelecer relacionamentos
      await this.ensureKanbanTable();

      // 2. Cria a tabela tutoria_atendimentos_historico
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS tutoria_atendimentos_historico (
          id text PRIMARY KEY DEFAULT gen_random_uuid(),
          atendimento_id text REFERENCES tutoria_atendimentos_kanban(id) ON DELETE CASCADE,
          matricula text NOT NULL,
          periodo text NOT NULL,
          "sourceInstitution" text DEFAULT 'ead' NOT NULL,
          tipo_evento text NOT NULL,
          autor_id text REFERENCES "user"(id) ON DELETE SET NULL,
          autor_nome text,
          tutor_responsavel_anterior_id text REFERENCES "user"(id) ON DELETE SET NULL,
          tutor_responsavel_novo_id text REFERENCES "user"(id) ON DELETE SET NULL,
          estado_anterior text,
          estado_novo text,
          canal_contato text,
          observacoes text,
          metadata text,
          "createdAt" timestamp with time zone DEFAULT now() NOT NULL
        );
      `);

      // 3. Garante colunas de suporte multi-tutor no Kanban
      await this.db.execute(sql`
        ALTER TABLE tutoria_atendimentos_kanban
        ADD COLUMN IF NOT EXISTS tutor_iniciador_id text REFERENCES "user"(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS ultima_intervencao_em timestamp with time zone,
        ADD COLUMN IF NOT EXISTS qtd_intervencoes integer DEFAULT 0 NOT NULL;
      `);

      // 4. Garante colunas da tabela de histórico caso tenha sido criada em versão anterior
      await this.db.execute(sql`
        ALTER TABLE tutoria_atendimentos_historico
        ADD COLUMN IF NOT EXISTS atendimento_id text REFERENCES tutoria_atendimentos_kanban(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS matricula text,
        ADD COLUMN IF NOT EXISTS periodo text,
        ADD COLUMN IF NOT EXISTS "sourceInstitution" text DEFAULT 'ead',
        ADD COLUMN IF NOT EXISTS tipo_evento text,
        ADD COLUMN IF NOT EXISTS autor_id text REFERENCES "user"(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS autor_nome text,
        ADD COLUMN IF NOT EXISTS tutor_responsavel_anterior_id text REFERENCES "user"(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS tutor_responsavel_novo_id text REFERENCES "user"(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS estado_anterior text,
        ADD COLUMN IF NOT EXISTS estado_novo text,
        ADD COLUMN IF NOT EXISTS canal_contato text,
        ADD COLUMN IF NOT EXISTS observacoes text,
        ADD COLUMN IF NOT EXISTS metadata text,
        ADD COLUMN IF NOT EXISTS "createdAt" timestamp with time zone DEFAULT now();
      `);

      // 5. Cria índices para otimização de busca na linha do tempo e auditoria
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_atendimento ON tutoria_atendimentos_historico (atendimento_id);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_matricula ON tutoria_atendimentos_historico (matricula);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_created_at ON tutoria_atendimentos_historico ("createdAt");
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_tipo ON tutoria_atendimentos_historico (tipo_evento);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_autor ON tutoria_atendimentos_historico (autor_id);
        CREATE INDEX IF NOT EXISTS idx_tutoria_hist_mat_created ON tutoria_atendimentos_historico (matricula, "createdAt" DESC);
        CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_tutor_iniciador ON tutoria_atendimentos_kanban (tutor_iniciador_id);
        CREATE INDEX IF NOT EXISTS idx_tutoria_kanban_ultima_interv ON tutoria_atendimentos_kanban (ultima_intervencao_em);
      `);

      this.hasEnsuredTimelineTable = true;
    } catch (err: any) {
      console.warn(
        '[TutoriaService] Erro ao garantir schema de Histórico/Timeline:',
        err?.message,
      );
    }
  }

  // 1. Resumo executivo para cards do topo do Dashboard
  async getDashboardSummary(periodo = '2026-2', institution = 'ead') {
    const cacheKey = `tutoria:summary:${institution}:${periodo}`;
    if (this.cacheService) {
      const cached = await this.cacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    const res = await this.db.execute(sql`
      SELECT
        COUNT(*)::int AS total_alunos_disciplinas,
        COUNT(DISTINCT matricula)::int AS total_alunos_unicos,
        COUNT(DISTINCT disciplina_id)::int AS total_disciplinas,
        COUNT(CASE WHEN grupo_risco_calculado = 'critico' THEN 1 END)::int AS total_critico,
        COUNT(CASE WHEN grupo_risco_calculado = 'atencao' THEN 1 END)::int AS total_atencao,
        COUNT(CASE WHEN grupo_risco_calculado = 'autonomo' THEN 1 END)::int AS total_autonomo,
        ROUND(AVG(COALESCE(tempo_total_minutos::numeric, 0)), 1)::float AS media_tempo_minutos,
        ROUND(AVG(COALESCE(score_engajamento::numeric, 0)), 1)::float AS media_score_engajamento
      FROM tutoria_engajamento_aluno
      WHERE "sourceInstitution" = ${institution}
        AND periodo = ${periodo};
    `);

    const summary = res[0] || {
      total_alunos_disciplinas: 0,
      total_alunos_unicos: 0,
      total_disciplinas: 0,
      total_critico: 0,
      total_atencao: 0,
      total_autonomo: 0,
      media_tempo_minutos: 0,
      media_score_engajamento: 0,
    };

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, summary, 300); // 5 min TTL
    }

    return summary;
  }

  // Helper para montagem unificada de filtros de engajamento
  private buildEngagementConditions(filters: EngagementFilterDto) {
    const conditions: any[] = [];
    if (filters.periodo) {
      conditions.push(sql`e.periodo = ${filters.periodo}`);
    } else {
      conditions.push(sql`e.periodo = '2026-2'`);
    }

    if (filters.disciplinaCodigo) {
      conditions.push(sql`e.disciplina_codigo = ${filters.disciplinaCodigo}`);
    }

    if (filters.disciplinaId) {
      conditions.push(sql`e.disciplina_id = ${filters.disciplinaId}`);
    }

    if (filters.grupoRisco) {
      conditions.push(sql`e.grupo_risco_calculado = ${filters.grupoRisco}`);
    }

    if (filters.faixaTempo) {
      if (filters.faixaTempo === 'ate_30') {
        conditions.push(sql`COALESCE(e.tempo_total_minutos::numeric, 0) <= 30`);
      } else if (
        filters.faixaTempo === 'ate_60' ||
        filters.faixaTempo === '30_a_60'
      ) {
        conditions.push(
          sql`COALESCE(e.tempo_total_minutos::numeric, 0) > 30 AND COALESCE(e.tempo_total_minutos::numeric, 0) <= 60`,
        );
      } else if (filters.faixaTempo === 'mais_60') {
        conditions.push(sql`COALESCE(e.tempo_total_minutos::numeric, 0) > 60`);
      }
    }

    if (filters.recenciaAcesso && filters.recenciaAcesso !== 'todos') {
      if (filters.recenciaAcesso === 'mais_7_dias') {
        conditions.push(
          sql`(e.data_ultimo_acesso IS NULL OR e.data_ultimo_acesso = '0' OR e.data_ultimo_acesso LIKE '1970%' OR e.data_ultimo_acesso::timestamp < (NOW() - INTERVAL '7 days'))`,
        );
      } else if (filters.recenciaAcesso === 'mais_14_dias') {
        conditions.push(
          sql`(e.data_ultimo_acesso IS NULL OR e.data_ultimo_acesso = '0' OR e.data_ultimo_acesso LIKE '1970%' OR e.data_ultimo_acesso::timestamp < (NOW() - INTERVAL '14 days'))`,
        );
      } else if (filters.recenciaAcesso === 'mais_30_dias') {
        conditions.push(
          sql`(e.data_ultimo_acesso IS NULL OR e.data_ultimo_acesso = '0' OR e.data_ultimo_acesso LIKE '1970%' OR e.data_ultimo_acesso::timestamp < (NOW() - INTERVAL '30 days'))`,
        );
      } else if (filters.recenciaAcesso === 'sem_acesso') {
        conditions.push(
          sql`(e.data_ultimo_acesso IS NULL OR e.data_ultimo_acesso = '0' OR e.data_ultimo_acesso LIKE '1970%')`,
        );
      }
    }

    if (filters.statusKanban && filters.statusKanban !== 'todos') {
      if (filters.statusKanban === 'sem_atendimento') {
        conditions.push(sql`k.status_kanban IS NULL`);
      } else {
        conditions.push(sql`k.status_kanban = ${filters.statusKanban}`);
      }
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        sql`(e.aluno_nome ILIKE ${term} OR e.matricula ILIKE ${term} OR e.aluno_email ILIKE ${term} OR e.disciplina_nome ILIKE ${term})`,
      );
    }

    return conditions;
  }

  // 2. Lista paginada de engajamento dos alunos com filtros avançados
  async getEngagementList(filters: EngagementFilterDto) {
    await this.ensureKanbanTable();

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = this.buildEngagementConditions(filters);
    const whereClause = sql.join(conditions, sql` AND `);

    const [totalRes, items] = await Promise.all([
      this.db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM tutoria_engajamento_aluno e
        LEFT JOIN tutoria_atendimentos_kanban k
          ON k.matricula = e.matricula
          AND k.periodo = e.periodo
          AND k."sourceInstitution" = e."sourceInstitution"
          AND (k.disciplina_codigo = e.disciplina_codigo OR k.disciplina_codigo IS NULL)
        WHERE ${whereClause};
      `),
      this.db.execute(sql`
        SELECT
          e.id,
          e."sourceInstitution",
          e.periodo,
          e.disciplina_id,
          e.disciplina_codigo,
          e.disciplina_nome,
          e.aluno_id,
          e.matricula,
          e.aluno_nome,
          e.aluno_email,
          e.tempo_total_minutos,
          e.tempo_fase1_minutos,
          e.tempo_fase2_minutos,
          e.tempo_fase3_minutos,
          e.tempo_apresentacao_minutos,
          e.total_cliques,
          e.total_atividades_acessadas,
          e.tempo_leitura_minutos,
          e.tempo_avaliacoes_minutos,
          e.grupo_risco_calculado,
          e.score_engajamento,
          e.data_ultimo_acesso,
          e.data_ultimo_login,
          e."updatedAt",
          k.id AS kanban_card_id,
          k.status_kanban,
          k.canal_contato_utilizado AS kanban_canal,
          k.ultimo_contato_em AS kanban_ultimo_contato,
          k.observacoes AS kanban_observacoes,
          k.data_resolucao AS kanban_data_resolucao,
          u.name AS kanban_tutor_nome
        FROM tutoria_engajamento_aluno e
        LEFT JOIN tutoria_atendimentos_kanban k
          ON k.matricula = e.matricula
          AND k.periodo = e.periodo
          AND k."sourceInstitution" = e."sourceInstitution"
          AND (k.disciplina_codigo = e.disciplina_codigo OR k.disciplina_codigo IS NULL)
        LEFT JOIN "user" u ON u.id = k.tutor_responsavel_id
        WHERE ${whereClause}
        ORDER BY
          CASE WHEN e.grupo_risco_calculado = 'critico' THEN 1
               WHEN e.grupo_risco_calculado = 'atencao' THEN 2
               ELSE 3 END ASC,
          COALESCE(e.tempo_total_minutos::numeric, 0) ASC
        LIMIT ${limit} OFFSET ${offset};
      `),
    ]);

    const total = Number(totalRes[0]?.total || 0);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 2.1. Lista de disciplinas distintas do período para o seletor
  async getDisciplinas(periodo = '2026-2', institution = 'ead') {
    const cacheKey = `tutoria:disciplinas:${institution}:${periodo}`;
    if (this.cacheService) {
      return this.cacheService.wrap(
        cacheKey,
        async () => {
          return this.db.execute(sql`
            SELECT DISTINCT
              disciplina_id,
              disciplina_codigo,
              disciplina_nome
            FROM tutoria_engajamento_aluno
            WHERE "sourceInstitution" = ${institution} AND periodo = ${periodo}
            ORDER BY disciplina_nome ASC;
          `);
        },
        300,
      );
    }

    return this.db.execute(sql`
      SELECT DISTINCT
        disciplina_id,
        disciplina_codigo,
        disciplina_nome
      FROM tutoria_engajamento_aluno
      WHERE "sourceInstitution" = ${institution} AND periodo = ${periodo}
      ORDER BY disciplina_nome ASC;
    `);
  }

  // 2.2. Exportação completa dos dados filtrados para Excel/CSV
  async getExportData(filters: EngagementFilterDto) {
    const conditions = this.buildEngagementConditions(filters);
    const whereClause = sql.join(conditions, sql` AND `);

    return this.db.execute(sql`
      SELECT
        id,
        "sourceInstitution",
        periodo,
        disciplina_id,
        disciplina_codigo,
        disciplina_nome,
        aluno_id,
        matricula,
        aluno_nome,
        aluno_email,
        tempo_total_minutos,
        tempo_fase1_minutos,
        tempo_fase2_minutos,
        tempo_fase3_minutos,
        tempo_apresentacao_minutos,
        total_cliques,
        total_atividades_acessadas,
        tempo_leitura_minutos,
        tempo_avaliacoes_minutos,
        grupo_risco_calculado,
        score_engajamento,
        data_ultimo_acesso,
        data_ultimo_login,
        "updatedAt"
      FROM tutoria_engajamento_aluno
      WHERE ${whereClause}
      ORDER BY
        CASE WHEN grupo_risco_calculado = 'critico' THEN 1
             WHEN grupo_risco_calculado = 'atencao' THEN 2
             ELSE 3 END ASC,
        COALESCE(tempo_total_minutos::numeric, 0) ASC
      LIMIT 5000;
    `);
  }

  // 3. Raio-X detalhado de atividades do aluno + contato discente + cartão kanban
  async getStudentActivityLogs(matricula: string, disciplinaId?: string) {
    const conditions = [sql`l.matricula = ${matricula}`];
    if (disciplinaId) {
      conditions.push(sql`l.disciplina_id = ${disciplinaId}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const [logs, discenteRows, kanbanRows] = await Promise.all([
      this.db.execute(sql`
        SELECT
          l.id,
          l.periodo,
          l.disciplina_id,
          l.disciplina_codigo,
          l.disciplina_nome,
          l.unidade_tematica_nome,
          l.atividade_id,
          l.tipo_modulo,
          l.conteudo_nome,
          l.qtd_cliques_acessos,
          l.tempo_conteudo_minutos,
          l.data_primeiro_acesso_conteudo,
          l.data_ultimo_acesso_conteudo,
          l.data_ultimo_acesso_disciplina,
          l.data_ultimo_login,
          l."updatedAt"
        FROM tutoria_logs_atividades l
        WHERE ${whereClause}
        ORDER BY
          CASE 
            WHEN l.unidade_tematica_nome ILIKE 'Fase 1%' THEN 1
            WHEN l.unidade_tematica_nome ILIKE 'Fase 2%' THEN 2
            WHEN l.unidade_tematica_nome ILIKE 'Fase 3%' THEN 3
            WHEN l.unidade_tematica_nome ILIKE '%Apresenta%' THEN 0
            ELSE 4
          END ASC,
          COALESCE(l.tempo_conteudo_minutos::numeric, 0) DESC;
      `),
      this.db
        .execute(
          sql`
        SELECT telefone, email, curso_nome, unidade_fisica
        FROM academic_discente
        WHERE matricula = ${matricula}
        LIMIT 1;
      `,
        )
        .catch(() => []),
      this.db
        .execute(
          sql`
        SELECT
          k.id,
          k.status_kanban,
          k.tutor_responsavel_id,
          u.name AS tutor_nome,
          k.observacoes,
          k.canal_contato_utilizado,
          k.ultimo_contato_em,
          k.data_resolucao,
          k."updatedAt"
        FROM tutoria_atendimentos_kanban k
        LEFT JOIN "user" u ON u.id = k.tutor_responsavel_id
        WHERE k.matricula = ${matricula}
        ORDER BY k."updatedAt" DESC
        LIMIT 1;
      `,
        )
        .catch(() => []),
    ]);

    return {
      logs,
      discente: discenteRows[0] || null,
      kanban: kanbanRows[0] || null,
    };
  }

  // Busca inteligente de dados acadêmicos e disciplinas do discente pela matrícula
  async lookupStudentByMatricula(
    matricula: string,
    periodo = '2026-2',
    institution = 'ead',
  ) {
    if (!matricula || !matricula.trim()) {
      return { found: false, message: 'Matrícula não informada.' };
    }

    const cleanMatricula = matricula.trim();

    const [discenteRows, engRows] = await Promise.all([
      this.db
        .execute(
          sql`
        SELECT nome, email, telefone, curso_nome, unidade_fisica
        FROM academic_discente
        WHERE matricula = ${cleanMatricula} OR id::text = ${cleanMatricula}
        LIMIT 1;
      `,
        )
        .catch(() => []),
      this.db
        .execute(
          sql`
        SELECT 
          disciplina_codigo, 
          disciplina_nome, 
          grupo_risco_calculado, 
          tempo_total_minutos,
          aluno_nome,
          aluno_email,
          data_ultimo_acesso
        FROM tutoria_engajamento_aluno
        WHERE matricula = ${cleanMatricula}
          AND "sourceInstitution" = ${institution}
          AND periodo = ${periodo}
        ORDER BY 
          CASE 
            WHEN grupo_risco_calculado = 'critico' THEN 1
            WHEN grupo_risco_calculado = 'atencao' THEN 2
            WHEN grupo_risco_calculado = 'procrastinacao' THEN 3
            ELSE 4
          END ASC;
      `,
        )
        .catch(() => []),
    ]);

    const disc = discenteRows[0] || {};
    const firstEng = engRows[0] || {};

    const nome =
      (disc.nome as string) || (firstEng.aluno_nome as string) || null;
    const email =
      (disc.email as string) || (firstEng.aluno_email as string) || null;
    const telefone = (disc.telefone as string) || null;
    const cursoNome = (disc.curso_nome as string) || null;
    const unidadeFisica = (disc.unidade_fisica as string) || 'EAD';

    const disciplinas = engRows.map((r: any) => ({
      codigo: r.disciplina_codigo as string,
      nome: r.disciplina_nome as string,
      grupoRisco: r.grupo_risco_calculado as string,
      tempoMinutos: r.tempo_total_minutos,
      ultimoAcesso: r.data_ultimo_acesso as string,
    }));

    const found = !!(nome || disciplinas.length > 0);

    return {
      found,
      matricula: cleanMatricula,
      nome: nome || '',
      email: email || '',
      telefone: telefone || '',
      cursoNome: cursoNome || '',
      unidadeFisica: unidadeFisica || 'EAD',
      disciplinas,
    };
  }

  // 4. Disparo manual de sincronização
  async triggerManualSync(institution = 'ead') {
    return this.syncService.syncTutoriaLogs(institution);
  }

  // 5. Status da sincronização
  getSyncStatus() {
    return this.syncService.getSyncStatus();
  }

  // 6. Listagem de Cartões do Kanban de Atendimentos
  async getKanbanCards(filters: KanbanFilterDto) {
    await this.ensureKanbanTable();

    const periodo = filters.periodo || '2026-2';
    const institution = filters.institution || 'ead';

    const conditions = [
      sql`k.periodo = ${periodo}`,
      sql`k."sourceInstitution" = ${institution}`,
    ];

    if (filters.disciplinaCodigo && filters.disciplinaCodigo !== 'todas') {
      conditions.push(sql`k.disciplina_codigo = ${filters.disciplinaCodigo}`);
    }

    if (filters.statusKanban && filters.statusKanban !== 'todos') {
      conditions.push(sql`k.status_kanban = ${filters.statusKanban}`);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        sql`(k.aluno_nome ILIKE ${term} OR k.matricula ILIKE ${term} OR k.disciplina_nome ILIKE ${term})`,
      );
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const cards = await this.db.execute(sql`
      SELECT DISTINCT ON (k.id)
        k.id,
        k.periodo,
        k."sourceInstitution",
        k.matricula,
        k.aluno_nome,
        k.aluno_email,
        k.disciplina_codigo,
        k.disciplina_nome,
        k.status_kanban,
        k.tutor_responsavel_id,
        u.name AS tutor_nome,
        k.observacoes,
        k.canal_contato_utilizado,
        k.ultimo_contato_em,
        k.data_resolucao,
        k."createdAt",
        k."updatedAt",
        d.telefone,
        d.curso_nome,
        d.unidade_fisica,
        COALESCE(e.grupo_risco_calculado, 'critico') AS grupo_risco_calculado,
        COALESCE(e.tempo_total_minutos, '0') AS tempo_total_minutos,
        e.data_ultimo_acesso
      FROM tutoria_atendimentos_kanban k
      LEFT JOIN "user" u ON u.id = k.tutor_responsavel_id
      LEFT JOIN academic_discente d ON d.matricula = k.matricula
      LEFT JOIN LATERAL (
        SELECT grupo_risco_calculado, tempo_total_minutos, data_ultimo_acesso
        FROM tutoria_engajamento_aluno
        WHERE matricula = k.matricula 
          AND periodo = k.periodo 
          AND (disciplina_codigo = k.disciplina_codigo OR k.disciplina_codigo IS NULL)
        ORDER BY
          CASE WHEN grupo_risco_calculado = 'critico' THEN 1
               WHEN grupo_risco_calculado = 'atencao' THEN 2
               ELSE 3 END ASC
        LIMIT 1
      ) e ON true
      WHERE ${whereClause}
      ORDER BY k.id, k."updatedAt" DESC;
    `);

    // Ordena pelo updatedAt decrescente
    cards.sort(
      (a: any, b: any) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    const summary = {
      total: cards.length,
      pendente: cards.filter((c: any) => c.status_kanban === 'pendente').length,
      em_contato: cards.filter((c: any) => c.status_kanban === 'em_contato')
        .length,
      em_recuperacao: cards.filter(
        (c: any) => c.status_kanban === 'em_recuperacao',
      ).length,
      revertido: cards.filter((c: any) => c.status_kanban === 'revertido')
        .length,
      evadido: cards.filter((c: any) => c.status_kanban === 'evadido').length,
      critico: cards.filter((c: any) => c.grupo_risco_calculado === 'critico')
        .length,
      atencao: cards.filter((c: any) => c.grupo_risco_calculado === 'atencao')
        .length,
      autonomo: cards.filter((c: any) => c.grupo_risco_calculado === 'autonomo')
        .length,
    };

    let filteredCards: any[] = cards;
    if (filters.grupoRisco && filters.grupoRisco !== 'todos') {
      filteredCards = cards.filter(
        (c: any) => c.grupo_risco_calculado === filters.grupoRisco,
      );
    }

    return {
      cards: filteredCards,
      summary,
    };
  }

  // 7. Criar ou Vincular Cartão no Kanban
  async createKanbanCard(dto: CreateKanbanCardDto, tutorId?: string) {
    await this.ensureKanbanTable();

    const periodo = dto.periodo || '2026-2';
    const institution = dto.institution || 'ead';
    const matricula = dto.matricula.trim();

    // 1. Valida se tutorId existe em "user" para evitar violação de foreign key
    let validTutorId: string | null = null;
    if (tutorId) {
      try {
        const u = await this.db.execute(
          sql`SELECT id FROM "user" WHERE id = ${tutorId} LIMIT 1;`,
        );
        if (u.length > 0) validTutorId = tutorId;
      } catch {
        validTutorId = null;
      }
    }

    // 2. Normaliza código e nome da disciplina
    const disciplinaCodigo = dto.disciplinaCodigo?.trim() || null;
    const disciplinaNomeInput = dto.disciplinaNome?.trim() || null;

    // 3. Verifica se já existe atendimento para o estudante nessa disciplina e período
    const existing = await this.db.execute(sql`
      SELECT id, status_kanban, matricula, disciplina_codigo
      FROM tutoria_atendimentos_kanban
      WHERE periodo = ${periodo}
        AND "sourceInstitution" = ${institution}
        AND matricula = ${matricula}
        AND (${disciplinaCodigo ? sql`disciplina_codigo = ${disciplinaCodigo}` : sql`(disciplina_codigo IS NULL OR disciplina_codigo = '')`})
      LIMIT 1;
    `);

    if (existing.length > 0) {
      if (dto.statusKanban && existing[0].status_kanban !== dto.statusKanban) {
        await this.db.execute(sql`
          UPDATE tutoria_atendimentos_kanban
          SET status_kanban = ${dto.statusKanban},
              "updatedAt" = now()
          WHERE id = ${existing[0].id};
        `);
      }
      return {
        id: existing[0].id,
        card: existing[0],
        created: false,
        message: 'Discente já possui atendimento cadastrado nesta disciplina.',
      };
    }

    // 4. Busca dados cadastrais e de engajamento para auto-completar caso faltem
    let alunoNome = dto.alunoNome?.trim() || undefined;
    let alunoEmail = dto.alunoEmail?.trim() || undefined;
    let disciplinaNome = disciplinaNomeInput;

    if (!alunoNome || !alunoEmail) {
      const disc = await this.db
        .execute(
          sql`
        SELECT nome, email FROM academic_discente WHERE matricula = ${matricula} OR id::text = ${matricula} LIMIT 1;
      `,
        )
        .catch(() => []);
      if (disc.length > 0) {
        alunoNome = alunoNome || (disc[0].nome as string);
        alunoEmail = alunoEmail || (disc[0].email as string);
      }
    }

    if (!alunoNome || !alunoEmail) {
      const eng = await this.db
        .execute(
          sql`
        SELECT aluno_nome, aluno_email FROM tutoria_engajamento_aluno WHERE matricula = ${matricula} LIMIT 1;
      `,
        )
        .catch(() => []);
      if (eng.length > 0) {
        alunoNome = alunoNome || (eng[0].aluno_nome as string);
        alunoEmail = alunoEmail || (eng[0].aluno_email as string);
      }
    }

    if (!disciplinaNome && disciplinaCodigo) {
      const eng = await this.db
        .execute(
          sql`
        SELECT disciplina_nome FROM tutoria_engajamento_aluno
        WHERE matricula = ${matricula} AND disciplina_codigo = ${disciplinaCodigo}
        LIMIT 1;
      `,
        )
        .catch(() => []);
      if (eng.length > 0) {
        disciplinaNome = eng[0].disciplina_nome as string;
      }
    }

    const newId = crypto.randomUUID();
    const status = dto.statusKanban || 'pendente';
    const ultimoContato = dto.canalContatoUtilizado
      ? new Date().toISOString()
      : null;

    try {
      await this.db.execute(sql`
        INSERT INTO tutoria_atendimentos_kanban (
          id,
          "sourceInstitution",
          periodo,
          matricula,
          aluno_nome,
          aluno_email,
          disciplina_codigo,
          disciplina_nome,
          status_kanban,
          tutor_responsavel_id,
          tutor_iniciador_id,
          observacoes,
          canal_contato_utilizado,
          ultimo_contato_em,
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${newId},
          ${institution},
          ${periodo},
          ${matricula},
          ${alunoNome || 'Estudante'},
          ${alunoEmail || null},
          ${disciplinaCodigo},
          ${disciplinaNome || null},
          ${status},
          ${validTutorId},
          ${validTutorId},
          ${dto.observacoes || null},
          ${dto.canalContatoUtilizado || null},
          ${ultimoContato},
          now(),
          now()
        );
      `);

      // Persist opening audit record in tutoria_atendimentos_historico
      await this.ensureTimelineTable();
      const autorInfo = validTutorId
        ? await this.resolveTutorInfo(validTutorId)
        : null;
      const autorNome = autorInfo?.name || 'Tutor Responsável';
      const eventId = crypto.randomUUID();
      await this.db.execute(sql`
        INSERT INTO tutoria_atendimentos_historico (
          id, atendimento_id, matricula, periodo, "sourceInstitution",
          tipo_evento, autor_id, autor_nome, estado_novo, observacoes, "createdAt"
        ) VALUES (
          ${eventId}, ${newId}, ${matricula}, ${periodo}, ${institution},
          'abertura', ${validTutorId || null}, ${autorNome}, ${status},
          ${dto.observacoes || 'Abertura de atendimento no Kanban'}, now()
        );
      `);

      return {
        id: newId,
        created: true,
        message: 'Atendimento cadastrado no Kanban com sucesso!',
      };
    } catch (insertErr: any) {
      console.error(
        '[TutoriaService] Erro ao inserir cartão no Kanban:',
        insertErr,
      );
      throw new BadRequestException(
        `Erro ao cadastrar atendimento: ${insertErr?.message || 'Falha no banco de dados'}`,
      );
    }
  }

  // 8. Atualizar Cartão do Kanban (Status, Observações, Contato)
  // MULTI-TUTOR HYBRID OWNERSHIP INVARIANT: Collaborators moving cards or updating notes NEVER overwrite tutor_responsavel_id
  async updateKanbanCard(
    id: string,
    dto: UpdateKanbanCardDto,
    autorIdOrUser?: string | any,
    autorNomeFallback?: string,
  ) {
    await this.ensureTimelineTable();

    let autorId: string | undefined;
    let fallbackNome: string | undefined = autorNomeFallback;

    if (autorIdOrUser && typeof autorIdOrUser === 'object') {
      autorId = autorIdOrUser.id;
      if (!fallbackNome && autorIdOrUser.name) {
        fallbackNome = autorIdOrUser.name;
      }
    } else if (typeof autorIdOrUser === 'string') {
      autorId = autorIdOrUser;
    }

    const existingRows = await this.db.execute(sql`
      SELECT id, matricula, periodo, "sourceInstitution", status_kanban, tutor_responsavel_id, observacoes, canal_contato_utilizado
      FROM tutoria_atendimentos_kanban
      WHERE id = ${id}
      LIMIT 1;
    `);

    if (existingRows.length === 0) {
      throw new NotFoundException(
        `Cartão de atendimento ${id} não encontrado.`,
      );
    }

    const card: any = existingRows[0];
    const allowedStatuses = [
      'pendente',
      'em_contato',
      'aguardando_retorno',
      'em_recuperacao',
      'revertido',
      'evadido',
    ];

    if (
      dto.statusKanban !== undefined &&
      !allowedStatuses.includes(dto.statusKanban)
    ) {
      throw new BadRequestException(
        `Status kanban inválido: ${dto.statusKanban}`,
      );
    }

    const autorInfo = autorId ? await this.resolveTutorInfo(autorId) : null;
    const autorNome = fallbackNome || autorInfo?.name || 'Tutor Atuante';

    const estadoAnterior = card.status_kanban;
    let statusMudou = false;
    const updates = [sql`"updatedAt" = now()`];

    if (dto.statusKanban && dto.statusKanban !== card.status_kanban) {
      updates.push(sql`status_kanban = ${dto.statusKanban}`);
      statusMudou = true;
      if (dto.statusKanban === 'revertido') {
        updates.push(sql`data_resolucao = now()`);
      }
    }

    let cleanObs = '';
    let observacoesMudou = false;
    if (dto.observacoes !== undefined) {
      cleanObs = dto.observacoes ? dto.observacoes.trim() : '';
      updates.push(sql`observacoes = ${cleanObs}`);
      if (
        cleanObs !== String(card.observacoes || '').trim() &&
        cleanObs.length > 0
      ) {
        observacoesMudou = true;
      }
    }

    let canalMudou = false;
    if (dto.canalContatoUtilizado !== undefined) {
      updates.push(sql`canal_contato_utilizado = ${dto.canalContatoUtilizado}`);
      updates.push(sql`ultimo_contato_em = now()`);
      canalMudou = true;
    }

    if (dto.ultimoContatoEm !== undefined) {
      const d = dto.ultimoContatoEm
        ? new Date(dto.ultimoContatoEm).toISOString()
        : null;
      updates.push(sql`ultimo_contato_em = ${d}`);
    }

    if (dto.dataResolucao !== undefined) {
      const r = dto.dataResolucao
        ? new Date(dto.dataResolucao).toISOString()
        : null;
      updates.push(sql`data_resolucao = ${r}`);
    }

    // MULTI-TUTOR HYBRID OWNERSHIP INVARIANT:
    // Never mutate tutor_responsavel_id here! Collaborators moving cards or notes do NOT steal ownership.

    if (statusMudou || observacoesMudou || canalMudou) {
      updates.push(sql`ultima_intervencao_em = now()`);
      updates.push(sql`qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`);
    }

    const setClause = sql.join(updates, sql`, `);
    await this.db.execute(sql`
      UPDATE tutoria_atendimentos_kanban
      SET ${setClause}
      WHERE id = ${id};
    `);

    // Audit Logging into tutoria_atendimentos_historico
    if (statusMudou) {
      const eventId: string = crypto.randomUUID();
      await this.db.execute(sql`
        INSERT INTO tutoria_atendimentos_historico (
          id, atendimento_id, matricula, periodo, "sourceInstitution",
          tipo_evento, autor_id, autor_nome, estado_anterior, estado_novo,
          observacoes, "createdAt"
        ) VALUES (
          ${eventId}, ${card.id}, ${card.matricula}, ${card.periodo || '2026-2'},
          ${card.sourceInstitution || 'ead'}, 'mudanca_status', ${autorId || null},
          ${autorNome}, ${estadoAnterior}, ${dto.statusKanban},
          ${cleanObs ? cleanObs : null}, now()
        );
      `);
    } else if (observacoesMudou) {
      const eventId: string = crypto.randomUUID();
      await this.db.execute(sql`
        INSERT INTO tutoria_atendimentos_historico (
          id, atendimento_id, matricula, periodo, "sourceInstitution",
          tipo_evento, autor_id, autor_nome, observacoes, "createdAt"
        ) VALUES (
          ${eventId}, ${card.id}, ${card.matricula}, ${card.periodo || '2026-2'},
          ${card.sourceInstitution || 'ead'}, 'intervencao_manual', ${autorId || null},
          ${autorNome}, ${cleanObs}, now()
        );
      `);
    } else if (canalMudou) {
      const eventId: string = crypto.randomUUID();
      await this.db.execute(sql`
        INSERT INTO tutoria_atendimentos_historico (
          id, atendimento_id, matricula, periodo, "sourceInstitution",
          tipo_evento, autor_id, autor_nome, canal_contato, observacoes, "createdAt"
        ) VALUES (
          ${eventId}, ${card.id}, ${card.matricula}, ${card.periodo || '2026-2'},
          ${card.sourceInstitution || 'ead'}, 'contato_enviado', ${autorId || null},
          ${autorNome}, ${dto.canalContatoUtilizado},
          ${cleanObs ? cleanObs : null}, now()
        );
      `);
    }

    return {
      id,
      success: true,
      message: 'Atendimento atualizado com sucesso!',
    };
  }

  // 9. Registrar Intervenção Manual ou Comunicação Multicanal
  async registrarIntervencao(
    dto: CreateIntervencaoDto,
    autorIdOrUser?: string | any,
    autorNomeFallback?: string,
  ): Promise<{
    id: string;
    atendimentoId: string | null;
    matricula: string;
    periodo: string;
    tipoEvento: string;
    autorId: string | null;
    autorNome: string;
    canalContato: string | null;
    observacoes: string;
    metadata: any;
    createdAt: string;
  }> {
    await this.ensureTimelineTable();

    if (!dto.matricula || !dto.matricula.trim()) {
      throw new BadRequestException('Matrícula é obrigatória.');
    }
    const matricula = dto.matricula.trim();

    if (!dto.observacoes || !dto.observacoes.trim()) {
      throw new BadRequestException(
        'Observações são obrigatórias para registrar intervenção.',
      );
    }
    const observacoes = dto.observacoes.trim();

    const allowedTipos = [
      'abertura',
      'mudanca_status',
      'contato_enviado',
      'intervencao_manual',
      'passagem_bastao',
      'finalizacao',
      'reabertura',
    ];
    if (dto.tipoEvento && !allowedTipos.includes(dto.tipoEvento)) {
      throw new BadRequestException(`tipoEvento inválido: ${dto.tipoEvento}`);
    }

    const allowedCanais = ['whatsapp', 'email', 'telefone', 'ava', 'outro'];
    if (dto.canalContato && !allowedCanais.includes(dto.canalContato)) {
      throw new BadRequestException(
        `canalContato inválido: ${dto.canalContato}`,
      );
    }

    const allowedStatuses = [
      'pendente',
      'em_contato',
      'aguardando_retorno',
      'em_recuperacao',
      'revertido',
      'evadido',
    ];
    if (
      dto.statusKanban !== undefined &&
      !allowedStatuses.includes(dto.statusKanban)
    ) {
      throw new BadRequestException(
        `Status kanban inválido: ${dto.statusKanban}`,
      );
    }

    let autorId: string | undefined;
    let fallbackNome: string | undefined = autorNomeFallback;

    if (autorIdOrUser && typeof autorIdOrUser === 'object') {
      autorId = autorIdOrUser.id;
      if (!fallbackNome && autorIdOrUser.name) {
        fallbackNome = autorIdOrUser.name;
      }
    } else if (typeof autorIdOrUser === 'string') {
      autorId = autorIdOrUser;
    }

    const autorInfo = autorId ? await this.resolveTutorInfo(autorId) : null;
    const autorNome = fallbackNome || autorInfo?.name || 'Tutor Atuante';

    // Localiza card correspondente
    let atendimentoId = dto.atendimentoId?.trim() || null;
    let card: any = null;

    if (atendimentoId) {
      const cardRows = await this.db.execute(sql`
        SELECT id, matricula, periodo, "sourceInstitution", status_kanban
        FROM tutoria_atendimentos_kanban
        WHERE id = ${atendimentoId}
        LIMIT 1;
      `);
      if (cardRows.length > 0) card = cardRows[0];
    } else {
      const cardRows = await this.db.execute(sql`
        SELECT id, matricula, periodo, "sourceInstitution", status_kanban
        FROM tutoria_atendimentos_kanban
        WHERE matricula = ${matricula}
          AND periodo = ${dto.periodo || '2026-2'}
        ORDER BY "updatedAt" DESC
        LIMIT 1;
      `);
      if (cardRows.length > 0) {
        card = cardRows[0];
        atendimentoId = card.id;
      }
    }

    // Atualiza métricas do card se encontrado
    if (card) {
      const cardUpdates = [
        sql`ultima_intervencao_em = now()`,
        sql`qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`,
        sql`"updatedAt" = now()`,
      ];
      if (dto.canalContato) {
        cardUpdates.push(sql`canal_contato_utilizado = ${dto.canalContato}`);
      }
      if (dto.tipoEvento === 'contato_enviado') {
        cardUpdates.push(sql`ultimo_contato_em = now()`);
      }
      if (dto.statusKanban && dto.statusKanban !== card.status_kanban) {
        cardUpdates.push(sql`status_kanban = ${dto.statusKanban}`);
        if (dto.statusKanban === 'revertido') {
          cardUpdates.push(sql`data_resolucao = now()`);
        }
      }
      await this.db.execute(sql`
        UPDATE tutoria_atendimentos_kanban
        SET ${sql.join(cardUpdates, sql`, `)}
        WHERE id = ${card.id};
      `);
    }

    const eventId: string = crypto.randomUUID();
    const periodo = dto.periodo || card?.periodo || '2026-2';
    const institution = card?.sourceInstitution || 'ead';
    const metadataStr = dto.metadata
      ? typeof dto.metadata === 'string'
        ? dto.metadata
        : JSON.stringify(dto.metadata)
      : null;

    await this.db.execute(sql`
      INSERT INTO tutoria_atendimentos_historico (
        id, atendimento_id, matricula, periodo, "sourceInstitution",
        tipo_evento, autor_id, autor_nome, canal_contato, observacoes,
        metadata, "createdAt"
      ) VALUES (
        ${eventId}, ${atendimentoId}, ${matricula}, ${periodo}, ${institution},
        ${dto.tipoEvento}, ${autorId || null}, ${autorNome}, ${dto.canalContato || null},
        ${observacoes}, ${metadataStr}, now()
      );
    `);

    return {
      id: eventId,
      atendimentoId,
      matricula,
      periodo,
      tipoEvento: dto.tipoEvento,
      autorId: autorId || null,
      autorNome,
      canalContato: dto.canalContato || null,
      observacoes,
      metadata: dto.metadata || null,
      createdAt: new Date().toISOString(),
    };
  }

  // Alias para registrarIntervencao
  async createIntervencao(
    dto: CreateIntervencaoDto,
    autorIdOrUser?: string | any,
    autorNomeFallback?: string,
  ): Promise<any> {
    return this.registrarIntervencao(dto, autorIdOrUser, autorNomeFallback);
  }

  // 10. Passagem de Bastão (Transferência de Titularidade Principal com Justificativa)
  async transferirTutor(
    id: string,
    dto: TransferirTutorDto,
    autorIdOrUser?: string | any,
    autorNomeFallback?: string,
  ): Promise<any> {
    await this.ensureTimelineTable();

    const cardRows = await this.db.execute(sql`
      SELECT id, matricula, periodo, "sourceInstitution", status_kanban, tutor_responsavel_id
      FROM tutoria_atendimentos_kanban
      WHERE id = ${id}
      LIMIT 1;
    `);

    if (cardRows.length === 0) {
      throw new NotFoundException(
        `Cartão de atendimento ${id} não encontrado.`,
      );
    }
    const card = cardRows[0];

    if (!dto.novoTutorId || dto.novoTutorId.trim().length < 5) {
      throw new BadRequestException('ID do novo tutor inválido ou ausente.');
    }
    const novoTutorId = dto.novoTutorId.trim();

    const targetUserRows = await this.db.execute(sql`
      SELECT id, name, email, "isActive"
      FROM "user"
      WHERE id = ${novoTutorId}
      LIMIT 1;
    `);

    if (targetUserRows.length === 0) {
      throw new NotFoundException(`Novo tutor ${novoTutorId} não encontrado.`);
    }

    if (!targetUserRows[0].isActive) {
      throw new BadRequestException('Tutor selecionado está inativo.');
    }

    if (card.tutor_responsavel_id === novoTutorId) {
      throw new BadRequestException(
        'O discente já está atribuído a este tutor.',
      );
    }

    if (!dto.notaTransicao || dto.notaTransicao.trim().length < 5) {
      throw new BadRequestException(
        'A nota de transição é obrigatória (mínimo de 5 caracteres).',
      );
    }
    const notaTransicao = dto.notaTransicao.trim();

    let autorId: string | undefined;
    let fallbackNome: string | undefined = autorNomeFallback;

    if (autorIdOrUser && typeof autorIdOrUser === 'object') {
      autorId = autorIdOrUser.id;
      if (!fallbackNome && autorIdOrUser.name) {
        fallbackNome = autorIdOrUser.name;
      }
    } else if (typeof autorIdOrUser === 'string') {
      autorId = autorIdOrUser;
    }

    const autorInfo = autorId ? await this.resolveTutorInfo(autorId) : null;
    const autorNome = fallbackNome || autorInfo?.name || 'Tutor Atuante';
    const tutorAnterior = card.tutor_responsavel_id || null;

    await this.db.execute(sql`
      UPDATE tutoria_atendimentos_kanban
      SET tutor_responsavel_id = ${novoTutorId},
          ultima_intervencao_em = now(),
          qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1,
          "updatedAt" = now()
      WHERE id = ${id};
    `);

    const eventId: string = crypto.randomUUID();
    await this.db.execute(sql`
      INSERT INTO tutoria_atendimentos_historico (
        id, atendimento_id, matricula, periodo, "sourceInstitution",
        tipo_evento, autor_id, autor_nome, tutor_responsavel_anterior_id,
        tutor_responsavel_novo_id, observacoes, "createdAt"
      ) VALUES (
        ${eventId}, ${id}, ${card.matricula}, ${card.periodo || '2026-2'},
        ${card.sourceInstitution || 'ead'}, 'passagem_bastao', ${autorId || null},
        ${autorNome}, ${tutorAnterior}, ${novoTutorId}, ${notaTransicao}, now()
      );
    `);

    return {
      success: true,
      card: {
        id: card.id,
        tutorResponsavelId: novoTutorId,
      },
      evento: {
        id: eventId,
        atendimentoId: id,
        matricula: card.matricula,
        periodo: card.periodo || '2026-2',
        tipoEvento: 'passagem_bastao',
        autorId: autorId || null,
        autorNome,
        tutorResponsavelAnteriorId: tutorAnterior,
        tutorResponsavelNovoId: novoTutorId,
        observacoes: notaTransicao,
        createdAt: new Date().toISOString(),
      },
    };
  }

  // 11. Linha do Tempo Consolidada do Aluno com Fallback Legado
  async getTimelineAluno(
    matriculaParam: string,
    atendimentoId?: string,
  ): Promise<any[]> {
    await this.ensureTimelineTable();

    if (!matriculaParam || !matriculaParam.trim()) {
      throw new BadRequestException('Matrícula inválida.');
    }
    const matricula = matriculaParam.trim();

    if (atendimentoId !== undefined && atendimentoId.trim().length < 5) {
      throw new BadRequestException('atendimentoId deve ser um UUID válido.');
    }
    const cleanAtendimentoId = atendimentoId ? atendimentoId.trim() : null;

    const events = await this.db.execute(sql`
      SELECT
        h.id,
        h.atendimento_id AS "atendimentoId",
        h.matricula,
        h.periodo,
        h."sourceInstitution",
        h.tipo_evento AS "tipoEvento",
        h.autor_id AS "autorId",
        h.autor_nome AS "autorNome",
        h.tutor_responsavel_anterior_id AS "tutorResponsavelAnteriorId",
        h.tutor_responsavel_novo_id AS "tutorResponsavelNovoId",
        h.estado_anterior AS "estadoAnterior",
        h.estado_novo AS "estadoNovo",
        h.canal_contato AS "canalContato",
        h.observacoes,
        h.metadata,
        h."createdAt"
      FROM tutoria_atendimentos_historico h
      WHERE h.matricula = ${matricula}
        ${cleanAtendimentoId ? sql`AND h.atendimento_id = ${cleanAtendimentoId}` : sql``}
      ORDER BY h."createdAt" ASC;
    `);

    const formattedEvents = (events || []).map((e: any) => ({
      ...e,
      metadata:
        e.metadata && typeof e.metadata === 'string'
          ? (() => {
              try {
                return JSON.parse(e.metadata);
              } catch {
                return e.metadata;
              }
            })()
          : e.metadata || null,
    }));

    // Fallback legado se histórico estiver vazio
    if (formattedEvents.length === 0) {
      const cardRows = await this.db.execute(sql`
        SELECT
          k.id,
          k.matricula,
          k.periodo,
          k."sourceInstitution",
          k.status_kanban,
          k.tutor_responsavel_id,
          k.tutor_iniciador_id,
          k.observacoes,
          k."createdAt",
          u.name AS tutor_nome
        FROM tutoria_atendimentos_kanban k
        LEFT JOIN "user" u ON u.id = COALESCE(k.tutor_iniciador_id, k.tutor_responsavel_id)
        WHERE k.matricula = ${matricula}
          ${cleanAtendimentoId ? sql`AND k.id = ${cleanAtendimentoId}` : sql``}
        ORDER BY k."createdAt" ASC
        LIMIT 1;
      `);

      if (cardRows.length > 0) {
        const c = cardRows[0];
        return [
          {
            id: `legacy-${c.id}`,
            atendimentoId: c.id,
            matricula: c.matricula,
            periodo: c.periodo,
            sourceInstitution: c.sourceInstitution || 'ead',
            tipoEvento: 'abertura',
            autorId: c.tutor_iniciador_id || c.tutor_responsavel_id || null,
            autorNome: c.tutor_nome || 'Tutor Responsável',
            tutorResponsavelAnteriorId: null,
            tutorResponsavelNovoId: c.tutor_responsavel_id || null,
            estadoAnterior: null,
            estadoNovo: c.status_kanban || 'pendente',
            canalContato: null,
            observacoes: c.observacoes || 'Abertura de atendimento no Kanban',
            metadata: null,
            createdAt: c.createdAt,
          },
        ];
      }
      return [];
    }

    return formattedEvents;
  }

  // Alias para getTimelineAluno
  async getStudentTimeline(
    matriculaParam: string,
    atendimentoId?: string,
  ): Promise<any[]> {
    return this.getTimelineAluno(matriculaParam, atendimentoId);
  }

  // 12. Listagem de Tutores Ativos para Seleção de Pares
  async getTutoresAtivos() {
    const rows = await this.db.execute(sql`
      SELECT id, name, email
      FROM "user"
      WHERE "isActive" = true
      ORDER BY name ASC;
    `);
    return rows;
  }

  // Alias para getTutoresAtivos
  async getActiveTutors() {
    return this.getTutoresAtivos();
  }

  // 13. Excluir / Arquivar Cartão do Kanban
  async deleteKanbanCard(id: string) {
    await this.ensureKanbanTable();

    await this.db.execute(sql`
      DELETE FROM tutoria_atendimentos_kanban WHERE id = ${id};
    `);
    return { id, success: true, message: 'Atendimento removido do Kanban.' };
  }

  // 14. Envio de E-mail de Orientação Pedagógica com Registro em Linha do Tempo
  async enviarEmailPedagogico(
    dto: SendTutoriaEmailDto,
    autorIdOrUser?: string | any,
    autorNomeFallback?: string,
  ): Promise<any> {
    await this.ensureTimelineTable();
    await this.ensureKanbanTable();

    if (!dto.alunoEmail || !dto.alunoEmail.includes('@')) {
      throw new BadRequestException('E-mail do discente inválido ou ausente.');
    }
    if (!dto.mensagem || dto.mensagem.trim().length === 0) {
      throw new BadRequestException('Mensagem pedagógica não pode ser vazia.');
    }

    let autorId: string | undefined;
    let fallbackNome: string | undefined = autorNomeFallback;

    if (autorIdOrUser && typeof autorIdOrUser === 'object') {
      autorId = autorIdOrUser.id;
      if (!fallbackNome && autorIdOrUser.name) {
        fallbackNome = autorIdOrUser.name;
      }
    } else if (typeof autorIdOrUser === 'string') {
      autorId = autorIdOrUser;
    }

    const autorInfo = autorId ? await this.resolveTutorInfo(autorId) : null;
    const tutorNome = fallbackNome || autorInfo?.name || 'Tutor Pedagógico';

    // Disparar e-mail via MailService se configurado
    let mailResult: any = { success: true, messageId: 'simulated-mail-id' };
    if (this.mailService) {
      mailResult = await this.mailService.sendTutoriaOrientation(dto.alunoEmail.trim(), {
        alunoNome: dto.alunoNome || 'Estudante',
        tutorNome,
        disciplinaNome: dto.disciplinaNome || 'Sua Disciplina EAD',
        mensagem: dto.mensagem.trim(),
        periodo: dto.periodo || '2026-2',
      });

      if (!mailResult.success) {
        throw new BadRequestException(
          `Falha ao enviar e-mail: ${mailResult.error || 'Erro no servidor de correio.'}`,
        );
      }
    }

    // Localizar ou vincular atendimento Kanban se existir
    let card: any = null;
    if (dto.cardId) {
      const rows = await this.db.execute(sql`
        SELECT id, matricula, periodo, "sourceInstitution", status_kanban
        FROM tutoria_atendimentos_kanban
        WHERE id = ${dto.cardId}
        LIMIT 1;
      `);
      if (rows.length > 0) card = rows[0];
    }

    if (!card && dto.matricula) {
      const rows = await this.db.execute(sql`
        SELECT id, matricula, periodo, "sourceInstitution", status_kanban
        FROM tutoria_atendimentos_kanban
        WHERE matricula = ${dto.matricula.trim()}
        ORDER BY "updatedAt" DESC
        LIMIT 1;
      `);
      if (rows.length > 0) card = rows[0];
    }

    if (card) {
      const cardUpdates = [
        sql`ultimo_contato_em = now()`,
        sql`ultima_intervencao_em = now()`,
        sql`canal_contato_utilizado = 'email'`,
        sql`qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`,
        sql`"updatedAt" = now()`,
      ];
      // Se estava a_contatar, avança para em_contato
      if (card.status_kanban === 'a_contatar') {
        cardUpdates.push(sql`status_kanban = 'em_contato'`);
      }
      await this.db.execute(sql`
        UPDATE tutoria_atendimentos_kanban
        SET ${sql.join(cardUpdates, sql`, `)}
        WHERE id = ${card.id};
      `);
    }

    const eventId: string = crypto.randomUUID();
    const matricula = dto.matricula.trim();
    const periodo = dto.periodo || card?.periodo || '2026-2';
    const institution = card?.sourceInstitution || 'ead';

    await this.db.execute(sql`
      INSERT INTO tutoria_atendimentos_historico (
        id, atendimento_id, matricula, periodo, "sourceInstitution",
        tipo_evento, autor_id, autor_nome, canal_contato, observacoes,
        metadata, "createdAt"
      ) VALUES (
        ${eventId}, ${card?.id || null}, ${matricula}, ${periodo}, ${institution},
        'contato_enviado', ${autorId || null}, ${tutorNome}, 'email',
        ${dto.mensagem.trim()},
        ${JSON.stringify({ alunoEmail: dto.alunoEmail, messageId: mailResult.messageId })},
        now()
      );
    `);

    return {
      success: true,
      messageId: mailResult.messageId,
      eventoId: eventId,
      cardId: card?.id || null,
      message: 'E-mail pedagógico enviado com sucesso e registrado na linha do tempo.',
    };
  }
}
