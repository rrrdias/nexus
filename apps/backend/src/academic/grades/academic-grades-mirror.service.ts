import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { DB_CONNECTION } from '../../db/db.provider';
import {
  academicDiscente,
  academicMatricula,
  academicOnlineMatriculas,
  academicOnlineTurmas,
  academicTurma,
  avaGradesReport,
} from '../../db/schema';
import {
  getDefaultPeriod,
  getLyceumActivePeriods,
} from '../../config/app-config';
import { SyncMirrorSummary } from './interfaces/academic-grades.types';
import {
  getPeriodVariants,
  isStrictOnlineModelagem,
  resolveEnrolmentStatus,
  resolveSourceInstitution,
} from './utils/enrolment-resolver';

@Injectable()
export class AcademicGradesMirrorService {
  private readonly logger = new Logger(AcademicGradesMirrorService.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
  ) {}

  /**
   * Espelha as turmas 100% online do Lyceum e as matrículas discentes vinculadas,
   * classificando o status (matriculado, suspenso, cancelado) e o bloqueio de lançamento.
   */
  async syncMirror100Online(
    periodo?: string,
    onProgress?: (progress: number, step: string) => Promise<void>,
  ): Promise<SyncMirrorSummary> {
    const targetPeriods =
      periodo && periodo.trim() ? [periodo.trim()] : getLyceumActivePeriods();
    const resolvedPeriods =
      targetPeriods.length > 0 ? targetPeriods : [getDefaultPeriod()];
    const periodLabel = resolvedPeriods[0];
    const allPeriodVariants = Array.from(
      new Set(resolvedPeriods.flatMap((p) => getPeriodVariants(p))),
    );

    this.logger.log(
      `Iniciando espelhamento de turmas 100% online para os períodos: ${allPeriodVariants.join(', ')}`,
    );
    if (onProgress) {
      await onProgress(10, 'Buscando turmas 100% online no catálogo Lyceum');
    }

    // 1. Buscar turmas candidatas no período e aplicar filtro estrito 100% online
    const rawTurmas = await this.db
      .select()
      .from(academicTurma)
      .where(
        and(
          inArray(academicTurma.periodo, allPeriodVariants),
          sql`(
            UPPER(TRIM(coalesce(${academicTurma.modelagem}, ''))) IN (
              'DISCIPLINA 100% ONLINE',
              'DISCIPLINA100',
              'DISCIPLINA100%ONLINE',
              '100% ONLINE',
              'DISCIPLINAS 100% ON-LINE',
              'DISCIPLINA 100% ON-LINE',
              '100% ON-LINE'
            )
            OR coalesce(${academicTurma.modelagem}, '') ~* '100\\s*%\\s*on-?line|disciplina\\s*100'
          )`,
          sql`coalesce(${academicTurma.modelagem}, '') !~* 'presencial|semipresencial|pr[aá]tica'`,
        ),
      )
      .orderBy(asc(academicTurma.turma));

    const eligibleTurmas = rawTurmas.filter((t) =>
      isStrictOnlineModelagem(t.modelagem),
    );

    if (eligibleTurmas.length === 0) {
      this.logger.log(
        'Nenhuma turma 100% online encontrada para os períodos informados.',
      );
      if (onProgress) {
        await onProgress(100, 'Nenhuma turma 100% online encontrada');
      }
      return {
        periodo: periodLabel,
        turmasEspelhadas: 0,
        matriculasSincronizadas: 0,
        totalMatriculados: 0,
        totalSuspensos: 0,
        totalCancelados: 0,
      };
    }

    const now = new Date();

    // 2. Upsert em lote das turmas 100% online espelhadas
    if (onProgress) {
      await onProgress(
        30,
        `Espelhando ${eligibleTurmas.length} turmas 100% online`,
      );
    }

    const turmaUpsertPayloads = eligibleTurmas.map((t) => ({
      id: t.id,
      turma: (t.turma || t.codTurma || t.id).trim(),
      codTurma: t.codTurma || t.turma || null,
      disciplina: (t.disciplina || t.codDisciplina || t.id).trim(),
      nomeDisciplina: (t.nomeDisciplina || t.disciplina || 'Disciplina').trim(),
      codDisciplina: t.codDisciplina || t.disciplina || null,
      curso: t.curso || null,
      cursoNome: t.cursoNome || null,
      cursoInstituicao: t.cursoInstituicao || null,
      periodo: (t.periodo || periodLabel).trim(),
      modelagem: (t.modelagem || 'DISCIPLINA 100% ONLINE').trim(),
      sourceInstitution: resolveSourceInstitution(t.cursoInstituicao),
      syncedAt: now,
      updatedAt: now,
    }));

    const TURMA_BATCH_SIZE = 500;
    for (let i = 0; i < turmaUpsertPayloads.length; i += TURMA_BATCH_SIZE) {
      const chunk = turmaUpsertPayloads.slice(i, i + TURMA_BATCH_SIZE);
      await this.db
        .insert(academicOnlineTurmas)
        .values(chunk)
        .onConflictDoUpdate({
          target: academicOnlineTurmas.id,
          set: {
            turma: sql`EXCLUDED.turma`,
            codTurma: sql`EXCLUDED.cod_turma`,
            disciplina: sql`EXCLUDED.disciplina`,
            nomeDisciplina: sql`EXCLUDED.nome_disciplina`,
            codDisciplina: sql`EXCLUDED.cod_disciplina`,
            curso: sql`EXCLUDED.curso`,
            cursoNome: sql`EXCLUDED.curso_nome`,
            cursoInstituicao: sql`EXCLUDED.curso_instituicao`,
            periodo: sql`EXCLUDED.periodo`,
            modelagem: sql`EXCLUDED.modelagem`,
            sourceInstitution: sql`EXCLUDED."sourceInstitution"`,
            syncedAt: sql`EXCLUDED.synced_at`,
            updatedAt: sql`EXCLUDED."updatedAt"`,
          },
        });
    }

    // 3. Buscar matrículas discentes vinculadas (nivel = '2') e dados dos discentes
    if (onProgress) {
      await onProgress(55, 'Carregando matrículas e status dos discentes');
    }

    const turmaIds = turmaUpsertPayloads.map((t) => t.id);
    const turmaInfoMap = new Map(turmaUpsertPayloads.map((t) => [t.id, t]));

    const rawEnrollments = await this.db
      .select({
        turmaId: academicMatricula.turmaId,
        usuarioId: academicMatricula.usuarioId,
        situacaoLyceum: academicMatricula.situacao,
        ativoLyceum: academicMatricula.ativo,
        matricula: academicDiscente.matricula,
        nome: academicDiscente.nome,
        sobrenome: academicDiscente.sobrenome,
        nomeSocial: academicDiscente.nomeSocial,
        email: academicDiscente.email,
        cpf: academicDiscente.cpf,
      })
      .from(academicMatricula)
      .innerJoin(
        academicDiscente,
        eq(academicMatricula.usuarioId, academicDiscente.id),
      )
      .where(
        and(
          inArray(academicMatricula.turmaId, turmaIds),
          eq(academicMatricula.nivel, '2'),
        ),
      )
      .orderBy(asc(academicMatricula.turmaId), asc(academicDiscente.matricula));

    // 4. Buscar eventual status no AVA para enriquecimento cruzado / fallback
    const uniqueMatriculas = Array.from(
      new Set(
        rawEnrollments.map((e) => (e.matricula || '').trim()).filter(Boolean),
      ),
    );

    const avaStatusByMatAndCourse = new Map<string, string>();
    const avaStatusByMat = new Map<string, string>();

    if (uniqueMatriculas.length > 0) {
      const MAT_QUERY_CHUNK = 1000;
      for (let i = 0; i < uniqueMatriculas.length; i += MAT_QUERY_CHUNK) {
        const matChunk = uniqueMatriculas.slice(i, i + MAT_QUERY_CHUNK);
        const avaRows = await this.db
          .select({
            userIdentification: avaGradesReport.userIdentification,
            courseFullname: avaGradesReport.courseFullname,
            courseShortname: avaGradesReport.courseShortname,
            enrolmentStatus: avaGradesReport.enrolmentStatus,
          })
          .from(avaGradesReport)
          .where(
            and(
              inArray(avaGradesReport.userIdentification, matChunk),
              inArray(avaGradesReport.periodo, allPeriodVariants),
            ),
          );

        for (const r of avaRows) {
          const mat = (r.userIdentification || '').trim();
          const st = (r.enrolmentStatus || '').trim();
          if (!mat || !st) continue;
          if (!avaStatusByMat.has(mat)) {
            avaStatusByMat.set(mat, st);
          }
          const fullKey = `${mat}::${(r.courseFullname || '').trim().toLowerCase()}`;
          avaStatusByMatAndCourse.set(fullKey, st);
        }
      }
    }

    // 5. Montar registros normalizados e deduplicados por (turmaId, matricula)
    const dedupEnrollments = new Map<string, any>();
    for (const row of rawEnrollments) {
      const turmaMeta = turmaInfoMap.get(row.turmaId);
      const matriculaCode = (row.matricula || row.usuarioId || '').trim();
      if (!turmaMeta || !matriculaCode) continue;

      const fullName = (
        row.nomeSocial ||
        `${row.nome || ''} ${row.sobrenome || ''}`.trim() ||
        matriculaCode
      ).trim();

      let enrolmentStatusAva: string | null = null;
      const turmaToken = turmaMeta.turma.toLowerCase();
      for (const [k, v] of avaStatusByMatAndCourse.entries()) {
        if (k.startsWith(`${matriculaCode}::`) && k.includes(turmaToken)) {
          enrolmentStatusAva = v;
          break;
        }
      }
      if (!enrolmentStatusAva) {
        enrolmentStatusAva = avaStatusByMat.get(matriculaCode) || null;
      }

      const resolved = resolveEnrolmentStatus(
        row.situacaoLyceum,
        row.ativoLyceum,
        enrolmentStatusAva,
      );

      dedupEnrollments.set(`${row.turmaId}::${matriculaCode}`, {
        turmaId: row.turmaId,
        usuarioId: row.usuarioId,
        matricula: matriculaCode,
        nomeAluno: fullName,
        emailAluno: row.email || null,
        cpfAluno: row.cpf || null,
        periodo: turmaMeta.periodo,
        situacaoLyceum: row.situacaoLyceum || null,
        ativoLyceum: row.ativoLyceum || null,
        statusMatricula: resolved.statusMatricula,
        enrolmentStatusAva,
        bloqueioLancamento: resolved.bloqueioLancamento,
        syncedAt: now,
        updatedAt: now,
      });
    }

    const matriculaPayloads = Array.from(dedupEnrollments.values()).sort(
      (a, b) =>
        a.turmaId.localeCompare(b.turmaId) ||
        a.matricula.localeCompare(b.matricula),
    );

    if (onProgress) {
      await onProgress(
        75,
        `Gravando ${matriculaPayloads.length} matrículas espelhadas`,
      );
    }

    // Calcular contadores por turma e totais globais
    const countsByTurma = new Map<
      string,
      { total: number; mat: number; susp: number; canc: number }
    >();
    let totalMatriculados = 0;
    let totalSuspensos = 0;
    let totalCancelados = 0;

    for (const tId of turmaIds) {
      countsByTurma.set(tId, { total: 0, mat: 0, susp: 0, canc: 0 });
    }
    for (const item of matriculaPayloads) {
      const c = countsByTurma.get(item.turmaId) || {
        total: 0,
        mat: 0,
        susp: 0,
        canc: 0,
      };
      c.total++;
      if (item.statusMatricula === 'matriculado') {
        c.mat++;
        totalMatriculados++;
      } else if (item.statusMatricula === 'suspenso') {
        c.susp++;
        totalSuspensos++;
      } else if (item.statusMatricula === 'cancelado') {
        c.canc++;
        totalCancelados++;
      }
      countsByTurma.set(item.turmaId, c);
    }

    // 6. Persistir matrículas e atualizar totalizadores em transação atômica
    await this.db.transaction(async (tx) => {
      const MAT_BATCH_SIZE = 500;
      for (let i = 0; i < matriculaPayloads.length; i += MAT_BATCH_SIZE) {
        const chunk = matriculaPayloads.slice(i, i + MAT_BATCH_SIZE);
        await tx
          .insert(academicOnlineMatriculas)
          .values(chunk)
          .onConflictDoUpdate({
            target: [
              academicOnlineMatriculas.turmaId,
              academicOnlineMatriculas.matricula,
            ],
            set: {
              usuarioId: sql`EXCLUDED.usuario_id`,
              nomeAluno: sql`EXCLUDED.nome_aluno`,
              emailAluno: sql`EXCLUDED.email_aluno`,
              cpfAluno: sql`EXCLUDED.cpf_aluno`,
              periodo: sql`EXCLUDED.periodo`,
              situacaoLyceum: sql`EXCLUDED.situacao_lyceum`,
              ativoLyceum: sql`EXCLUDED.ativo_lyceum`,
              statusMatricula: sql`EXCLUDED.status_matricula`,
              enrolmentStatusAva: sql`EXCLUDED.enrolment_status_ava`,
              bloqueioLancamento: sql`EXCLUDED.bloqueio_lancamento`,
              syncedAt: sql`EXCLUDED.synced_at`,
              updatedAt: sql`EXCLUDED."updatedAt"`,
            },
          });
      }

      for (const [turmaId, counts] of countsByTurma.entries()) {
        await tx
          .update(academicOnlineTurmas)
          .set({
            totalAlunos: counts.total,
            totalMatriculados: counts.mat,
            totalSuspensos: counts.susp,
            totalCancelados: counts.canc,
            updatedAt: now,
          })
          .where(eq(academicOnlineTurmas.id, turmaId));
      }
    });

    if (onProgress) {
      await onProgress(
        100,
        `Espelhamento concluído: ${turmaUpsertPayloads.length} turmas e ${matriculaPayloads.length} matrículas`,
      );
    }

    this.logger.log(
      `Espelhamento finalizado: ${turmaUpsertPayloads.length} turmas, ${matriculaPayloads.length} matrículas (${totalMatriculados} matriculados, ${totalSuspensos} suspensos, ${totalCancelados} cancelados).`,
    );

    return {
      periodo: periodLabel,
      turmasEspelhadas: turmaUpsertPayloads.length,
      matriculasSincronizadas: matriculaPayloads.length,
      totalMatriculados,
      totalSuspensos,
      totalCancelados,
    };
  }
}
