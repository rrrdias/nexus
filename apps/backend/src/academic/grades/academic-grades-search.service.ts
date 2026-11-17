import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { DB_CONNECTION } from '../../db/db.provider';
import {
  academicOnlineMatriculas,
  academicOnlineNotas,
  academicOnlineTurmas,
  avaConsolidatedReport,
  avaGradesReport,
} from '../../db/schema';
import {
  GradesTurmasQuery,
  ParsedGradeActivity,
  StudentGradeRow,
  TurmaGradesSummaryItem,
  TurmaStudentsQuery,
} from './interfaces/academic-grades.types';
import {
  detectCohortPhaseScale,
  normalizeGrade,
} from './utils/grade-normalizer';
import {
  classifyActivityPhase,
  detectListaNotasTruncated,
  parseActivities,
} from './utils/activity-parser';
import {
  getCandidateSourceInstitutions,
  getPeriodVariants,
} from './utils/enrolment-resolver';

function parseStoredItems(
  rawJson: string | null | undefined,
): ParsedGradeActivity[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

@Injectable()
export class AcademicGradesSearchService {
  private readonly logger = new Logger(AcademicGradesSearchService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
  ) {}

  /**
   * Correlaciona os estudantes espelhados de uma turma 100% online com os snapshots
   * locais de ava_grades_report (e fallback em ava_consolidated_report),
   * normalizando VA1, VA2, VA3 e Média Final para a escala institucional (0.00–10.00).
   */
  async correlateGradesForTurma(
    turmaId: string,
  ): Promise<{ turmaId: string; updatedCount: number }> {
    this.logger.log(`Iniciando correlação de notas para a turma ${turmaId}`);

    // 1. Buscar matrículas elegíveis (matriculados e suspensos para acompanhamento; cancelados descartados)
    const matriculas = await this.db
      .select({
        matriculaId: academicOnlineMatriculas.id,
        turmaId: academicOnlineMatriculas.turmaId,
        matricula: academicOnlineMatriculas.matricula,
        turmaCodigo: academicOnlineTurmas.turma,
        periodo: academicOnlineTurmas.periodo,
        sourceInstitution: academicOnlineTurmas.sourceInstitution,
      })
      .from(academicOnlineMatriculas)
      .innerJoin(
        academicOnlineTurmas,
        eq(academicOnlineTurmas.id, academicOnlineMatriculas.turmaId),
      )
      .where(
        and(
          eq(academicOnlineMatriculas.turmaId, turmaId),
          ne(academicOnlineMatriculas.statusMatricula, 'cancelado'),
        ),
      )
      .orderBy(asc(academicOnlineMatriculas.matricula));

    if (matriculas.length === 0) {
      this.logger.log(
        `Nenhuma matrícula elegível encontrada para correlação na turma ${turmaId}`,
      );
      return { turmaId, updatedCount: 0 };
    }

    const matriculaCodes = matriculas.map((m) => m.matricula);
    const turmaCodigo = matriculas[0].turmaCodigo;
    const periodVariants = getPeriodVariants(matriculas[0].periodo);
    const primaryInst = matriculas[0].sourceInstitution || 'ead';
    const candidateInstitutions = getCandidateSourceInstitutions(primaryInst);

    // 2. Consultar ava_grades_report por matrícula, variantes de período, instituição e código da turma
    const avaRecords = await this.db
      .select()
      .from(avaGradesReport)
      .where(
        and(
          inArray(avaGradesReport.userIdentification, matriculaCodes),
          inArray(avaGradesReport.periodo, periodVariants),
          inArray(avaGradesReport.sourceInstitution, candidateInstitutions),
          or(
            sql`${avaGradesReport.courseFullname} ILIKE '%' || ${turmaCodigo} || '%'`,
            sql`${avaGradesReport.courseShortname} ILIKE '%' || ${turmaCodigo} || '%'`,
          ),
        ),
      )
      .orderBy(desc(avaGradesReport.updatedAt));

    // Prioriza registros da instituição primária antes de eventuais fallbacks e mantém o mais recente
    const avaMap = new Map<string, (typeof avaRecords)[number]>();
    const sortedAvaRecords = [...avaRecords].sort((a, b) => {
      const aPrimary = a.sourceInstitution === primaryInst ? 0 : 1;
      const bPrimary = b.sourceInstitution === primaryInst ? 0 : 1;
      return aPrimary - bPrimary;
    });
    for (const record of sortedAvaRecords) {
      const key = (record.userIdentification || '').trim();
      if (key && !avaMap.has(key)) {
        avaMap.set(key, record);
      }
    }

    // 2b. Fallback em ava_consolidated_report para estudantes ausentes em ava_grades_report
    const missingMats = matriculaCodes.filter((mat) => !avaMap.has(mat));
    const consolidatedMap = new Map<
      string,
      typeof avaConsolidatedReport.$inferSelect
    >();

    if (missingMats.length > 0) {
      const consRecords = await this.db
        .select()
        .from(avaConsolidatedReport)
        .where(
          and(
            inArray(avaConsolidatedReport.matricula, missingMats),
            inArray(avaConsolidatedReport.periodo, periodVariants),
            inArray(
              avaConsolidatedReport.sourceInstitution,
              candidateInstitutions,
            ),
            sql`${avaConsolidatedReport.curso} ILIKE '%' || ${turmaCodigo} || '%'`,
          ),
        )
        .orderBy(desc(avaConsolidatedReport.updatedAt));

      for (const cRec of consRecords) {
        const key = (cRec.matricula || '').trim();
        if (key && !consolidatedMap.has(key)) {
          consolidatedMap.set(key, cRec);
        }
      }
    }

    // 3. Resolução de Escala no nível da Turma/Cohort por fase (evita inversão de notas <= 10.0 e contaminação entre fases)
    const allF1Raw: (string | null | undefined)[] = [];
    const allF2Raw: (string | null | undefined)[] = [];
    const allF3Raw: (string | null | undefined)[] = [];
    const allMediaRaw: (string | null | undefined)[] = [];
    let maxPhase1Grade: number | null = null;
    let maxPhase2Grade: number | null = null;
    let maxPhase3Grade: number | null = null;

    for (const m of matriculas) {
      const g = avaMap.get(m.matricula);
      const c = consolidatedMap.get(m.matricula);
      allF1Raw.push(g?.fase1 ?? c?.notaFase1);
      allF2Raw.push(g?.fase2 ?? c?.notaFase2);
      allF3Raw.push(g?.fase3 ?? c?.notaFase3);
      allMediaRaw.push(g?.media ?? c?.mediaFinal);

      const rawLista = g?.listaNotas ?? c?.listaNotas;
      if (rawLista) {
        for (const act of parseActivities(rawLista)) {
          const parsedMax = act.notaMax
            ? parseFloat(act.notaMax.replace(',', '.'))
            : NaN;
          if (!isNaN(parsedMax)) {
            const phase = classifyActivityPhase(act.nome);
            if (phase === 1) {
              maxPhase1Grade =
                maxPhase1Grade === null
                  ? parsedMax
                  : Math.max(maxPhase1Grade, parsedMax);
            } else if (phase === 2) {
              maxPhase2Grade =
                maxPhase2Grade === null
                  ? parsedMax
                  : Math.max(maxPhase2Grade, parsedMax);
            } else {
              maxPhase3Grade =
                maxPhase3Grade === null
                  ? parsedMax
                  : Math.max(maxPhase3Grade, parsedMax);
            }
          }
        }
      }
    }

    const fase1Scale = detectCohortPhaseScale(allF1Raw, maxPhase1Grade);
    const fase2Scale = detectCohortPhaseScale(allF2Raw, maxPhase2Grade);
    const fase3Scale = detectCohortPhaseScale(allF3Raw, maxPhase3Grade);
    const mediaScale = detectCohortPhaseScale(allMediaRaw);

    // 4. Montar payload determinístico para academic_online_nota
    const now = new Date();
    const upsertRows = matriculas.map((m) => {
      const ava = avaMap.get(m.matricula);
      const cons = consolidatedMap.get(m.matricula);
      const hasAnySource = Boolean(ava || cons);

      const rawF1 = ava?.fase1 ?? cons?.notaFase1 ?? null;
      const rawF2 = ava?.fase2 ?? cons?.notaFase2 ?? null;
      const rawF3 = ava?.fase3 ?? cons?.notaFase3 ?? null;
      const rawMedia = ava?.media ?? cons?.mediaFinal ?? null;
      const rawLista = ava?.listaNotas ?? cons?.listaNotas ?? null;

      const va1Norm = normalizeGrade(rawF1, fase1Scale);
      const va2Norm = normalizeGrade(rawF2, fase2Scale);
      const va3Norm = normalizeGrade(rawF3, fase3Scale);
      const mediaNorm = normalizeGrade(rawMedia, mediaScale);

      let itensVa1Json: string | null = null;
      let itensVa2Json: string | null = null;
      let itensVa3Json: string | null = null;
      let divergenciaMotivo: string | null = null;

      if (rawLista) {
        if (detectListaNotasTruncated(rawLista)) {
          divergenciaMotivo = 'lista_notas_truncada';
        }

        const activities = parseActivities(rawLista);
        const f1Activities = activities
          .filter((a) => classifyActivityPhase(a.nome) === 1)
          .map((a) => ({ ...a, fase: 1 as const }));
        const f2Activities = activities
          .filter((a) => classifyActivityPhase(a.nome) === 2)
          .map((a) => ({ ...a, fase: 2 as const }));
        const f3Activities = activities
          .filter((a) => classifyActivityPhase(a.nome) === 3)
          .map((a) => ({ ...a, fase: 3 as const }));

        itensVa1Json =
          f1Activities.length > 0 ? JSON.stringify(f1Activities) : null;
        itensVa2Json =
          f2Activities.length > 0 ? JSON.stringify(f2Activities) : null;
        itensVa3Json =
          f3Activities.length > 0 ? JSON.stringify(f3Activities) : null;
      }

      return {
        turmaId: m.turmaId,
        matriculaId: m.matriculaId,
        matricula: m.matricula,
        sourceInstitution:
          ava?.sourceInstitution || cons?.sourceInstitution || primaryInst,
        moodleCourseId: ava?.courseId || null,
        moodleUserId: ava?.userId || cons?.alunoId || null,
        va1Raw: rawF1,
        va2Raw: rawF2,
        va3Raw: rawF3,
        mediaRaw: rawMedia,
        va1Nota:
          va1Norm.numericGrade !== null ? String(va1Norm.numericGrade) : null,
        va2Nota:
          va2Norm.numericGrade !== null ? String(va2Norm.numericGrade) : null,
        va3Nota:
          va3Norm.numericGrade !== null ? String(va3Norm.numericGrade) : null,
        mediaFinalNota:
          mediaNorm.numericGrade !== null
            ? String(mediaNorm.numericGrade)
            : null,
        va1Status: va1Norm.status,
        va2Status: va2Norm.status,
        va3Status: va3Norm.status,
        itensVa1: itensVa1Json,
        itensVa2: itensVa2Json,
        itensVa3: itensVa3Json,
        rawListaNotas: rawLista,
        statusConsolidacao: hasAnySource
          ? divergenciaMotivo
            ? 'divergente'
            : 'sincronizado'
          : 'pendente',
        divergenciaMotivo,
        lastAvaSyncAt: ava?.updatedAt || cons?.updatedAt || null,
        updatedAt: now,
      };
    });

    // Metadados do curso Moodle para associar à turma
    const matchedAvaWithCourse = avaRecords.find(
      (r) => r.courseId || r.courseFullname,
    );

    // 5. Persistência ordenada em lotes (chunks de 250) com idempotência estrita
    const BATCH_SIZE = 250;
    for (let i = 0; i < upsertRows.length; i += BATCH_SIZE) {
      const chunk = upsertRows.slice(i, i + BATCH_SIZE);
      await this.db
        .insert(academicOnlineNotas)
        .values(chunk)
        .onConflictDoUpdate({
          target: [academicOnlineNotas.turmaId, academicOnlineNotas.matricula],
          set: {
            sourceInstitution: sql`EXCLUDED."sourceInstitution"`,
            moodleCourseId: sql`EXCLUDED.moodle_course_id`,
            moodleUserId: sql`EXCLUDED.moodle_user_id`,
            va1Raw: sql`EXCLUDED.va1_raw`,
            va2Raw: sql`EXCLUDED.va2_raw`,
            va3Raw: sql`EXCLUDED.va3_raw`,
            mediaRaw: sql`EXCLUDED.media_raw`,
            va1Nota: sql`EXCLUDED.va1_nota`,
            va2Nota: sql`EXCLUDED.va2_nota`,
            va3Nota: sql`EXCLUDED.va3_nota`,
            mediaFinalNota: sql`EXCLUDED.media_final_nota`,
            va1Status: sql`EXCLUDED.va1_status`,
            va2Status: sql`EXCLUDED.va2_status`,
            va3Status: sql`EXCLUDED.va3_status`,
            itensVa1: sql`EXCLUDED.itens_va1`,
            itensVa2: sql`EXCLUDED.itens_va2`,
            itensVa3: sql`EXCLUDED.itens_va3`,
            rawListaNotas: sql`EXCLUDED.raw_lista_notas`,
            statusConsolidacao: sql`EXCLUDED.status_consolidacao`,
            divergenciaMotivo: sql`EXCLUDED.divergencia_motivo`,
            lastAvaSyncAt: sql`EXCLUDED.last_ava_sync_at`,
            updatedAt: sql`EXCLUDED."updatedAt"`,
          },
        });
    }

    if (matchedAvaWithCourse) {
      await this.db
        .update(academicOnlineTurmas)
        .set({
          moodleCourseId: matchedAvaWithCourse.courseId || null,
          moodleCourseFullname: matchedAvaWithCourse.courseFullname || null,
          updatedAt: now,
        })
        .where(eq(academicOnlineTurmas.id, turmaId));
    }

    this.logger.log(
      `Correlação da turma ${turmaId} finalizada: ${upsertRows.length} registros processados.`,
    );
    return { turmaId, updatedCount: upsertRows.length };
  }

  /**
   * Executa a correlação de notas para todas as turmas 100% online espelhadas no período.
   */
  async correlateAllOnlineTurmas(
    periodo?: string,
    onProgress?: (progress: number, step: string) => Promise<void>,
  ): Promise<{ turmasProcessadas: number; registrosAtualizados: number }> {
    const conditions: any[] = [];
    if (periodo && periodo.trim()) {
      conditions.push(
        inArray(academicOnlineTurmas.periodo, getPeriodVariants(periodo)),
      );
    }

    const turmas = await this.db
      .select({
        id: academicOnlineTurmas.id,
        turma: academicOnlineTurmas.turma,
      })
      .from(academicOnlineTurmas)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(academicOnlineTurmas.turma));

    let totalUpdated = 0;
    for (let i = 0; i < turmas.length; i++) {
      const t = turmas[i];
      const res = await this.correlateGradesForTurma(t.id);
      totalUpdated += res.updatedCount;

      if (onProgress && (i % 5 === 0 || i === turmas.length - 1)) {
        const pct = Math.round(((i + 1) / Math.max(1, turmas.length)) * 100);
        await onProgress(
          pct,
          `Correlacionando notas (${i + 1}/${turmas.length}): ${t.turma}`,
        );
      }
    }

    return {
      turmasProcessadas: turmas.length,
      registrosAtualizados: totalUpdated,
    };
  }

  /**
   * Lista turmas 100% online espelhadas com paginação e totalizadores de notas lançadas.
   */
  async listOnlineTurmas(query: GradesTurmasQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];
    if (query.periodo && query.periodo.trim()) {
      conditions.push(
        inArray(academicOnlineTurmas.periodo, getPeriodVariants(query.periodo)),
      );
    }
    if (query.instituicao && query.instituicao.trim()) {
      conditions.push(
        eq(
          academicOnlineTurmas.sourceInstitution,
          query.instituicao.trim().toLowerCase(),
        ),
      );
    }
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(academicOnlineTurmas.turma, s),
          ilike(academicOnlineTurmas.nomeDisciplina, s),
          ilike(academicOnlineTurmas.disciplina, s),
          ilike(academicOnlineTurmas.cursoNome, s),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(academicOnlineTurmas)
      .where(whereClause);

    const total = Number(countRes?.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const turmasRows =
      total > 0
        ? await this.db
            .select()
            .from(academicOnlineTurmas)
            .where(whereClause)
            .orderBy(
              desc(academicOnlineTurmas.periodo),
              asc(academicOnlineTurmas.nomeDisciplina),
              asc(academicOnlineTurmas.turma),
            )
            .limit(pageSize)
            .offset(offset)
        : [];

    const turmaIds = turmasRows.map((t) => t.id);
    const gradeCountsMap = new Map<
      string,
      { va1: number; va2: number; va3: number }
    >();

    if (turmaIds.length > 0) {
      const countsRows = await this.db
        .select({
          turmaId: academicOnlineNotas.turmaId,
          va1: sql<number>`count(case when ${academicOnlineNotas.va1Status} = 'Lançada' then 1 end)`,
          va2: sql<number>`count(case when ${academicOnlineNotas.va2Status} = 'Lançada' then 1 end)`,
          va3: sql<number>`count(case when ${academicOnlineNotas.va3Status} = 'Lançada' then 1 end)`,
        })
        .from(academicOnlineNotas)
        .where(inArray(academicOnlineNotas.turmaId, turmaIds))
        .groupBy(academicOnlineNotas.turmaId);

      for (const c of countsRows) {
        gradeCountsMap.set(c.turmaId, {
          va1: Number(c.va1 || 0),
          va2: Number(c.va2 || 0),
          va3: Number(c.va3 || 0),
        });
      }
    }

    const data: TurmaGradesSummaryItem[] = turmasRows.map((t) => {
      const counts = gradeCountsMap.get(t.id) || { va1: 0, va2: 0, va3: 0 };
      return {
        id: t.id,
        turma: t.turma,
        codTurma: t.codTurma,
        disciplina: t.disciplina,
        nomeDisciplina: t.nomeDisciplina,
        codDisciplina: t.codDisciplina,
        curso: t.curso,
        cursoNome: t.cursoNome,
        cursoInstituicao: t.cursoInstituicao,
        periodo: t.periodo,
        modelagem: t.modelagem,
        sourceInstitution: t.sourceInstitution,
        moodleCourseId: t.moodleCourseId,
        moodleCourseFullname: t.moodleCourseFullname,
        totalAlunos: t.totalAlunos,
        totalMatriculados: t.totalMatriculados,
        totalSuspensos: t.totalSuspensos,
        totalCancelados: t.totalCancelados,
        totalNotasLancadasVa1: counts.va1,
        totalNotasLancadasVa2: counts.va2,
        totalNotasLancadasVa3: counts.va3,
        syncedAt: t.syncedAt,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  }

  /**
   * Retorna os metadados e o resumo estatístico de uma turma 100% online.
   */
  async getTurmaDetails(turmaId: string): Promise<TurmaGradesSummaryItem> {
    const [turma] = await this.db
      .select()
      .from(academicOnlineTurmas)
      .where(eq(academicOnlineTurmas.id, turmaId))
      .limit(1);

    if (!turma) {
      throw new NotFoundException(
        `Turma 100% online ${turmaId} não encontrada no espelho.`,
      );
    }

    const [counts] = await this.db
      .select({
        va1: sql<number>`count(case when ${academicOnlineNotas.va1Status} = 'Lançada' then 1 end)`,
        va2: sql<number>`count(case when ${academicOnlineNotas.va2Status} = 'Lançada' then 1 end)`,
        va3: sql<number>`count(case when ${academicOnlineNotas.va3Status} = 'Lançada' then 1 end)`,
      })
      .from(academicOnlineNotas)
      .where(eq(academicOnlineNotas.turmaId, turmaId));

    return {
      ...turma,
      totalNotasLancadasVa1: Number(counts?.va1 || 0),
      totalNotasLancadasVa2: Number(counts?.va2 || 0),
      totalNotasLancadasVa3: Number(counts?.va3 || 0),
    };
  }

  /**
   * Retorna os alunos espelhados de uma turma e suas notas normalizadas VA1, VA2, VA3.
   */
  async getTurmaGradesWithStudents(
    turmaId: string,
    query: TurmaStudentsQuery = {},
  ) {
    const turma = await this.getTurmaDetails(turmaId);

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 100));
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [eq(academicOnlineMatriculas.turmaId, turmaId)];

    if (query.statusMatricula && query.statusMatricula !== 'todos') {
      conditions.push(
        eq(academicOnlineMatriculas.statusMatricula, query.statusMatricula),
      );
    }

    if (query.statusNota === 'lancada') {
      conditions.push(
        or(
          eq(academicOnlineNotas.va1Status, 'Lançada'),
          eq(academicOnlineNotas.va2Status, 'Lançada'),
          eq(academicOnlineNotas.va3Status, 'Lançada'),
        ),
      );
    } else if (query.statusNota === 'pendente') {
      conditions.push(
        or(
          sql`${academicOnlineNotas.id} IS NULL`,
          and(
            ne(academicOnlineNotas.va1Status, 'Lançada'),
            ne(academicOnlineNotas.va2Status, 'Lançada'),
            ne(academicOnlineNotas.va3Status, 'Lançada'),
          ),
        ),
      );
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(academicOnlineMatriculas.nomeAluno, s),
          ilike(academicOnlineMatriculas.matricula, s),
          ilike(academicOnlineMatriculas.emailAluno, s),
        ),
      );
    }

    const whereClause = and(...conditions);

    const [countRes] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(academicOnlineMatriculas)
      .leftJoin(
        academicOnlineNotas,
        eq(academicOnlineNotas.matriculaId, academicOnlineMatriculas.id),
      )
      .where(whereClause);

    const total = Number(countRes?.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const rows =
      total > 0
        ? await this.db
            .select({
              mat: academicOnlineMatriculas,
              nota: academicOnlineNotas,
            })
            .from(academicOnlineMatriculas)
            .leftJoin(
              academicOnlineNotas,
              eq(academicOnlineNotas.matriculaId, academicOnlineMatriculas.id),
            )
            .where(whereClause)
            .orderBy(asc(academicOnlineMatriculas.nomeAluno))
            .limit(pageSize)
            .offset(offset)
        : [];

    const alunos: StudentGradeRow[] = rows.map(({ mat, nota }) => ({
      matriculaId: mat.id,
      turmaId: mat.turmaId,
      matricula: mat.matricula,
      nomeAluno: mat.nomeAluno,
      emailAluno: mat.emailAluno,
      cpfAluno: mat.cpfAluno,
      statusMatricula: mat.statusMatricula as any,
      situacaoLyceum: mat.situacaoLyceum,
      ativoLyceum: mat.ativoLyceum,
      enrolmentStatusAva: mat.enrolmentStatusAva,
      bloqueioLancamento: mat.bloqueioLancamento,
      notas: {
        va1:
          nota?.va1Nota !== null && nota?.va1Nota !== undefined
            ? Number(nota.va1Nota)
            : null,
        va1Raw: nota?.va1Raw || null,
        va1Status: (nota?.va1Status as any) || 'Pendente',
        va2:
          nota?.va2Nota !== null && nota?.va2Nota !== undefined
            ? Number(nota.va2Nota)
            : null,
        va2Raw: nota?.va2Raw || null,
        va2Status: (nota?.va2Status as any) || 'Pendente',
        va3:
          nota?.va3Nota !== null && nota?.va3Nota !== undefined
            ? Number(nota.va3Nota)
            : null,
        va3Raw: nota?.va3Raw || null,
        va3Status: (nota?.va3Status as any) || 'Pendente',
        mediaFinal:
          nota?.mediaFinalNota !== null && nota?.mediaFinalNota !== undefined
            ? Number(nota.mediaFinalNota)
            : null,
        mediaRaw: nota?.mediaRaw || null,
        itensVa1: parseStoredItems(nota?.itensVa1),
        itensVa2: parseStoredItems(nota?.itensVa2),
        itensVa3: parseStoredItems(nota?.itensVa3),
        statusConsolidacao: (nota?.statusConsolidacao as any) || 'pendente',
        divergenciaMotivo: nota?.divergenciaMotivo || null,
        lastAvaSyncAt: nota?.lastAvaSyncAt || null,
      },
    }));

    return {
      turma,
      alunos,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  }

  /**
   * Retorna todas as turmas online e respectivas notas de uma matrícula específica.
   */
  async getStudentGradesHistory(matricula: string, periodo?: string) {
    const trimmed = (matricula || '').trim();
    const conditions: any[] = [
      ilike(academicOnlineMatriculas.matricula, trimmed),
    ];
    if (periodo && periodo.trim()) {
      conditions.push(
        inArray(academicOnlineMatriculas.periodo, getPeriodVariants(periodo)),
      );
    }

    const rows = await this.db
      .select({
        mat: academicOnlineMatriculas,
        turma: academicOnlineTurmas,
        nota: academicOnlineNotas,
      })
      .from(academicOnlineMatriculas)
      .innerJoin(
        academicOnlineTurmas,
        eq(academicOnlineTurmas.id, academicOnlineMatriculas.turmaId),
      )
      .leftJoin(
        academicOnlineNotas,
        eq(academicOnlineNotas.matriculaId, academicOnlineMatriculas.id),
      )
      .where(and(...conditions))
      .orderBy(
        desc(academicOnlineTurmas.periodo),
        asc(academicOnlineTurmas.nomeDisciplina),
      );

    return rows.map(({ mat, turma, nota }) => ({
      turmaId: turma.id,
      turma: turma.turma,
      disciplina: turma.disciplina,
      nomeDisciplina: turma.nomeDisciplina,
      periodo: turma.periodo,
      statusMatricula: mat.statusMatricula,
      bloqueioLancamento: mat.bloqueioLancamento,
      va1:
        nota?.va1Nota !== null && nota?.va1Nota !== undefined
          ? Number(nota.va1Nota)
          : null,
      va2:
        nota?.va2Nota !== null && nota?.va2Nota !== undefined
          ? Number(nota.va2Nota)
          : null,
      va3:
        nota?.va3Nota !== null && nota?.va3Nota !== undefined
          ? Number(nota.va3Nota)
          : null,
      mediaFinal:
        nota?.mediaFinalNota !== null && nota?.mediaFinalNota !== undefined
          ? Number(nota.mediaFinalNota)
          : null,
      va1Status: nota?.va1Status || 'Pendente',
      va2Status: nota?.va2Status || 'Pendente',
      va3Status: nota?.va3Status || 'Pendente',
      statusConsolidacao: nota?.statusConsolidacao || 'pendente',
      divergenciaMotivo: nota?.divergenciaMotivo || null,
      itensVa1: parseStoredItems(nota?.itensVa1),
      itensVa2: parseStoredItems(nota?.itensVa2),
      itensVa3: parseStoredItems(nota?.itensVa3),
    }));
  }

  /**
   * Extrai dados estruturados de notas online para geração de relatório CSV/XLSX.
   */
  async exportGradesData(
    filters: GradesTurmasQuery & {
      turmaId?: string;
      statusMatricula?: string;
    } = {},
  ) {
    const conditions: any[] = [];
    if (filters.turmaId && filters.turmaId.trim()) {
      conditions.push(eq(academicOnlineTurmas.id, filters.turmaId.trim()));
    }
    if (filters.periodo && filters.periodo.trim()) {
      conditions.push(
        inArray(
          academicOnlineTurmas.periodo,
          getPeriodVariants(filters.periodo),
        ),
      );
    }
    if (filters.statusMatricula && filters.statusMatricula !== 'todos') {
      conditions.push(
        eq(academicOnlineMatriculas.statusMatricula, filters.statusMatricula),
      );
    }
    if (filters.search && filters.search.trim()) {
      const s = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(academicOnlineTurmas.turma, s),
          ilike(academicOnlineTurmas.nomeDisciplina, s),
          ilike(academicOnlineMatriculas.nomeAluno, s),
          ilike(academicOnlineMatriculas.matricula, s),
        ),
      );
    }

    const rows = await this.db
      .select({
        turma: academicOnlineTurmas.turma,
        disciplina: academicOnlineTurmas.nomeDisciplina,
        periodo: academicOnlineTurmas.periodo,
        matricula: academicOnlineMatriculas.matricula,
        nomeAluno: academicOnlineMatriculas.nomeAluno,
        emailAluno: academicOnlineMatriculas.emailAluno,
        situacaoLyceum: academicOnlineMatriculas.situacaoLyceum,
        statusMatricula: academicOnlineMatriculas.statusMatricula,
        bloqueioLancamento: academicOnlineMatriculas.bloqueioLancamento,
        va1Nota: academicOnlineNotas.va1Nota,
        va1Status: academicOnlineNotas.va1Status,
        va2Nota: academicOnlineNotas.va2Nota,
        va2Status: academicOnlineNotas.va2Status,
        va3Nota: academicOnlineNotas.va3Nota,
        va3Status: academicOnlineNotas.va3Status,
        mediaFinalNota: academicOnlineNotas.mediaFinalNota,
        statusConsolidacao: academicOnlineNotas.statusConsolidacao,
        divergenciaMotivo: academicOnlineNotas.divergenciaMotivo,
      })
      .from(academicOnlineMatriculas)
      .innerJoin(
        academicOnlineTurmas,
        eq(academicOnlineTurmas.id, academicOnlineMatriculas.turmaId),
      )
      .leftJoin(
        academicOnlineNotas,
        eq(academicOnlineNotas.matriculaId, academicOnlineMatriculas.id),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        asc(academicOnlineTurmas.turma),
        asc(academicOnlineMatriculas.nomeAluno),
      )
      .limit(20000);

    return rows;
  }
}
