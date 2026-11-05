import { Injectable, Inject, Optional } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CacheService } from '../cache/cache.service';
import { TutoriaSyncService } from './tutoria-sync.service';
import { EngagementFilterDto } from './dto/engagement-filter.dto';

export { EngagementFilterDto };

@Injectable()
export class TutoriaService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private readonly syncService: TutoriaSyncService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

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
      conditions.push(sql`periodo = ${filters.periodo}`);
    } else {
      conditions.push(sql`periodo = '2026-2'`);
    }

    if (filters.disciplinaCodigo) {
      conditions.push(sql`disciplina_codigo = ${filters.disciplinaCodigo}`);
    }

    if (filters.disciplinaId) {
      conditions.push(sql`disciplina_id = ${filters.disciplinaId}`);
    }

    if (filters.grupoRisco) {
      conditions.push(sql`grupo_risco_calculado = ${filters.grupoRisco}`);
    }

    if (filters.faixaTempo) {
      if (filters.faixaTempo === 'ate_30') {
        conditions.push(sql`COALESCE(tempo_total_minutos::numeric, 0) <= 30`);
      } else if (filters.faixaTempo === 'ate_60' || filters.faixaTempo === '30_a_60') {
        conditions.push(
          sql`COALESCE(tempo_total_minutos::numeric, 0) > 30 AND COALESCE(tempo_total_minutos::numeric, 0) <= 60`,
        );
      } else if (filters.faixaTempo === 'mais_60') {
        conditions.push(sql`COALESCE(tempo_total_minutos::numeric, 0) > 60`);
      }
    }

    if (filters.recenciaAcesso && filters.recenciaAcesso !== 'todos') {
      if (filters.recenciaAcesso === 'mais_7_dias') {
        conditions.push(
          sql`(data_ultimo_acesso IS NULL OR data_ultimo_acesso = '0' OR data_ultimo_acesso LIKE '1970%' OR data_ultimo_acesso::timestamp < (NOW() - INTERVAL '7 days'))`,
        );
      } else if (filters.recenciaAcesso === 'mais_14_dias') {
        conditions.push(
          sql`(data_ultimo_acesso IS NULL OR data_ultimo_acesso = '0' OR data_ultimo_acesso LIKE '1970%' OR data_ultimo_acesso::timestamp < (NOW() - INTERVAL '14 days'))`,
        );
      } else if (filters.recenciaAcesso === 'mais_30_dias') {
        conditions.push(
          sql`(data_ultimo_acesso IS NULL OR data_ultimo_acesso = '0' OR data_ultimo_acesso LIKE '1970%' OR data_ultimo_acesso::timestamp < (NOW() - INTERVAL '30 days'))`,
        );
      } else if (filters.recenciaAcesso === 'sem_acesso') {
        conditions.push(
          sql`(data_ultimo_acesso IS NULL OR data_ultimo_acesso = '0' OR data_ultimo_acesso LIKE '1970%')`,
        );
      }
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        sql`(aluno_nome ILIKE ${term} OR matricula ILIKE ${term} OR aluno_email ILIKE ${term} OR disciplina_nome ILIKE ${term})`,
      );
    }

    return conditions;
  }

  // 2. Lista paginada de engajamento dos alunos com filtros avançados
  async getEngagementList(filters: EngagementFilterDto) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = this.buildEngagementConditions(filters);
    const whereClause = sql.join(conditions, sql` AND `);

    const [totalRes, items] = await Promise.all([
      this.db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM tutoria_engajamento_aluno
        WHERE ${whereClause};
      `),
      this.db.execute(sql`
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

  // 3. Raio-X detalhado de atividades do aluno + contato discente
  async getStudentActivityLogs(matricula: string, disciplinaId?: string) {
    const conditions = [sql`l.matricula = ${matricula}`];
    if (disciplinaId) {
      conditions.push(sql`l.disciplina_id = ${disciplinaId}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    const [logs, discenteRows] = await Promise.all([
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
      this.db.execute(sql`
        SELECT telefone, email, curso_nome, unidade_fisica
        FROM academic_discente
        WHERE matricula = ${matricula}
        LIMIT 1;
      `).catch(() => []),
    ]);

    return {
      logs,
      discente: discenteRows[0] || null,
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
}
