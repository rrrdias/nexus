import { Injectable, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';

import { eq, ilike, and, inArray, or, isNull, isNotNull, not, sql, desc, asc } from 'drizzle-orm';

import { avaProgressReport, avaGradesReport, systemModules, usersSystemAccess, userGroups, groupSystemAccess } from '../db/schema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { AvaSyncService } from '../ava-sync/ava-sync.service';

type SessionUser = {
  id?: string;
  isSuperAdmin?: boolean;
  isDisabled?: boolean;
};

@Injectable()
export class AvaReportsService {
  private readonly termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"];

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private readonly avaSyncService: AvaSyncService,
  ) {}


  async assertAvaAccess(user?: SessionUser) {
    if (!user?.id || user.isDisabled) {
      throw new UnauthorizedException("Acesso negado.");
    }

    if (user.isSuperAdmin) return;

    const directAccess = await this.db.select({ id: systemModules.id })
      .from(usersSystemAccess)
      .innerJoin(systemModules, eq(usersSystemAccess.systemModuleId, systemModules.id))
      .where(and(
        eq(usersSystemAccess.userId, user.id),
        eq(systemModules.slug, "ava"),
        eq(systemModules.isActive, true)
      ))
      .limit(1);

    if (directAccess.length > 0) return;

    const groupAccess = await this.db.select({ id: systemModules.id })
      .from(userGroups)
      .innerJoin(groupSystemAccess, eq(userGroups.groupId, groupSystemAccess.groupId))
      .innerJoin(systemModules, eq(groupSystemAccess.systemModuleId, systemModules.id))
      .where(and(
        eq(userGroups.userId, user.id),
        eq(systemModules.slug, "ava"),
        eq(systemModules.isActive, true)
      ))
      .limit(1);

    if (groupAccess.length === 0) {
      throw new UnauthorizedException("Acesso negado.");
    }
  }

  private parseProgress(value: any) {
    if (value === null || value === undefined || value === "" || value === "-") return null;
    const parsed = parseFloat(String(value).replace("%", "").replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  }

  private calculateFaseStatus(mediaFase: number, dataInicio: Date, dataFim: Date) {
    const hoje = new Date();
    if (hoje < dataInicio) return "neutral";
    if (mediaFase >= 100) return "success";
    if (hoje > dataFim) return "danger";
    if (mediaFase < 40) return "danger";
    return "warning";
  }

  private isSemAcesso(value: unknown) {
    return this.termosSemAcesso.includes(String(value || "").trim().toLowerCase());
  }

  private calculateDiasSemAcesso(lastaccess: unknown) {
    const acessoStr = String(lastaccess || "").trim();
    if (!acessoStr || this.isSemAcesso(acessoStr)) return "-";

    const parts = acessoStr.split("/");
    if (parts.length !== 3) return "-";

    const d = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const y = parseInt(parts[2]);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return "-";

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dt = new Date(y, m, d);
    const diff = Math.floor((hoje.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24));
    return String(diff >= 0 ? diff : 0);
  }

  private buildProgressConditions(filters: any) {
    const conditions: any[] = [];

    if (filters.sourceInstitution) conditions.push(eq(avaProgressReport.sourceInstitution, filters.sourceInstitution));
    if (filters.aluno) conditions.push(ilike(avaProgressReport.aluno, `%${filters.aluno}%`));
    if (filters.curso) conditions.push(ilike(avaProgressReport.curso, `%${filters.curso}%`));
    if (filters.usuario) conditions.push(ilike(avaProgressReport.usuario, `%${filters.usuario}%`));
    if (filters.matricula) conditions.push(ilike(avaProgressReport.matricula, `%${filters.matricula}%`));

    const periodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-2";
    if (periodoFilter) conditions.push(ilike(avaProgressReport.periodo, `%${periodoFilter}%`));


    if (filters.curso_perfil) conditions.push(ilike(avaProgressReport.cursoPerfil, `%${filters.curso_perfil}%`));
    if (filters.periodo_perfil) conditions.push(ilike(avaProgressReport.periodoPerfil, `%${filters.periodo_perfil}%`));
    if (filters.unidade_fisica) conditions.push(ilike(avaProgressReport.unidadeFisica, `%${filters.unidade_fisica}%`));
    if (filters.enrolment_status) conditions.push(ilike(avaProgressReport.enrolmentStatus, `%${filters.enrolment_status}%`));

    const acesso_value = filters.lastaccess;
    const filtro_inatividade = filters.dias_sem_acesso;

    if (acesso_value === "sem_acesso") {
      conditions.push(or(
        isNull(avaProgressReport.lastaccess),
        inArray(sql`lower(trim(coalesce(${avaProgressReport.lastaccess}, '')))`, this.termosSemAcesso)
      ));
    } else if (acesso_value === "com_acesso") {
      conditions.push(and(
        isNotNull(avaProgressReport.lastaccess),
        not(inArray(sql`lower(trim(coalesce(${avaProgressReport.lastaccess}, '')))`, this.termosSemAcesso))
      ));
    } else if (acesso_value) {
      conditions.push(ilike(avaProgressReport.lastaccess, `%${acesso_value}%`));
    }

    if (filtro_inatividade) {
      if (filtro_inatividade.includes("-")) {
        const [minD, maxD] = filtro_inatividade.split("-").map(Number);
        if (!isNaN(minD) && !isNaN(maxD)) {
          conditions.push(sql`(${avaProgressReport.diasSemAcesso} ~ '^[0-9]+$' and ${avaProgressReport.diasSemAcesso}::integer between ${minD} and ${maxD})`);
        }
      } else {
        const match = filtro_inatividade.match(/\d+/);
        if (match) {
          const valMin = parseInt(match[0]);
          conditions.push(sql`(${avaProgressReport.diasSemAcesso} ~ '^[0-9]+$' and ${avaProgressReport.diasSemAcesso}::integer >= ${valMin})`);
        }
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private buildGradesConditions(filters: any) {
    const conditions: any[] = [];

    if (filters.sourceInstitution) conditions.push(eq(avaGradesReport.sourceInstitution, filters.sourceInstitution));
    if (filters.aluno) conditions.push(ilike(avaGradesReport.studentName, `%${filters.aluno}%`));
    if (filters.curso) conditions.push(ilike(avaGradesReport.courseFullname, `%${filters.curso}%`));
    if (filters.usuario) conditions.push(ilike(avaGradesReport.userUsername, `%${filters.usuario}%`));
    if (filters.matricula) conditions.push(ilike(avaGradesReport.userIdentification, `%${filters.matricula}%`));

    const periodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-2";
    if (periodoFilter) conditions.push(ilike(avaGradesReport.periodo, `%${periodoFilter}%`));


    if (filters.curso_perfil) conditions.push(ilike(avaGradesReport.cursoPerfil, `%${filters.curso_perfil}%`));
    if (filters.periodo_perfil) conditions.push(ilike(avaGradesReport.periodoPerfil, `%${filters.periodo_perfil}%`));
    if (filters.unidade_fisica) conditions.push(ilike(avaGradesReport.unidadeFisica, `%${filters.unidade_fisica}%`));
    if (filters.enrolment_status) conditions.push(ilike(avaGradesReport.enrolmentStatus, `%${filters.enrolment_status}%`));

    const acesso_value = filters.lastaccess;
    const filtro_inatividade = filters.dias_sem_acesso;

    if (acesso_value === "sem_acesso") {
      conditions.push(or(
        isNull(avaGradesReport.lastaccess),
        inArray(sql`lower(trim(coalesce(${avaGradesReport.lastaccess}, '')))`, this.termosSemAcesso)
      ));
    } else if (acesso_value === "com_acesso") {
      conditions.push(and(
        isNotNull(avaGradesReport.lastaccess),
        not(inArray(sql`lower(trim(coalesce(${avaGradesReport.lastaccess}, '')))`, this.termosSemAcesso))
      ));
    } else if (acesso_value) {
      conditions.push(ilike(avaGradesReport.lastaccess, `%${acesso_value}%`));
    }

    if (filtro_inatividade) {
      if (filtro_inatividade.includes("-")) {
        const [minD, maxD] = filtro_inatividade.split("-").map(Number);
        if (!isNaN(minD) && !isNaN(maxD)) {
          conditions.push(sql`(${avaGradesReport.lastaccess} is not null and lower(trim(${avaGradesReport.lastaccess})) not in ('nunca acessou', 'sem acesso', '', 'none', 'nulo', '-'))`);
        }
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async getProgressData(user: SessionUser, page: number, size: number, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const whereClause = this.buildProgressConditions(filters);

      // 1. Contagem total diretamente no PostgreSQL
      const [countRes] = await this.db.select({ count: sql<number>`count(*)` })
        .from(avaProgressReport)
        .where(whereClause);

      const total_records = Number(countRes?.count || 0);
      const total_pages = Math.ceil(total_records / size) || 1;
      const offset = (page - 1) * size;

      // 2. Busca paginada SQL com LIMIT e OFFSET (sem carregar base inteira na RAM)
      const pageRows = total_records > 0
        ? await this.db.select()
            .from(avaProgressReport)
            .where(whereClause)
            .orderBy(avaProgressReport.aluno, avaProgressReport.curso, avaProgressReport.id)
            .limit(size)
            .offset(offset)
        : [];

      const data = pageRows.map(row => ({
        ...row,
        diasSemAcesso: this.calculateDiasSemAcesso(row.lastaccess),
      }));

      // 3. Agregações estatísticas em SQL nativo no PostgreSQL
      const [statsRes] = await this.db.select({
        avgTotal: sql<number>`avg(nullif(regexp_replace(${avaProgressReport.progressoTotal}, '[^0-9.]', '', 'g'), '')::numeric)`,
        avgF1: sql<number>`avg(nullif(regexp_replace(${avaProgressReport.fase1}, '[^0-9.]', '', 'g'), '')::numeric)`,
        avgF2: sql<number>`avg(nullif(regexp_replace(${avaProgressReport.fase2}, '[^0-9.]', '', 'g'), '')::numeric)`,
        avgF3: sql<number>`avg(nullif(regexp_replace(${avaProgressReport.fase3}, '[^0-9.]', '', 'g'), '')::numeric)`,
        matSemAcesso: sql<number>`count(case when lower(trim(coalesce(${avaProgressReport.lastaccess}, ''))) in ('nunca acessou', 'sem acesso', '', 'none', 'nulo', '-') then 1 end)`,
        uniqueStudents: sql<number>`count(distinct coalesce(nullif(${avaProgressReport.alunoId}, ''), ${avaProgressReport.matricula}))`,
        uniqueDisciplines: sql<number>`count(distinct ${avaProgressReport.curso})`,
        belowExpected: sql<number>`count(case when (
          (nullif(regexp_replace(${avaProgressReport.fase1}, '[^0-9.]', '', 'g'), '')::numeric < 40) or
          (nullif(regexp_replace(${avaProgressReport.fase2}, '[^0-9.]', '', 'g'), '')::numeric < 40) or
          (nullif(regexp_replace(${avaProgressReport.fase3}, '[^0-9.]', '', 'g'), '')::numeric < 40)
        ) then 1 end)`,
      })
      .from(avaProgressReport)
      .where(whereClause);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const inicio_f1 = new Date(2026, 1, 13);
      const fim_f1 = new Date(2026, 2, 29);
      const inicio_f2 = new Date(2026, 2, 30);
      const fim_f2 = new Date(2026, 4, 11);
      const inicio_f3 = new Date(2026, 4, 12);
      const fim_f3 = new Date(2026, 5, 19);

      const avg_total = statsRes?.avgTotal ? Math.round(Number(statsRes.avgTotal)) : 0;
      const avg_f1 = statsRes?.avgF1 ? Math.round(Number(statsRes.avgF1)) : 0;
      const avg_f2 = statsRes?.avgF2 ? Math.round(Number(statsRes.avgF2)) : 0;
      const avg_f3 = statsRes?.avgF3 ? Math.round(Number(statsRes.avgF3)) : 0;

      const status_f1 = this.calculateFaseStatus(avg_f1, inicio_f1, fim_f1);
      const status_f2 = hoje >= inicio_f2 ? this.calculateFaseStatus(avg_f2, inicio_f2, fim_f2) : 'neutral';
      const status_f3 = hoje >= inicio_f3 ? this.calculateFaseStatus(avg_f3, inicio_f3, fim_f3) : 'neutral';

      const below_expected_count = Number(statsRes?.belowExpected || 0);
      const average_below_expected = total_records > 0 ? Math.round((below_expected_count / total_records) * 100) : 0;

      const count_mat_sem_acesso = Number(statsRes?.matSemAcesso || 0);
      const percent_mat_sem_acesso = total_records > 0 ? Math.round((count_mat_sem_acesso / total_records) * 100) : 0;

      const total_alunos_unicos = Number(statsRes?.uniqueStudents || 0);
      const total_disciplinas = Number(statsRes?.uniqueDisciplines || 0);

      return {
        page,
        size,
        total_records,
        total_pages,
        data,
        average_progress: avg_total,
        below_expected: below_expected_count,
        average_below_expected,
        total_disciplines: total_disciplinas,
        critical_disciplines: 0,
        average_fase1: avg_f1, status_fase1: status_f1, f1_below: 0, f1_crit: 0,
        average_fase2: avg_f2, status_fase2: status_f2, f2_below: 0, f2_crit: 0,
        average_fase3: avg_f3, status_fase3: status_f3, f3_below: 0, f3_crit: 0,
        count_mat_sem_acesso, percent_mat_sem_acesso, count_alunos_sem_acesso: count_mat_sem_acesso, percent_alunos_sem_acesso: percent_mat_sem_acesso,
        total_alunos_unicos,
        matriculas_em_dia: Math.max(0, total_records - below_expected_count),
        percent_matriculas_em_dia: total_records > 0 ? Math.round((Math.max(0, total_records - below_expected_count) / total_records) * 100) : 0,
      };
    } catch (error) {
      console.error("Erro em getProgressData:", error);
      throw new Error("Falha ao buscar dados de progresso");
    }
  }

  async getProgressExportData(user: SessionUser, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const whereClause = this.buildProgressConditions(filters);
      const rawData = await this.db.select()
        .from(avaProgressReport)
        .where(whereClause)
        .orderBy(avaProgressReport.aluno, avaProgressReport.curso)
        .limit(20000); // Teto de segurança para evitar saturação de streaming

      return rawData.map(row => ({
        ...row,
        diasSemAcesso: this.calculateDiasSemAcesso(row.lastaccess),
      }));
    } catch (error) {
      console.error("Erro ao buscar dados para exportação:", error);
      throw new Error("Falha ao exportar dados");
    }
  }

  async syncMoodleData(user: SessionUser, institution?: string, type?: 'grades' | 'progress') {
    await this.assertAvaAccess(user);

    try {
      const inst = institution?.toLowerCase() || 'ead';
      const allTasks = [
        { name: 'ead', type: 'grades', get: process.env.MOODLE_EAD_GRADES_GET_URL, att: process.env.MOODLE_EAD_GRADES_ATT_URL },
        { name: 'ead', type: 'progress', get: process.env.MOODLE_EAD_PROGRESS_GET_URL, att: process.env.MOODLE_EAD_PROGRESS_ATT_URL },
        { name: 'uni', type: 'grades', get: process.env.MOODLE_UNI_GRADES_GET_URL, att: process.env.MOODLE_UNI_GRADES_ATT_URL },
        { name: 'uni', type: 'progress', get: process.env.MOODLE_UNI_PROGRESS_GET_URL, att: process.env.MOODLE_UNI_PROGRESS_ATT_URL },
        { name: 'uniego', type: 'grades', get: process.env.MOODLE_UNIEGO_GRADES_GET_URL, att: process.env.MOODLE_UNIEGO_GRADES_ATT_URL },
        { name: 'uniego', type: 'progress', get: process.env.MOODLE_UNIEGO_PROGRESS_GET_URL, att: process.env.MOODLE_UNIEGO_PROGRESS_ATT_URL },
        { name: 'raizes', type: 'grades', get: process.env.MOODLE_RAIZES_GRADES_GET_URL, att: process.env.MOODLE_RAIZES_GRADES_ATT_URL },
        { name: 'raizes', type: 'progress', get: process.env.MOODLE_RAIZES_PROGRESS_GET_URL, att: process.env.MOODLE_RAIZES_PROGRESS_ATT_URL },
        { name: 'eefn', type: 'grades', get: process.env.MOODLE_EEFN_GRADES_GET_URL, att: process.env.MOODLE_EEFN_GRADES_ATT_URL },
        { name: 'eefn', type: 'progress', get: process.env.MOODLE_EEFN_PROGRESS_GET_URL, att: process.env.MOODLE_EEFN_PROGRESS_ATT_URL },
        { name: 'pos', type: 'grades', get: process.env.MOODLE_POS_GRADES_GET_URL, att: process.env.MOODLE_POS_GRADES_ATT_URL },
      ];

      let tasksToProcess = allTasks;
      if (institution) tasksToProcess = tasksToProcess.filter(t => t.name === inst);
      if (type) tasksToProcess = tasksToProcess.filter(t => t.type === type);

      if (tasksToProcess.length === 0) {
        throw new BadRequestException('Nenhuma tarefa de sincronização correspondente encontrada.');
      }

      const results: any[] = [];
      for (const task of tasksToProcess) {
        const res = task.type === 'grades'
          ? await this.avaSyncService.syncGrades(task.name, task.get, task.att)
          : await this.avaSyncService.syncProgress(task.name, task.get, task.att);
        results.push(res);
      }

      const skippedOrErrors = results.filter(r => r.status === 'skipped' || r.status === 'error');
      if (skippedOrErrors.length === results.length && results.length > 0) {
        const reasons = results.map(r => `${r.source}: ${r.reason || r.status}`).join('; ');
        throw new BadRequestException(`Sincronização não executada: ${reasons}`);
      }

      return { success: true, results };
    } catch (error: any) {
      console.error("Erro na action de sync:", error);
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(error.message || "Erro interno na sincronização");
    }


  }


  async getGradesData(user: SessionUser, page: number, size: number, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const whereClause = this.buildGradesConditions(filters);

      const parseGrade = (value: any) => {
        if (value === null || value === undefined || value === "" || value === "-") return null;
        const parsed = parseFloat(String(value).replace(",", "."));
        return isNaN(parsed) ? null : parsed;
      };

      const normalize = (value: number | null): number | null => {
        if (value === null) return null;
        if (value <= 10) return Number((value * 10).toFixed(1));
        return Number(value.toFixed(1));
      };

      const getNormalizedGrade = (value: any) => normalize(parseGrade(value));

      // 1. Contagem total de registros no PostgreSQL
      const [countRes] = await this.db.select({ count: sql<number>`count(*)` })
        .from(avaGradesReport)
        .where(whereClause);

      const total_records = Number(countRes?.count || 0);
      const total_pages = Math.ceil(total_records / size) || 1;
      const offset = (page - 1) * size;

      const joinCondition = and(
        eq(avaProgressReport.sourceInstitution, avaGradesReport.sourceInstitution),
        or(
          and(isNotNull(avaGradesReport.userId), eq(avaGradesReport.userId, avaProgressReport.alunoId)),
          and(isNotNull(avaGradesReport.userIdentification), eq(avaGradesReport.userIdentification, avaProgressReport.matricula))
        ),
        eq(avaProgressReport.curso, avaGradesReport.courseFullname)
      );

      // 2. Consulta paginada no PostgreSQL
      const pageRows = total_records > 0
        ? await this.db.select({
            id: avaGradesReport.id,
            sourceInstitution: avaGradesReport.sourceInstitution,
            courseId: avaGradesReport.courseId,
            courseFullname: avaGradesReport.courseFullname,
            courseShortname: avaGradesReport.courseShortname,
            userId: avaGradesReport.userId,
            userIdentification: avaGradesReport.userIdentification,
            userUsername: avaGradesReport.userUsername,
            studentName: avaGradesReport.studentName,
            userEmail: avaGradesReport.userEmail,
            userPhone1: avaGradesReport.userPhone1,
            userPhone2: avaGradesReport.userPhone2,
            enrolmentStatus: avaGradesReport.enrolmentStatus,
            cursoPerfil: avaGradesReport.cursoPerfil,
            periodoPerfil: avaGradesReport.periodoPerfil,
            unidadeFisica: avaGradesReport.unidadeFisica,
            periodo: avaGradesReport.periodo,
            fase1: avaGradesReport.fase1,
            fase2: avaGradesReport.fase2,
            fase3: avaGradesReport.fase3,
            media: avaGradesReport.media,
            customCourse: avaGradesReport.customCourse,
            lastaccess: avaGradesReport.lastaccess,
            updatedAt: avaGradesReport.updatedAt,
            // Joined Progress / Activities & Notes
            listaFase1: sql<string>`coalesce(nullif(${avaGradesReport.listaFase1}, ''), ${avaProgressReport.listaFase1})`,
            listaFase2: sql<string>`coalesce(nullif(${avaGradesReport.listaFase2}, ''), ${avaProgressReport.listaFase2})`,
            listaFase3: sql<string>`coalesce(nullif(${avaGradesReport.listaFase3}, ''), ${avaProgressReport.listaFase3})`,
            listaNotas: avaGradesReport.listaNotas,
            progressoFase1: avaProgressReport.fase1,
            progressoFase2: avaProgressReport.fase2,
            progressoFase3: avaProgressReport.fase3,
            progressoTotal: avaProgressReport.progressoTotal,
          })

          .from(avaGradesReport)
          .leftJoin(avaProgressReport, joinCondition)
          .where(whereClause)
          .orderBy(avaGradesReport.studentName, avaGradesReport.courseFullname, avaGradesReport.id)
          .limit(size)
          .offset(offset)
        : [];


      const data = pageRows.map(row => {
        const f1Norm = getNormalizedGrade(row.fase1);
        const f2Norm = getNormalizedGrade(row.fase2);
        const f3Norm = getNormalizedGrade(row.fase3);
        const mediaNorm = getNormalizedGrade(row.media);

        return {
          ...row,
          fase1: f1Norm !== null ? String(f1Norm) : row.fase1,
          fase2: f2Norm !== null ? String(f2Norm) : row.fase2,
          fase3: f3Norm !== null ? String(f3Norm) : row.fase3,
          media: mediaNorm !== null ? String(mediaNorm) : row.media,
          diasSemAcesso: this.calculateDiasSemAcesso(row.lastaccess)
        };
      });

      // 3. Agregações estatísticas gerais via SQL
      const [statsRes] = await this.db.select({
        avgMedia: sql<number>`avg(nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric)`,
        avgF1: sql<number>`avg(nullif(regexp_replace(${avaGradesReport.fase1}, '[^0-9.]', '', 'g'), '')::numeric)`,
        avgF2: sql<number>`avg(nullif(regexp_replace(${avaGradesReport.fase2}, '[^0-9.]', '', 'g'), '')::numeric)`,
        avgF3: sql<number>`avg(nullif(regexp_replace(${avaGradesReport.fase3}, '[^0-9.]', '', 'g'), '')::numeric)`,
        approvedCount: sql<number>`count(case when (nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric) >= 60 then 1 end)`,
        belowExpectedCount: sql<number>`count(case when (nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric) < 60 then 1 end)`,
        criticalCount: sql<number>`count(case when (nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric) < 30 then 1 end)`,
        semNotaCount: sql<number>`count(case when nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '') is null then 1 end)`,
        matSemAcesso: sql<number>`count(case when lower(trim(coalesce(${avaGradesReport.lastaccess}, ''))) in ('nunca acessou', 'sem acesso', '', 'none', 'nulo', '-') then 1 end)`,
        uniqueStudents: sql<number>`count(distinct coalesce(nullif(${avaGradesReport.userIdentification}, ''), ${avaGradesReport.studentName}))`,
        uniqueDisciplines: sql<number>`count(distinct ${avaGradesReport.courseFullname})`,
      })
      .from(avaGradesReport)
      .where(whereClause);

      // 4. Ranking de melhores e piores disciplinas via GROUP BY SQL
      const coursesRes = await this.db.select({
        name: avaGradesReport.courseFullname,
        average: sql<number>`round(avg(nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric), 1)`,
      })
      .from(avaGradesReport)
      .where(whereClause)
      .groupBy(avaGradesReport.courseFullname)
      .having(sql`avg(nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric) is not null`)
      .limit(100);

      const courses = coursesRes.map(c => ({
        name: c.name || 'Disciplina',
        average: Number(c.average || 0)
      }));

      const worstCourses = [...courses].sort((a, b) => a.average - b.average).slice(0, 5);
      const bestCourses = [...courses].sort((a, b) => b.average - a.average).slice(0, 5);

      const avg_total = statsRes?.avgMedia ? Number(Number(statsRes.avgMedia).toFixed(1)) : 0;
      const avg_f1 = statsRes?.avgF1 ? Number(Number(statsRes.avgF1).toFixed(1)) : 0;
      const avg_f2 = statsRes?.avgF2 ? Number(Number(statsRes.avgF2).toFixed(1)) : 0;
      const avg_f3 = statsRes?.avgF3 ? Number(Number(statsRes.avgF3).toFixed(1)) : 0;

      const approved_count = Number(statsRes?.approvedCount || 0);
      const below_expected_count = Number(statsRes?.belowExpectedCount || 0);
      const critical_count = Number(statsRes?.criticalCount || 0);
      const sem_nota_count = Number(statsRes?.semNotaCount || 0);
      const count_mat_sem_acesso = Number(statsRes?.matSemAcesso || 0);
      const total_alunos_unicos = Number(statsRes?.uniqueStudents || 0);
      const total_disciplines = Number(statsRes?.uniqueDisciplines || 0);

      return {
        page,
        size,
        total_records,
        total_pages,
        data,
        average_media: avg_total,
        average_fase1: avg_f1,
        average_fase2: avg_f2,
        average_fase3: avg_f3,
        percent_acima_aprovacao: total_records > 0 ? Math.round((approved_count / total_records) * 100) : 0,
        below_expected: below_expected_count,
        average_below_expected: total_records > 0 ? Math.round((below_expected_count / total_records) * 100) : 0,
        f1_below_percent: 0,
        f2_below_percent: 0,
        f3_below_percent: 0,
        percent_critical: total_records > 0 ? Math.round((critical_count / total_records) * 100) : 0,
        f1_crit_percent: 0,
        f2_crit_percent: 0,
        f3_crit_percent: 0,
        count_mat_sem_acesso,
        percent_mat_sem_acesso: total_records > 0 ? Math.round((count_mat_sem_acesso / total_records) * 100) : 0,
        count_alunos_sem_acesso: count_mat_sem_acesso,
        percent_alunos_sem_acesso: total_alunos_unicos > 0 ? Math.round((count_mat_sem_acesso / total_alunos_unicos) * 100) : 0,
        total_alunos_unicos,
        percent_sem_acesso_nota_critica: 0,
        mediana: avg_total,
        nota_minima: 0,
        nota_maxima: 100,
        approved_percent: total_records > 0 ? Math.round((approved_count / total_records) * 100) : 0,
        reproved_percent: total_records > 0 ? Math.round((below_expected_count / total_records) * 100) : 0,
        sem_nota_percent: total_records > 0 ? Math.round((sem_nota_count / total_records) * 100) : 0,
        histogram_percents: {
          range_0_3: total_records > 0 ? Math.round((critical_count / total_records) * 100) : 0,
          range_3_5: 0,
          range_5_6: 0,
          range_6_7: 0,
          range_7_8: 0,
          range_8_9: 0,
          range_9_10: total_records > 0 ? Math.round((approved_count / total_records) * 100) : 0,
        },
        total_disciplines,
        critical_disciplines: courses.filter(c => c.average < 60).length,
        excellent_disciplines: courses.filter(c => c.average >= 80).length,
        worstCourses,
        bestCourses,
        count_critical_grade: below_expected_count,
        count_multiple_fail: 0,
        count_no_grade: sem_nota_count,
      };
    } catch (error) {
      console.error("Erro em getGradesData:", error);
      throw new Error("Falha ao buscar dados de notas");
    }
  }

  async exportGradesData(user: SessionUser, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const whereClause = this.buildGradesConditions(filters);
      const rawData = await this.db.select()
        .from(avaGradesReport)
        .where(whereClause)
        .orderBy(avaGradesReport.studentName, avaGradesReport.courseFullname)
        .limit(20000); // Teto de segurança para exportação

      return rawData.map(row => ({
        ...row,
        diasSemAcesso: this.calculateDiasSemAcesso(row.lastaccess),
      }));
    } catch (error) {
      console.error("Erro ao exportar dados de notas:", error);
      throw new Error("Falha ao exportar dados");
    }
  }

  private buildConsolidatedConditions(filters: any) {
    const conditions: any[] = [];
    const sourceInstitution = filters.sourceInstitution || 'ead';
    conditions.push(eq(avaProgressReport.sourceInstitution, sourceInstitution));

    if (filters.aluno) conditions.push(ilike(avaProgressReport.aluno, `%${filters.aluno}%`));
    if (filters.matricula) conditions.push(ilike(avaProgressReport.matricula, `%${filters.matricula}%`));
    if (filters.usuario) conditions.push(ilike(avaProgressReport.usuario, `%${filters.usuario}%`));
    if (filters.curso) conditions.push(ilike(avaProgressReport.curso, `%${filters.curso}%`));
    if (filters.unidade_fisica) conditions.push(ilike(avaProgressReport.unidadeFisica, `%${filters.unidade_fisica}%`));
    if (filters.enrolment_status) conditions.push(ilike(avaProgressReport.enrolmentStatus, `%${filters.enrolment_status}%`));

    const periodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-2";
    if (periodoFilter) conditions.push(ilike(avaProgressReport.periodo, `%${periodoFilter}%`));

    if (filters.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(
        ilike(avaProgressReport.aluno, s),
        ilike(avaProgressReport.matricula, s),
        ilike(avaProgressReport.usuario, s),
        ilike(avaProgressReport.curso, s)
      ));
    }


    const acesso_value = filters.lastaccess;
    if (acesso_value === "sem_acesso") {
      conditions.push(or(
        isNull(avaProgressReport.lastaccess),
        inArray(sql`lower(trim(coalesce(${avaProgressReport.lastaccess}, '')))`, this.termosSemAcesso)
      ));
    } else if (acesso_value === "com_acesso") {
      conditions.push(and(
        isNotNull(avaProgressReport.lastaccess),
        not(inArray(sql`lower(trim(coalesce(${avaProgressReport.lastaccess}, '')))`, this.termosSemAcesso))
      ));
    } else if (acesso_value) {
      conditions.push(ilike(avaProgressReport.lastaccess, `%${acesso_value}%`));
    }

    return and(...conditions);
  }

  async getConsolidatedData(user: SessionUser, page: number, size: number, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const whereClause = this.buildConsolidatedConditions(filters);

      const joinCondition = and(
        eq(avaGradesReport.sourceInstitution, avaProgressReport.sourceInstitution),
        or(
          and(isNotNull(avaProgressReport.alunoId), eq(avaProgressReport.alunoId, avaGradesReport.userId)),
          and(isNotNull(avaProgressReport.matricula), eq(avaProgressReport.matricula, avaGradesReport.userIdentification))
        ),
        or(
          eq(avaProgressReport.curso, avaGradesReport.courseFullname),
          eq(avaProgressReport.curso, avaGradesReport.courseShortname)
        )
      );

      // 1. Contagem total
      const [countRes] = await this.db.select({ count: sql<number>`count(*)` })
        .from(avaProgressReport)
        .where(whereClause);

      const total_records = Number(countRes?.count || 0);
      const total_pages = Math.ceil(total_records / size) || 1;
      const offset = (page - 1) * size;

      // 2. Busca paginada unificada
      const pageRows = total_records > 0
        ? await this.db.select({
            id: avaProgressReport.id,
            alunoId: avaProgressReport.alunoId,
            matricula: avaProgressReport.matricula,
            usuario: avaProgressReport.usuario,
            aluno: avaProgressReport.aluno,
            email: avaGradesReport.userEmail,
            userPhone1: avaProgressReport.userPhone1,

            periodo: avaProgressReport.periodo,
            curso: avaProgressReport.curso,
            cursoPerfil: avaProgressReport.cursoPerfil,
            periodoPerfil: avaProgressReport.periodoPerfil,
            unidadeFisica: avaProgressReport.unidadeFisica,
            enrolmentStatus: avaProgressReport.enrolmentStatus,
            lastaccess: avaProgressReport.lastaccess,
            diasSemAcesso: avaProgressReport.diasSemAcesso,
            // Progresso
            progressoFase1: avaProgressReport.fase1,
            progressoFase2: avaProgressReport.fase2,
            progressoFase3: avaProgressReport.fase3,
            progressoTotal: avaProgressReport.progressoTotal,
            listaFase1: sql<string>`coalesce(nullif(${avaGradesReport.listaFase1}, ''), ${avaProgressReport.listaFase1})`,
            listaFase2: sql<string>`coalesce(nullif(${avaGradesReport.listaFase2}, ''), ${avaProgressReport.listaFase2})`,
            listaFase3: sql<string>`coalesce(nullif(${avaGradesReport.listaFase3}, ''), ${avaProgressReport.listaFase3})`,
            listaNotas: avaGradesReport.listaNotas,
            sourceInstitution: avaProgressReport.sourceInstitution,
            // Notas
            gradeId: avaGradesReport.id,
            notaFase1: avaGradesReport.fase1,
            notaFase2: avaGradesReport.fase2,
            notaFase3: avaGradesReport.fase3,
            mediaFinal: avaGradesReport.media,
          })

          .from(avaProgressReport)
          .leftJoin(avaGradesReport, joinCondition)
          .where(whereClause)
          .orderBy(avaProgressReport.aluno, avaProgressReport.curso, avaProgressReport.id)
          .limit(size)
          .offset(offset)
        : [];

      const data = pageRows.map(row => ({
        ...row,
        diasSemAcesso: this.calculateDiasSemAcesso(row.lastaccess),
        notaFase1: row.notaFase1 ?? '-',
        notaFase2: row.notaFase2 ?? '-',
        notaFase3: row.notaFase3 ?? '-',
        mediaFinal: row.mediaFinal ?? '-',
      }));

      // 3. Agregações estatísticas em SQL nativo
      const [statsRes] = await this.db.select({
        avgProgress: sql<number>`avg(nullif(regexp_replace(${avaProgressReport.progressoTotal}, '[^0-9.]', '', 'g'), '')::numeric)`,
        avgGrade: sql<number>`avg(nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric)`,
        belowApproval: sql<number>`count(case when (nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric) < 60 then 1 end)`,
        noAccessCount: sql<number>`count(case when lower(trim(coalesce(${avaProgressReport.lastaccess}, ''))) in ('nunca acessou', 'sem acesso', '', 'none', 'nulo', '-') then 1 end)`,
        uniqueStudents: sql<number>`count(distinct coalesce(nullif(${avaProgressReport.alunoId}, ''), ${avaProgressReport.matricula}))`,
        uniqueDisciplines: sql<number>`count(distinct ${avaProgressReport.curso})`,
      })
      .from(avaProgressReport)
      .leftJoin(avaGradesReport, joinCondition)
      .where(whereClause);

      // 4. Dropdowns de filtros únicos
      const sourceInstitution = filters.sourceInstitution || 'ead';
      const [uniquePeriodos, uniqueCursos, uniquePolos] = await Promise.all([
        this.db.selectDistinct({ value: avaProgressReport.periodo })
          .from(avaProgressReport)
          .where(and(eq(avaProgressReport.sourceInstitution, sourceInstitution), isNotNull(avaProgressReport.periodo)))
          .orderBy(desc(avaProgressReport.periodo)),
        this.db.selectDistinct({ value: avaProgressReport.curso })
          .from(avaProgressReport)
          .where(and(eq(avaProgressReport.sourceInstitution, sourceInstitution), isNotNull(avaProgressReport.curso)))
          .orderBy(avaProgressReport.curso),
        this.db.selectDistinct({ value: avaProgressReport.unidadeFisica })
          .from(avaProgressReport)
          .where(and(eq(avaProgressReport.sourceInstitution, sourceInstitution), isNotNull(avaProgressReport.unidadeFisica)))
          .orderBy(avaProgressReport.unidadeFisica),
      ]);

      return {
        page,
        size,
        total_records,
        total_pages,
        data,
        average_progress: statsRes?.avgProgress ? Math.round(Number(statsRes.avgProgress)) : 0,
        average_grade: statsRes?.avgGrade ? Math.round(Number(statsRes.avgGrade)) : 0,
        below_approval: Number(statsRes?.belowApproval || 0),
        no_access_count: Number(statsRes?.noAccessCount || 0),
        total_alunos_unicos: Number(statsRes?.uniqueStudents || 0),
        total_disciplinas: Number(statsRes?.uniqueDisciplines || 0),
        unique_periodos: uniquePeriodos.map(p => p.value).filter(Boolean),
        unique_cursos: uniqueCursos.map(c => c.value).filter(Boolean),
        unique_polos: uniquePolos.map(u => u.value).filter(Boolean),
      };
    } catch (error) {
      console.error("Erro em getConsolidatedData:", error);
      throw new Error("Falha ao buscar dados consolidados do AVA");
    }
  }

  async getConsolidatedExportData(user: SessionUser, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const whereClause = this.buildConsolidatedConditions(filters);

      const joinCondition = and(
        eq(avaGradesReport.sourceInstitution, avaProgressReport.sourceInstitution),
        or(
          and(isNotNull(avaProgressReport.alunoId), eq(avaProgressReport.alunoId, avaGradesReport.userId)),
          and(isNotNull(avaProgressReport.matricula), eq(avaProgressReport.matricula, avaGradesReport.userIdentification))
        ),
        or(
          eq(avaProgressReport.curso, avaGradesReport.courseFullname),
          eq(avaProgressReport.curso, avaGradesReport.courseShortname)
        )
      );

      const rawData = await this.db.select({
        id: avaProgressReport.id,
        alunoId: avaProgressReport.alunoId,
        matricula: avaProgressReport.matricula,
        usuario: avaProgressReport.usuario,
        aluno: avaProgressReport.aluno,
        email: avaGradesReport.userEmail,
        userPhone1: avaProgressReport.userPhone1,

        periodo: avaProgressReport.periodo,
        curso: avaProgressReport.curso,
        cursoPerfil: avaProgressReport.cursoPerfil,
        periodoPerfil: avaProgressReport.periodoPerfil,
        unidadeFisica: avaProgressReport.unidadeFisica,
        enrolmentStatus: avaProgressReport.enrolmentStatus,
        lastaccess: avaProgressReport.lastaccess,
        // Progresso
        progressoFase1: avaProgressReport.fase1,
        progressoFase2: avaProgressReport.fase2,
        progressoFase3: avaProgressReport.fase3,
        progressoTotal: avaProgressReport.progressoTotal,
        // Notas
        notaFase1: avaGradesReport.fase1,
        notaFase2: avaGradesReport.fase2,
        notaFase3: avaGradesReport.fase3,
        mediaFinal: avaGradesReport.media,
      })
      .from(avaProgressReport)
      .leftJoin(avaGradesReport, joinCondition)
      .where(whereClause)
      .orderBy(avaProgressReport.aluno, avaProgressReport.curso);

      return rawData.map(row => ({
        ...row,
        diasSemAcesso: this.calculateDiasSemAcesso(row.lastaccess),
        notaFase1: row.notaFase1 ?? '-',
        notaFase2: row.notaFase2 ?? '-',
        notaFase3: row.notaFase3 ?? '-',
        mediaFinal: row.mediaFinal ?? '-',
      }));
    } catch (error) {
      console.error("Erro ao exportar dados consolidados:", error);
      throw new Error("Falha ao exportar dados consolidados");
    }
  }

  async getAvaDashboardStats(user: SessionUser) {
    await this.assertAvaAccess(user);

    try {
      const [progressStatsRes, gradeStatsRes] = await Promise.all([
        this.db.select({
          sourceInstitution: avaProgressReport.sourceInstitution,
          totalStudents: sql<number>`count(*)`,
          validProgressCount: sql<number>`count(nullif(regexp_replace(${avaProgressReport.progressoTotal}, '[^0-9.]', '', 'g'), ''))`,
          avgProgress: sql<number>`avg(nullif(regexp_replace(${avaProgressReport.progressoTotal}, '[^0-9.]', '', 'g'), '')::numeric)`,
          noAccessCount: sql<number>`count(case when lower(trim(coalesce(${avaProgressReport.lastaccess}, ''))) in ('nunca acessou', 'sem acesso', '', 'none', 'nulo', '-') or (coalesce(${avaProgressReport.diasSemAcesso}, '') ~ '^[0-9]+$' and ${avaProgressReport.diasSemAcesso}::integer > 14) then 1 end)`,
          lastSync: sql<Date>`max(${avaProgressReport.updatedAt})`,
        })
        .from(avaProgressReport)
        .groupBy(avaProgressReport.sourceInstitution),

        this.db.select({
          sourceInstitution: avaGradesReport.sourceInstitution,
          validGradesCount: sql<number>`count(nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), ''))`,
          avgGrade: sql<number>`avg(nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric)`,
          belowApprovalCount: sql<number>`count(case when (nullif(regexp_replace(${avaGradesReport.media}, '[^0-9.]', '', 'g'), '')::numeric) < 60 then 1 end)`,
          lastSync: sql<Date>`max(${avaGradesReport.updatedAt})`,
        })
        .from(avaGradesReport)
        .groupBy(avaGradesReport.sourceInstitution)
      ]);

      const progressMap = new Map(progressStatsRes.map(r => [r.sourceInstitution?.toLowerCase(), r]));
      const gradeMap = new Map(gradeStatsRes.map(r => [r.sourceInstitution?.toLowerCase(), r]));

      let totalStudents = 0;
      let totalProgressWeighted = 0;
      let totalValidProgress = 0;
      let totalNoAccess = 0;

      for (const p of progressStatsRes) {
        const count = Number(p.totalStudents || 0);
        const validCount = Number(p.validProgressCount || 0);
        const avg = Number(p.avgProgress || 0);
        totalStudents += count;
        totalValidProgress += validCount;
        totalProgressWeighted += avg * validCount;
        totalNoAccess += Number(p.noAccessCount || 0);
      }

      let totalGradeWeighted = 0;
      let totalValidGrades = 0;
      let belowApprovalCount = 0;

      for (const g of gradeStatsRes) {
        const validCount = Number(g.validGradesCount || 0);
        const avg = Number(g.avgGrade || 0);
        totalValidGrades += validCount;
        totalGradeWeighted += avg * validCount;
        belowApprovalCount += Number(g.belowApprovalCount || 0);
      }

      const averageProgress = totalValidProgress > 0 ? Math.round(totalProgressWeighted / totalValidProgress) : 0;
      const averageGrade = totalValidGrades > 0 ? Math.round(totalGradeWeighted / totalValidGrades) : 0;

      const institutions = ['ead', 'eefn', 'raizes', 'uni', 'uniego'];
      const institutionsStats = institutions.map(inst => {
        const p = progressMap.get(inst);
        const g = gradeMap.get(inst);

        const lastSyncP = p?.lastSync ? new Date(p.lastSync) : null;
        const lastSyncG = g?.lastSync ? new Date(g.lastSync) : null;
        let lastSync: Date | null = null;
        if (lastSyncP && lastSyncG) {
          lastSync = lastSyncP > lastSyncG ? lastSyncP : lastSyncG;
        } else {
          lastSync = lastSyncP || lastSyncG;
        }

        return {
          id: inst,
          name: inst.toUpperCase(),
          totalStudents: Number(p?.totalStudents || 0),
          averageProgress: p?.avgProgress ? Math.round(Number(p.avgProgress)) : 0,
          averageGrade: g?.avgGrade ? Math.round(Number(g.avgGrade)) : 0,
          belowApprovalCount: Number(g?.belowApprovalCount || 0),
          noAccessCount: Number(p?.noAccessCount || 0),
          lastSync: lastSync ? lastSync.toISOString() : null,
          status: lastSync ? 'success' : 'offline',
        };
      });

      return {
        totalStudents,
        averageProgress,
        averageGrade,
        belowApprovalCount,
        noAccessCount: totalNoAccess,
        institutionsStats,
      };
    } catch (error) {
      console.error("Error in getAvaDashboardStats:", error);
      return {
        totalStudents: 0,
        averageProgress: 0,
        averageGrade: 0,
        belowApprovalCount: 0,
        noAccessCount: 0,
        institutionsStats: [
          { id: 'ead', name: 'EAD', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
          { id: 'eefn', name: 'EEFN', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
          { id: 'raizes', name: 'RAÍZES', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
          { id: 'uni', name: 'UNI', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
          { id: 'uniego', name: 'UNIEGO', totalStudents: 0, averageProgress: 0, averageGrade: 0, belowApprovalCount: 0, noAccessCount: 0, lastSync: null, status: 'offline' },
        ],
      };
    }
  }
}
