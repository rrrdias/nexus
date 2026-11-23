import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CacheService } from '../cache/cache.service';
import { TutoriaService } from './tutoria.service';
import { TeologiaEngagementFilterDto } from './dto/teologia-engagement-filter.dto';

@Injectable()
export class TutoriaTeologiaService {
  private static readonly GRUPO_SLUG = 'teologia';

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private readonly tutoriaService: TutoriaService,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  private buildTeologiaConditions(filters: TeologiaEngagementFilterDto) {
    const periodo = filters.periodo || '2026-2';
    const institution = (filters.institution || 'ead').trim().toLowerCase();

    const conditions: any[] = [
      sql`e."sourceInstitution" = ${institution}`,
      sql`e.periodo = ${periodo}`,
      sql`(COALESCE(e.disciplina_codigo, '') NOT ILIKE 'SM_AVISOS%' AND COALESCE(e.disciplina_nome, '') NOT ILIKE '%Sala de Avisos%')`,
    ];

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
        conditions.push(
          sql`COALESCE(e.tempo_total_minutos::numeric, 0) <= 30`,
        );
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

    if (filters.enrolmentStatus && filters.enrolmentStatus !== 'todos') {
      if (filters.enrolmentStatus === 'ativo') {
        conditions.push(
          sql`(e.enrolment_status IS NULL OR lower(e.enrolment_status) LIKE '%ativ%' OR lower(e.enrolment_status) LIKE '%matriculad%')`,
        );
      } else if (filters.enrolmentStatus === 'suspenso') {
        conditions.push(
          sql`(lower(COALESCE(e.enrolment_status, '')) LIKE '%suspens%' OR lower(COALESCE(e.enrolment_status, '')) LIKE '%tranc%' OR lower(COALESCE(e.enrolment_status, '')) LIKE '%inativ%')`,
        );
      } else if (filters.enrolmentStatus === 'cancelado') {
        conditions.push(
          sql`(lower(COALESCE(e.enrolment_status, '')) LIKE '%cancel%' OR lower(COALESCE(e.enrolment_status, '')) LIKE '%deslig%')`,
        );
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

  async getTeologiaDashboardSummary(periodo = '2026-2', institution = 'ead') {
    await this.tutoriaService.ensureTeologiaGrupoSchema();
    await this.tutoriaService.ensureEngajamentoColumns();

    const inst = (institution || 'ead').trim().toLowerCase();
    const cacheKey = `tutoria:teologia:summary:${inst}:${periodo}`;
    if (this.cacheService) {
      const cached = await this.cacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

    const res = await this.db.execute(sql`
      SELECT
        COUNT(*)::int AS total_alunos_disciplinas,
        COUNT(DISTINCT e.matricula)::int AS total_alunos_unicos,
        COUNT(DISTINCT e.disciplina_id)::int AS total_disciplinas,
        COUNT(CASE WHEN e.grupo_risco_calculado = 'critico' THEN 1 END)::int AS total_critico,
        COUNT(CASE WHEN e.grupo_risco_calculado = 'atencao' THEN 1 END)::int AS total_atencao,
        COUNT(CASE WHEN e.grupo_risco_calculado = 'autonomo' THEN 1 END)::int AS total_autonomo,
        ROUND(AVG(COALESCE(e.tempo_total_minutos::numeric, 0)), 1)::float AS media_tempo_minutos,
        ROUND(AVG(COALESCE(e.score_engajamento::numeric, 0)), 1)::float AS media_score_engajamento
      FROM tutoria_engajamento_aluno e
      INNER JOIN tutoria_grupo_alunos tga
        ON tga.matricula = e.matricula
        AND tga."sourceInstitution" = e."sourceInstitution"
      INNER JOIN tutoria_grupos tg
        ON tg.id = tga.grupo_id
        AND tg.slug = ${TutoriaTeologiaService.GRUPO_SLUG}
        AND tg.ativo = true
      WHERE e."sourceInstitution" = ${inst}
        AND e.periodo = ${periodo}
        AND COALESCE(e.disciplina_codigo, '') NOT ILIKE 'SM_AVISOS%'
        AND COALESCE(e.disciplina_nome, '') NOT ILIKE '%Sala de Avisos%';
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
      await this.cacheService.set(cacheKey, summary, 300);
    }

    return summary;
  }

  async getTeologiaEngagementList(filters: TeologiaEngagementFilterDto) {
    await this.tutoriaService.ensureTeologiaGrupoSchema();
    await this.tutoriaService.ensureEngajamentoColumns();

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = this.buildTeologiaConditions(filters);
    const whereClause = sql.join(conditions, sql` AND `);

    const [totalRes, items] = await Promise.all([
      this.db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM tutoria_engajamento_aluno e
        INNER JOIN tutoria_grupo_alunos tga
          ON tga.matricula = e.matricula
          AND tga."sourceInstitution" = e."sourceInstitution"
        INNER JOIN tutoria_grupos tg
          ON tg.id = tga.grupo_id
          AND tg.slug = ${TutoriaTeologiaService.GRUPO_SLUG}
          AND tg.ativo = true
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
          COALESCE(e.enrolment_status, 'Ativo') AS enrolment_status,
          e.tempo_total_minutos,
          e.tempo_fase1_minutos,
          e.tempo_fase2_minutos,
          e.tempo_fase3_minutos,
          e.tempo_apresentacao_minutos,
          e.tempo_outros_minutos,
          e.total_cliques,
          e.total_atividades_acessadas,
          e.tempo_leitura_minutos,
          e.tempo_avaliacoes_minutos,
          e.grupo_risco_calculado,
          e.score_engajamento,
          e.data_ultimo_acesso,
          e.data_ultimo_login,
          e."updatedAt",
          g.fase1 AS nota_fase1,
          g.fase2 AS nota_fase2,
          g.fase3 AS nota_fase3
        FROM tutoria_engajamento_aluno e
        INNER JOIN tutoria_grupo_alunos tga
          ON tga.matricula = e.matricula
          AND tga."sourceInstitution" = e."sourceInstitution"
        INNER JOIN tutoria_grupos tg
          ON tg.id = tga.grupo_id
          AND tg.slug = ${TutoriaTeologiaService.GRUPO_SLUG}
          AND tg.ativo = true
        LEFT JOIN ava_grades_report g
          ON g."sourceInstitution" = e."sourceInstitution"
          AND g.user_id = e.aluno_id
          AND g.course_id = e.disciplina_id
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

  async getTeologiaDisciplinas(periodo = '2026-2', institution = 'ead') {
    await this.tutoriaService.ensureTeologiaGrupoSchema();

    const inst = (institution || 'ead').trim().toLowerCase();
    const cacheKey = `tutoria:teologia:disciplinas:${inst}:${periodo}`;
    const queryFn = () =>
      this.db.execute(sql`
        SELECT DISTINCT
          e.disciplina_id,
          e.disciplina_codigo,
          e.disciplina_nome
        FROM tutoria_engajamento_aluno e
        INNER JOIN tutoria_grupo_alunos tga
          ON tga.matricula = e.matricula
          AND tga."sourceInstitution" = e."sourceInstitution"
        INNER JOIN tutoria_grupos tg
          ON tg.id = tga.grupo_id
          AND tg.slug = ${TutoriaTeologiaService.GRUPO_SLUG}
          AND tg.ativo = true
        WHERE e."sourceInstitution" = ${inst}
          AND e.periodo = ${periodo}
          AND COALESCE(e.disciplina_codigo, '') NOT ILIKE 'SM_AVISOS%'
          AND COALESCE(e.disciplina_nome, '') NOT ILIKE '%Sala de Avisos%'
        ORDER BY e.disciplina_nome ASC;
      `);

    if (this.cacheService) {
      return this.cacheService.wrap(cacheKey, queryFn, 300);
    }
    return queryFn();
  }

  async getTeologiaExportData(filters: TeologiaEngagementFilterDto) {
    await this.tutoriaService.ensureTeologiaGrupoSchema();
    await this.tutoriaService.ensureEngajamentoColumns();

    const conditions = this.buildTeologiaConditions(filters);
    const whereClause = sql.join(conditions, sql` AND `);

    return this.db.execute(sql`
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
        COALESCE(e.enrolment_status, 'Ativo') AS enrolment_status,
        e.tempo_total_minutos,
        e.tempo_fase1_minutos,
        e.tempo_fase2_minutos,
        e.tempo_fase3_minutos,
        e.tempo_apresentacao_minutos,
        e.tempo_outros_minutos,
        e.total_cliques,
        e.total_atividades_acessadas,
        e.tempo_leitura_minutos,
        e.tempo_avaliacoes_minutos,
        e.grupo_risco_calculado,
        e.score_engajamento,
        e.data_ultimo_acesso,
        e.data_ultimo_login,
        e."updatedAt",
        g.fase1 AS nota_fase1,
        g.fase2 AS nota_fase2,
        g.fase3 AS nota_fase3
      FROM tutoria_engajamento_aluno e
      INNER JOIN tutoria_grupo_alunos tga
        ON tga.matricula = e.matricula
        AND tga."sourceInstitution" = e."sourceInstitution"
      INNER JOIN tutoria_grupos tg
        ON tg.id = tga.grupo_id
        AND tg.slug = ${TutoriaTeologiaService.GRUPO_SLUG}
        AND tg.ativo = true
      LEFT JOIN ava_grades_report g
        ON g."sourceInstitution" = e."sourceInstitution"
        AND g.user_id = e.aluno_id
        AND g.course_id = e.disciplina_id
      WHERE ${whereClause}
      ORDER BY
        CASE WHEN e.grupo_risco_calculado = 'critico' THEN 1
             WHEN e.grupo_risco_calculado = 'atencao' THEN 2
             ELSE 3 END ASC,
        COALESCE(e.tempo_total_minutos::numeric, 0) ASC
      LIMIT 5000;
    `);
  }

  private normalizeContentName(name: string): string {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2010-\u2015\u2212\u002d]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getPhaseRank(unitName?: string | null): number {
    const norm = String(unitName || '').toLowerCase();
    if (norm.includes('apresenta')) return 0;
    if (norm.startsWith('fase 1')) return 1;
    if (norm.startsWith('fase 2')) return 2;
    if (norm.startsWith('fase 3')) return 3;
    return 4;
  }

  private mergeMissingGradeActivities(
    logs: any[],
    rawGrade: any,
    disciplinaId?: string,
  ): any[] {
    if (!disciplinaId || !rawGrade) return logs;

    const existingNames = new Set(
      logs
        .map((l) => this.normalizeContentName(l?.conteudo_nome || ''))
        .filter(Boolean),
    );

    const synthetic: any[] = [];
    const phaseLists: Array<{ phase: 1 | 2 | 3; raw?: string | null }> = [
      { phase: 1, raw: rawGrade.lista_fase1 },
      { phase: 2, raw: rawGrade.lista_fase2 },
      { phase: 3, raw: rawGrade.lista_fase3 },
    ];

    for (const { phase, raw } of phaseLists) {
      if (!raw || typeof raw !== 'string') continue;
      raw.split('|').forEach((entry, idx) => {
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1) return;
        const nome = entry.slice(0, colonIdx).trim();
        if (!nome) return;

        const norm = this.normalizeContentName(nome);
        if (existingNames.has(norm)) return;

        existingNames.add(norm);
        synthetic.push({
          id: `grade-fallback-${rawGrade.course_id || disciplinaId}-f${phase}-${idx}`,
          periodo: rawGrade.periodo || null,
          disciplina_id: rawGrade.course_id || disciplinaId,
          disciplina_codigo: rawGrade.course_shortname || null,
          disciplina_nome: rawGrade.course_fullname || null,
          unidade_tematica_nome: `Fase ${phase}`,
          atividade_id: `grade-f${phase}-${idx}`,
          tipo_modulo: 'quiz',
          conteudo_nome: nome,
          qtd_cliques_acessos: 0,
          tempo_conteudo_minutos: '0',
          data_primeiro_acesso_conteudo: null,
          data_ultimo_acesso_conteudo: null,
          data_ultimo_acesso_disciplina: null,
          data_ultimo_login: null,
          updatedAt: null,
        });
      });
    }

    if (synthetic.length === 0) return logs;

    return [...logs, ...synthetic].sort(
      (a, b) =>
        this.getPhaseRank(a.unidade_tematica_nome) -
        this.getPhaseRank(b.unidade_tematica_nome),
    );
  }

  async getTeologiaStudentActivityLogs(
    matricula: string,
    disciplinaId?: string,
    institution = 'ead',
  ) {
    await this.tutoriaService.ensureTeologiaGrupoSchema();

    const cleanMat = String(matricula || '').trim();
    if (!cleanMat) {
      throw new BadRequestException('Matrícula é obrigatória.');
    }
    const inst = (institution || 'ead').trim().toLowerCase();

    const membership = (await this.db.execute(sql`
      SELECT tga.id
      FROM tutoria_grupo_alunos tga
      INNER JOIN tutoria_grupos tg ON tg.id = tga.grupo_id
      WHERE tg.slug = ${TutoriaTeologiaService.GRUPO_SLUG}
        AND tg.ativo = true
        AND tga.matricula = ${cleanMat}
        AND tga."sourceInstitution" = ${inst}
      LIMIT 1;
    `)) as any[];

    if (!membership || membership.length === 0) {
      throw new NotFoundException('Aluno não pertence ao grupo de Teologia.');
    }

    const gradeConditions = [
      sql`g."sourceInstitution" = ${inst}`,
      sql`upper(g.user_identification) = upper(${cleanMat})`,
    ];
    if (disciplinaId) {
      gradeConditions.push(sql`g.course_id = ${disciplinaId}`);
    }
    const gradeWhere = sql.join(gradeConditions, sql` AND `);

    const [catalogLogs, discenteRows, gradeRows] = await Promise.all([
      this.tutoriaService.queryStudentActivityLogsWithCatalog(
        cleanMat,
        disciplinaId,
        inst,
      ),
      this.db
        .execute(
          sql`
          SELECT telefone, email, curso_nome, unidade_fisica
          FROM academic_discente
          WHERE matricula = ${cleanMat}
          LIMIT 1;
        `,
        )
        .catch(() => []),
      this.db
        .execute(
          sql`
          SELECT
            g.fase1,
            g.fase2,
            g.fase3,
            g.lista_fase1,
            g.lista_fase2,
            g.lista_fase3,
            g.periodo,
            g.course_id,
            g.course_shortname,
            g.course_fullname
          FROM ava_grades_report g
          WHERE ${gradeWhere}
          ORDER BY g."updatedAt" DESC
          LIMIT 1;
        `,
        )
        .catch(() => []),
    ]);

    const rawGrade = (gradeRows as any[])?.[0];
    const grades = rawGrade
      ? {
          fase1: rawGrade.fase1 ?? null,
          fase2: rawGrade.fase2 ?? null,
          fase3: rawGrade.fase3 ?? null,
        }
      : null;

    const logs = this.mergeMissingGradeActivities(
      catalogLogs,
      rawGrade,
      disciplinaId,
    );

    return {
      logs,
      discente: (discenteRows as any[])?.[0] || null,
      grades,
    };
  }
}
