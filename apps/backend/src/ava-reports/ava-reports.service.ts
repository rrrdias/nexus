import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { eq, ilike, and, inArray } from 'drizzle-orm';
import { avaProgressReport, avaGradesReport, systemModules, usersSystemAccess, userGroups, groupSystemAccess } from '../db/schema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

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

  private applyAccessFilters<T extends { lastaccess?: string | null; diasSemAcesso?: string | null }>(
    rows: T[],
    acessoValue: string | undefined,
    filtroInatividade: string | undefined,
  ) {
    let filtered = rows;

    if (acessoValue === "sem_acesso") {
      filtered = filtered.filter(row => this.isSemAcesso(row.lastaccess));
    } else if (acessoValue === "com_acesso") {
      filtered = filtered.filter(row => !this.isSemAcesso(row.lastaccess));
    }

    const processed = filtered.map(row => ({
      ...row,
      diasSemAcesso: this.calculateDiasSemAcesso(row.lastaccess),
    }));

    if (!filtroInatividade) return processed;

    try {
      if (filtroInatividade.includes("-")) {
        const [minD, maxD] = filtroInatividade.split("-").map(Number);
        return processed.filter(row => {
          const d = parseInt(row.diasSemAcesso);
          return !isNaN(d) && d >= minD && d <= maxD;
        });
      }

      const match = filtroInatividade.match(/\d+/);
      if (!match) return processed;

      const valMin = parseInt(match[0]);
      return processed.filter(row => {
        const d = parseInt(row.diasSemAcesso);
        return !isNaN(d) && d >= valMin;
      });
    } catch (e) {
      console.error("Erro no filtro de inatividade:", e);
      return processed;
    }
  }

  private orderRowsByIds<T extends { id: string }>(rows: T[], ids: string[]) {
    const order = new Map(ids.map((id, index) => [id, index]));
    return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  async getProgressData(user: SessionUser, page: number, size: number, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const conditions: any[] = [];
      
      if (filters.sourceInstitution) conditions.push(eq(avaProgressReport.sourceInstitution, filters.sourceInstitution));
      if (filters.aluno) conditions.push(ilike(avaProgressReport.aluno, `%${filters.aluno}%`));
      if (filters.curso) conditions.push(ilike(avaProgressReport.curso, `%${filters.curso}%`));
      if (filters.usuario) conditions.push(ilike(avaProgressReport.usuario, `%${filters.usuario}%`));
      if (filters.matricula) conditions.push(ilike(avaProgressReport.matricula, `%${filters.matricula}%`));
      
      const periodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-1";
      if (periodoFilter) conditions.push(ilike(avaProgressReport.periodo, `%${periodoFilter}%`));
      
      if (filters.curso_perfil) conditions.push(ilike(avaProgressReport.cursoPerfil, `%${filters.curso_perfil}%`));
      if (filters.periodo_perfil) conditions.push(ilike(avaProgressReport.periodoPerfil, `%${filters.periodo_perfil}%`));
      if (filters.unidade_fisica) conditions.push(ilike(avaProgressReport.unidadeFisica, `%${filters.unidade_fisica}%`));
      if (filters.enrolment_status) conditions.push(ilike(avaProgressReport.enrolmentStatus, `%${filters.enrolment_status}%`));

      const acesso_value = filters.lastaccess;
      const filtro_inatividade = filters.dias_sem_acesso;

      if (acesso_value && acesso_value !== "sem_acesso" && acesso_value !== "com_acesso") {
        conditions.push(ilike(avaProgressReport.lastaccess, `%${acesso_value}%`));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rawData = await this.db.select({
        id: avaProgressReport.id,
        alunoId: avaProgressReport.alunoId,
        matricula: avaProgressReport.matricula,
        lastaccess: avaProgressReport.lastaccess,
        curso: avaProgressReport.curso,
        fase1: avaProgressReport.fase1,
        fase2: avaProgressReport.fase2,
        fase3: avaProgressReport.fase3,
        progressoTotal: avaProgressReport.progressoTotal,
      })
        .from(avaProgressReport)
        .where(whereClause)
        .orderBy(avaProgressReport.aluno, avaProgressReport.curso, avaProgressReport.id);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const processedData = this.applyAccessFilters(rawData, acesso_value, filtro_inatividade);

      const allFilteredData = processedData;
      const total_records = allFilteredData.length;
      const total_pages = Math.ceil(total_records / size);
      const offset = (page - 1) * size;
      const pageMetricsRows = allFilteredData.slice(offset, offset + size);
      const pageIds = pageMetricsRows.map(row => row.id);
      const diasById = new Map(pageMetricsRows.map(row => [row.id, row.diasSemAcesso]));
      const pageRows = pageIds.length > 0
        ? await this.db.select().from(avaProgressReport).where(inArray(avaProgressReport.id, pageIds))
        : [];
      const data = this.orderRowsByIds(pageRows, pageIds)
        .map(row => ({ ...row, diasSemAcesso: diasById.get(row.id) ?? row.diasSemAcesso }));

      const inicio_f1 = new Date(2026, 1, 13);
      const fim_f1 = new Date(2026, 2, 29);
      const inicio_f2 = new Date(2026, 2, 30);
      const fim_f2 = new Date(2026, 4, 11);
      const inicio_f3 = new Date(2026, 4, 12);
      const fim_f3 = new Date(2026, 5, 19);

      const getFaseMetricsInternal = (faseKey: 'fase1'|'fase2'|'fase3', dataInicio: Date, dataFim: Date) => {
        let limiar = 0;
        if (hoje > dataFim) limiar = 100;
        else if (hoje >= dataInicio) limiar = 40;
        
        if (limiar === 0) return { below: 0, crit: 0 };

        const faseValues = allFilteredData.map(r => this.parseProgress(r[faseKey])).filter(v => v !== null) as number[];
        const belowCount = faseValues.filter(v => v < limiar).length;

        const discMap: Record<string, number[]> = {};
        allFilteredData.forEach(row => {
          const nome = row.curso;
          const prog = this.parseProgress(row[faseKey]);
          if (nome && prog !== null) {
            if (!discMap[nome]) discMap[nome] = [];
            discMap[nome].push(prog);
          }
        });
        const criticas = Object.values(discMap).filter(progs => (progs.reduce((a,b)=>a+b,0)/progs.length) < limiar).length;
        return { below: belowCount, crit: criticas };
      };

      const sumTotal = allFilteredData.reduce((acc, r) => acc + (this.parseProgress(r.progressoTotal) || 0), 0);
      const avg_total = allFilteredData.length > 0 ? Math.round(sumTotal / allFilteredData.length) : 0;

      let below_expected_count = 0;
      allFilteredData.forEach(row => {
        const f1 = this.parseProgress(row.fase1) || 0;
        const f2 = this.parseProgress(row.fase2) || 0;
        const f3 = this.parseProgress(row.fase3) || 0;
        let is_below = false;
        if ((hoje > fim_f1 && f1 < 100) || (hoje >= inicio_f1 && hoje <= fim_f1 && f1 < 40)) is_below = true;
        if ((hoje > fim_f2 && f2 < 100) || (hoje >= inicio_f2 && hoje <= fim_f2 && f2 < 40)) is_below = true;
        if ((hoje > fim_f3 && f3 < 100) || (hoje >= inicio_f3 && hoje <= fim_f3 && f3 < 40)) is_below = true;
        if (is_below) below_expected_count++;
      });
      const average_below_expected = total_records > 0 ? Math.round((below_expected_count / total_records) * 100) : 0;

      const limiar_global = hoje <= fim_f1 ? 33 : (hoje <= fim_f2 ? 66 : 100);
      const discMapGlobal: Record<string, number[]> = {};
      allFilteredData.forEach(row => {
        const nome_disc = row.curso;
        const prog_total = this.parseProgress(row.progressoTotal);
        if (nome_disc && prog_total !== null) {
          if (!discMapGlobal[nome_disc]) discMapGlobal[nome_disc] = [];
          discMapGlobal[nome_disc].push(prog_total);
        }
      });
      const disciplinas_criticas_global = Object.values(discMapGlobal).filter(progs => (progs.reduce((a,b)=>a+b,0)/progs.length) < limiar_global).length;

      const mats_sem_acesso = allFilteredData.filter(r => this.isSemAcesso(r.lastaccess));
      const count_mat_sem_acesso = mats_sem_acesso.length;
      const percent_mat_sem_acesso = total_records > 0 ? (count_mat_sem_acesso / total_records * 100) : 0;

      const todos_alunos = new Set<string>();
      const alunos_com_acesso = new Set<string>();
      allFilteredData.forEach(r => {
        const aId = r.alunoId || r.matricula;
        if (aId) {
          todos_alunos.add(aId);
          if (!this.isSemAcesso(r.lastaccess)) {
            alunos_com_acesso.add(aId);
          }
        }
      });
      const count_alunos_sem_acesso = todos_alunos.size - alunos_com_acesso.size;
      const percent_alunos_sem_acesso = todos_alunos.size > 0 ? (count_alunos_sem_acesso / todos_alunos.size * 100) : 0;

      const avgFase = (key: 'fase1'|'fase2'|'fase3') => {
        const sum = allFilteredData.reduce((acc, r) => acc + (this.parseProgress(r[key]) || 0), 0);
        return allFilteredData.length > 0 ? Math.round(sum / allFilteredData.length) : 0;
      };
      
      const avg_f1 = avgFase('fase1'), status_f1 = this.calculateFaseStatus(avg_f1, inicio_f1, fim_f1);
      const f1_metrics = getFaseMetricsInternal('fase1', inicio_f1, fim_f1);
      
      let avg_f2 = 0, status_f2 = 'neutral', f2_metrics = {below: 0, crit: 0};
      if (hoje >= inicio_f2) {
        avg_f2 = avgFase('fase2'); status_f2 = this.calculateFaseStatus(avg_f2, inicio_f2, fim_f2); f2_metrics = getFaseMetricsInternal('fase2', inicio_f2, fim_f2);
      }
      let avg_f3 = 0, status_f3 = 'neutral', f3_metrics = {below: 0, crit: 0};
      if (hoje >= inicio_f3) {
        avg_f3 = avgFase('fase3'); status_f3 = this.calculateFaseStatus(avg_f3, inicio_f3, fim_f3); f3_metrics = getFaseMetricsInternal('fase3', inicio_f3, fim_f3);
      }

      let matriculas_em_dia = 0;
      allFilteredData.forEach(row => {
        const f1 = this.parseProgress(row.fase1) ?? 0;
        const f2 = this.parseProgress(row.fase2) ?? 0;
        const f3 = this.parseProgress(row.fase3) ?? 0;
        let ok = true;
        if (hoje >= inicio_f1 && f1 < (hoje > fim_f1 ? 100 : 40)) ok = false;
        if (hoje >= inicio_f2 && f2 < (hoje > fim_f2 ? 100 : 40)) ok = false;
        if (hoje >= inicio_f3 && f3 < (hoje > fim_f3 ? 100 : 40)) ok = false;
        if (ok) matriculas_em_dia++;
      });
      const percent_matriculas_em_dia = total_records > 0 ? Math.round((matriculas_em_dia / total_records) * 100) : 0;

      return {
        page, size, total_records, total_pages, data,
        average_progress: avg_total,
        below_expected: below_expected_count,
        average_below_expected,
        total_disciplines: Object.keys(discMapGlobal).length,
        critical_disciplines: disciplinas_criticas_global,
        average_fase1: avg_f1, status_fase1: status_f1, f1_below: f1_metrics.below, f1_crit: f1_metrics.crit,
        average_fase2: avg_f2, status_fase2: status_f2, f2_below: f2_metrics.below, f2_crit: f2_metrics.crit,
        average_fase3: avg_f3, status_fase3: status_f3, f3_below: f3_metrics.below, f3_crit: f3_metrics.crit,
        count_mat_sem_acesso, percent_mat_sem_acesso, count_alunos_sem_acesso, percent_alunos_sem_acesso,
        total_alunos_unicos: todos_alunos.size,
        matriculas_em_dia, percent_matriculas_em_dia
      };
    } catch (error) {
      console.error("Erro:", error);
      throw new Error("Falha ao buscar dados");
    }
  }

  async getProgressExportData(user: SessionUser, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const conditions: any[] = [];
      if (filters.sourceInstitution) conditions.push(eq(avaProgressReport.sourceInstitution, filters.sourceInstitution));
      if (filters.aluno) conditions.push(ilike(avaProgressReport.aluno, `%${filters.aluno}%`));
      if (filters.curso) conditions.push(ilike(avaProgressReport.curso, `%${filters.curso}%`));
      if (filters.usuario) conditions.push(ilike(avaProgressReport.usuario, `%${filters.usuario}%`));
      if (filters.matricula) conditions.push(ilike(avaProgressReport.matricula, `%${filters.matricula}%`));
      const exportPeriodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-1";
      if (exportPeriodoFilter) conditions.push(ilike(avaProgressReport.periodo, `%${exportPeriodoFilter}%`));
      if (filters.curso_perfil) conditions.push(ilike(avaProgressReport.cursoPerfil, `%${filters.curso_perfil}%`));
      if (filters.periodo_perfil) conditions.push(ilike(avaProgressReport.periodoPerfil, `%${filters.periodo_perfil}%`));
      if (filters.unidade_fisica) conditions.push(ilike(avaProgressReport.unidadeFisica, `%${filters.unidade_fisica}%`));
      if (filters.enrolment_status) conditions.push(ilike(avaProgressReport.enrolmentStatus, `%${filters.enrolment_status}%`));

      const acesso_value = filters.lastaccess;
      const filtro_inatividade = filters.dias_sem_acesso;

      if (acesso_value && acesso_value !== "sem_acesso" && acesso_value !== "com_acesso") {
        conditions.push(ilike(avaProgressReport.lastaccess, `%${acesso_value}%`));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rawData = await this.db.select().from(avaProgressReport).where(whereClause);

      const termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"];

      let filteredAccessData = rawData;
      if (acesso_value === "sem_acesso") {
        filteredAccessData = rawData.filter(row => termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase()));
      } else if (acesso_value === "com_acesso") {
        filteredAccessData = rawData.filter(row => !termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase()));
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeTime = hoje.getTime();

      let processedData = filteredAccessData.map(row => {
        let dias: number | string = "-";
        const acessoStr = String(row.lastaccess || "").trim();
        
        if (!acessoStr || termosSemAcesso.includes(acessoStr.toLowerCase())) {
          dias = "-";
        } else {
          try {
            const parts = acessoStr.split("/");
            if (parts.length === 3) {
              const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
              if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                const dt = new Date(y, m, d);
                const diff = Math.floor((hojeTime - dt.getTime()) / (1000 * 60 * 60 * 24));
                dias = diff >= 0 ? diff : 0;
              }
            }
          } catch (e) {
            dias = "-";
          }
        }
        return { ...row, diasSemAcesso: String(dias) };
      });

      if (filtro_inatividade && filtro_inatividade !== "") {
        try {
          if (filtro_inatividade.includes("-")) {
            const [minD, maxD] = filtro_inatividade.split("-").map(Number);
            processedData = processedData.filter(row => {
              const d = parseInt(row.diasSemAcesso);
              return !isNaN(d) && d >= minD && d <= maxD;
            });
          } else {
            const match = filtro_inatividade.match(/\d+/);
            if (match) {
              const valMin = parseInt(match[0]);
              processedData = processedData.filter(row => {
                const d = parseInt(row.diasSemAcesso);
                return !isNaN(d) && d >= valMin;
              });
            }
          }
        } catch (e) {
          console.error("Erro no filtro de inatividade:", e);
        }
      }

      return processedData;
    } catch (error) {
      console.error("Erro ao buscar dados para exportação:", error);
      throw new Error("Falha ao exportar dados");
    }
  }

  async syncMoodleData(user: SessionUser, institution?: string, type?: 'grades' | 'progress') {
    await this.assertAvaAccess(user);

    try {
      if (!process.env.CRON_SECRET) {
        throw new Error("CRON_SECRET não configurado.");
      }

      const baseUrl = `http://localhost:${process.env.PORT || 3001}`;
      let url = `${baseUrl}/api/ava-sync?`;
      
      const params = new URLSearchParams();
      if (institution) params.append('institution', institution.toLowerCase());
      if (type) params.append('type', type);

      const response = await fetch(url + params.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha na sincronização');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error("Erro na action de sync:", error);
      throw new Error(error.message || "Erro interno na sincronização");
    }
  }

  async getGradesData(user: SessionUser, page: number, size: number, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const conditions: any[] = [];
      
      if (filters.sourceInstitution) conditions.push(eq(avaGradesReport.sourceInstitution, filters.sourceInstitution));
      if (filters.aluno) conditions.push(ilike(avaGradesReport.studentName, `%${filters.aluno}%`));
      if (filters.curso) conditions.push(ilike(avaGradesReport.courseFullname, `%${filters.curso}%`));
      if (filters.usuario) conditions.push(ilike(avaGradesReport.userUsername, `%${filters.usuario}%`));
      if (filters.matricula) conditions.push(ilike(avaGradesReport.userIdentification, `%${filters.matricula}%`));
      const periodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-1";
      if (periodoFilter) conditions.push(ilike(avaGradesReport.periodo, `%${periodoFilter}%`));
      if (filters.curso_perfil) conditions.push(ilike(avaGradesReport.cursoPerfil, `%${filters.curso_perfil}%`));
      if (filters.periodo_perfil) conditions.push(ilike(avaGradesReport.periodoPerfil, `%${filters.periodo_perfil}%`));
      if (filters.unidade_fisica) conditions.push(ilike(avaGradesReport.unidadeFisica, `%${filters.unidade_fisica}%`));
      if (filters.enrolment_status) conditions.push(ilike(avaGradesReport.enrolmentStatus, `%${filters.enrolment_status}%`));

      const acesso_value = filters.lastaccess;
      const filtro_inatividade = filters.dias_sem_acesso;

      if (acesso_value && acesso_value !== "sem_acesso" && acesso_value !== "com_acesso") {
        conditions.push(ilike(avaGradesReport.lastaccess, `%${acesso_value}%`));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rawData = await this.db.select({
        id: avaGradesReport.id,
        lastaccess: avaGradesReport.lastaccess,
        fase1: avaGradesReport.fase1,
        fase2: avaGradesReport.fase2,
        fase3: avaGradesReport.fase3,
        media: avaGradesReport.media,
        userIdentification: avaGradesReport.userIdentification,
        studentName: avaGradesReport.studentName,
        courseFullname: avaGradesReport.courseFullname,
      })
        .from(avaGradesReport)
        .where(whereClause)
        .orderBy(avaGradesReport.studentName, avaGradesReport.courseFullname, avaGradesReport.id);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const processedData = this.applyAccessFilters(rawData, acesso_value, filtro_inatividade);

      const allFilteredData = processedData;
      const total_records = allFilteredData.length;
      const total_pages = Math.ceil(total_records / size);

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

      const getNormalizedGrade = (value: any) => {
        return normalize(parseGrade(value));
      };

      const offset = (page - 1) * size;
      const pageMetricsRows = allFilteredData.slice(offset, offset + size);
      const pageIds = pageMetricsRows.map(row => row.id);
      const diasById = new Map(pageMetricsRows.map(row => [row.id, row.diasSemAcesso]));
      const pageRows = pageIds.length > 0
        ? await this.db.select().from(avaGradesReport).where(inArray(avaGradesReport.id, pageIds))
        : [];
      const data = this.orderRowsByIds(pageRows, pageIds)
        .map(row => {
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
            diasSemAcesso: diasById.get(row.id) ?? "-"
          };
        });

      // 1. Fase-level and Global Averages
      const validGrades = allFilteredData.map(r => getNormalizedGrade(r.media)).filter(v => v !== null) as number[];
      const validF1 = allFilteredData.map(r => getNormalizedGrade(r.fase1)).filter(v => v !== null) as number[];
      const validF2 = allFilteredData.map(r => getNormalizedGrade(r.fase2)).filter(v => v !== null) as number[];
      const validF3 = allFilteredData.map(r => getNormalizedGrade(r.fase3)).filter(v => v !== null) as number[];

      const avgFase = (vals: number[]) => {
        if (vals.length === 0) return 0;
        const sum = vals.reduce((a, b) => a + b, 0);
        return Number((sum / vals.length).toFixed(1));
      };

      const avg_f1 = avgFase(validF1);
      const avg_f2 = avgFase(validF2);
      const avg_f3 = avgFase(validF3);
      const avg_total = avgFase(validGrades);

      // Above passing grade (>= 60.0) percentage
      const approvedRows = allFilteredData.filter(r => {
        const g = getNormalizedGrade(r.media);
        return g !== null && g >= 60.0;
      });
      const percent_acima_aprovacao = total_records > 0 ? Math.round((approvedRows.length / total_records) * 100) : 0;

      // Below passing grade (< 60.0) count and percentage
      const belowExpectedRows = allFilteredData.filter(r => {
        const g = getNormalizedGrade(r.media);
        return g !== null && g < 60.0;
      });
      const below_expected_count = belowExpectedRows.length;
      const average_below_expected = total_records > 0 ? Math.round((below_expected_count / total_records) * 100) : 0;

      // Card 3: Desempenho Crítico (< 30.0) overall count and percentage
      const criticalGradeRows = allFilteredData.filter(r => {
        const g = getNormalizedGrade(r.media);
        return g !== null && g < 30.0;
      });
      const critical_count = criticalGradeRows.length;
      const percent_critical = total_records > 0 ? Math.round((critical_count / total_records) * 100) : 0;

      // Phase-level "Below expected" (< 60.0) percentages
      const f1_below_percent = validF1.length > 0 ? Math.round((validF1.filter(v => v < 60.0).length / validF1.length) * 100) : 0;
      const f2_below_percent = validF2.length > 0 ? Math.round((validF2.filter(v => v < 60.0).length / validF2.length) * 100) : 0;
      const f3_below_percent = validF3.length > 0 ? Math.round((validF3.filter(v => v < 60.0).length / validF3.length) * 100) : 0;

      // Phase-level "Desempenho Crítico" (< 30.0) percentages
      const f1_crit_percent = validF1.length > 0 ? Math.round((validF1.filter(v => v < 30.0).length / validF1.length) * 100) : 0;
      const f2_crit_percent = validF2.length > 0 ? Math.round((validF2.filter(v => v < 30.0).length / validF2.length) * 100) : 0;
      const f3_crit_percent = validF3.length > 0 ? Math.round((validF3.filter(v => v < 30.0).length / validF3.length) * 100) : 0;

      // 2. Stats (median, min, max, approved_percent, reproved_percent, sem_nota_percent)
      let mediana = 0;
      if (validGrades.length > 0) {
        const sorted = [...validGrades].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        mediana = sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
      }
      const nota_minima = validGrades.length > 0 ? Math.min(...validGrades) : 0;
      const nota_maxima = validGrades.length > 0 ? Math.max(...validGrades) : 0;
      
      const approved_percent = total_records > 0 ? Math.round((approvedRows.length / total_records) * 100) : 0;
      const reproved_percent = total_records > 0 ? Math.round((belowExpectedRows.length / total_records) * 100) : 0;
      
      const semNotaRows = allFilteredData.filter(r => getNormalizedGrade(r.media) === null);
      const sem_nota_percent = total_records > 0 ? Math.round((semNotaRows.length / total_records) * 100) : 0;

      // 3. Sem Acesso (AVA) & Correlation
      const matriculas_sem_acesso = allFilteredData.filter(r => r.diasSemAcesso === "-");
      const count_mat_sem_acesso = matriculas_sem_acesso.length;
      const percent_mat_sem_acesso = total_records > 0 ? (count_mat_sem_acesso / total_records) * 100 : 0;

      const alunosUnicosSet = new Set(allFilteredData.map(r => r.userIdentification || r.studentName));
      const total_alunos_unicos = alunosUnicosSet.size;
      const alunosSemAcessoSet = new Set(matriculas_sem_acesso.map(r => r.userIdentification || r.studentName));
      const count_alunos_sem_acesso = alunosSemAcessoSet.size;
      const percent_alunos_sem_acesso = total_alunos_unicos > 0 ? (count_alunos_sem_acesso / total_alunos_unicos) * 100 : 0;

      // Correlation: percent of no-access records that have a critical grade (< 60.0)
      const semAcessoWithCrit = matriculas_sem_acesso.filter(r => {
        const g = getNormalizedGrade(r.media);
        return g !== null && g < 60.0;
      });
      const percent_sem_acesso_nota_critica = count_mat_sem_acesso > 0
        ? Math.round((semAcessoWithCrit.length / count_mat_sem_acesso) * 100)
        : 0;

      // 4. Histogram Faixas of Grades
      const histogram = { range_0_3: 0, range_3_5: 0, range_5_6: 0, range_6_7: 0, range_7_8: 0, range_8_9: 0, range_9_10: 0 };
      validGrades.forEach(g => {
        if (g >= 0 && g < 30.0) histogram.range_0_3++;
        else if (g >= 30.0 && g < 50.0) histogram.range_3_5++;
        else if (g >= 50.0 && g < 60.0) histogram.range_5_6++;
        else if (g >= 60.0 && g < 70.0) histogram.range_6_7++;
        else if (g >= 70.0 && g < 80.0) histogram.range_7_8++;
        else if (g >= 80.0 && g < 90.0) histogram.range_8_9++;
        else if (g >= 90.0 && g <= 100.0) histogram.range_9_10++;
      });
      const totalValids = validGrades.length || 1;
      const histogram_percents = {
        range_0_3: Math.round((histogram.range_0_3 / totalValids) * 100),
        range_3_5: Math.round((histogram.range_3_5 / totalValids) * 100),
        range_5_6: Math.round((histogram.range_5_6 / totalValids) * 100),
        range_6_7: Math.round((histogram.range_6_7 / totalValids) * 100),
        range_7_8: Math.round((histogram.range_7_8 / totalValids) * 100),
        range_8_9: Math.round((histogram.range_8_9 / totalValids) * 100),
        range_9_10: Math.round((histogram.range_9_10 / totalValids) * 100),
      };

      // 5. Discipline ranking (Melhores e Piores Médias)
      const courseStats: Record<string, { sum: number; count: number; name: string }> = {};
      allFilteredData.forEach(row => {
        const cName = row.courseFullname;
        const grade = getNormalizedGrade(row.media);
        if (cName && grade !== null) {
          if (!courseStats[cName]) {
            courseStats[cName] = { sum: 0, count: 0, name: cName };
          }
          courseStats[cName].sum += grade;
          courseStats[cName].count += 1;
        }
      });
      const courses = Object.values(courseStats).map(c => ({
        name: c.name,
        average: Number((c.sum / c.count).toFixed(1)),
      }));
      const worstCourses = [...courses].sort((a, b) => a.average - b.average).slice(0, 5);
      const bestCourses = [...courses].sort((a, b) => b.average - a.average).slice(0, 5);

      const total_disciplines = courses.length;
      const critical_disciplines = courses.filter(c => c.average < 60.0).length;
      const excellent_disciplines = courses.filter(c => c.average >= 80.0).length;

      // 6. At-risk students (Unique Counts)
      const studentCourseGrades: Record<string, { name: string; grades: (number | null)[] }> = {};
      allFilteredData.forEach(row => {
        const sId = row.userIdentification || row.studentName;
        if (sId) {
          if (!studentCourseGrades[sId]) {
            studentCourseGrades[sId] = { name: row.studentName || '', grades: [] };
          }
          studentCourseGrades[sId].grades.push(getNormalizedGrade(row.media));
        }
      });

      let count_critical_grade = 0; // media < 60.0 in at least one course
      let count_multiple_fail = 0;  // media < 60.0 in 2 or more courses
      let count_no_grade = 0;       // all course grades are null

      Object.values(studentCourseGrades).forEach(s => {
        const grades = s.grades;
        const hasCrit = grades.some(g => g !== null && g < 60.0);
        if (hasCrit) count_critical_grade++;

        const failCount = grades.filter(g => g !== null && g < 60.0).length;
        if (failCount >= 2) count_multiple_fail++;

        const allNull = grades.every(g => g === null);
        if (allNull) count_no_grade++;
      });

      return {
        page, size, total_records, total_pages, data,
        // Overall averages
        average_media: avg_total,
        average_fase1: avg_f1,
        average_fase2: avg_f2,
        average_fase3: avg_f3,
        percent_acima_aprovacao,
        
        // Below expected
        below_expected: below_expected_count,
        average_below_expected,
        f1_below_percent,
        f2_below_percent,
        f3_below_percent,

        // Critical performance
        percent_critical,
        f1_crit_percent,
        f2_crit_percent,
        f3_crit_percent,

        // No access (AVA)
        count_mat_sem_acesso,
        percent_mat_sem_acesso,
        count_alunos_sem_acesso,
        percent_alunos_sem_acesso,
        total_alunos_unicos,
        percent_sem_acesso_nota_critica,

        // Distribution stats
        mediana,
        nota_minima,
        nota_maxima,
        approved_percent,
        reproved_percent,
        sem_nota_percent,
        histogram_percents,

        // Discipline ranking
        total_disciplines,
        critical_disciplines,
        excellent_disciplines,
        worstCourses,
        bestCourses,

        // At-risk students
        count_critical_grade,
        count_multiple_fail,
        count_no_grade,
      };
    } catch (error) {
      console.error("Erro em getGradesData:", error);
      throw new Error("Falha ao buscar dados");
    }
  }

  async exportGradesData(user: SessionUser, filters: any) {
    await this.assertAvaAccess(user);

    try {
      const conditions: any[] = [];
      if (filters.sourceInstitution) conditions.push(eq(avaGradesReport.sourceInstitution, filters.sourceInstitution));
      if (filters.aluno) conditions.push(ilike(avaGradesReport.studentName, `%${filters.aluno}%`));
      if (filters.curso) conditions.push(ilike(avaGradesReport.courseFullname, `%${filters.curso}%`));
      if (filters.usuario) conditions.push(ilike(avaGradesReport.userUsername, `%${filters.usuario}%`));
      if (filters.matricula) conditions.push(ilike(avaGradesReport.userIdentification, `%${filters.matricula}%`));
      const exportPeriodoFilter = filters.periodo !== undefined ? filters.periodo : "2026-1";
      if (exportPeriodoFilter) conditions.push(ilike(avaGradesReport.periodo, `%${exportPeriodoFilter}%`));
      if (filters.curso_perfil) conditions.push(ilike(avaGradesReport.cursoPerfil, `%${filters.curso_perfil}%`));
      if (filters.periodo_perfil) conditions.push(ilike(avaGradesReport.periodoPerfil, `%${filters.periodo_perfil}%`));
      if (filters.unidade_fisica) conditions.push(ilike(avaGradesReport.unidadeFisica, `%${filters.unidade_fisica}%`));
      if (filters.enrolment_status) conditions.push(ilike(avaGradesReport.enrolmentStatus, `%${filters.enrolment_status}%`));

      const acesso_value = filters.lastaccess;
      const filtro_inatividade = filters.dias_sem_acesso;

      if (acesso_value && acesso_value !== "sem_acesso" && acesso_value !== "com_acesso") {
        conditions.push(ilike(avaGradesReport.lastaccess, `%${acesso_value}%`));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rawData = await this.db.select().from(avaGradesReport).where(whereClause);

      const termosSemAcesso = ["nunca acessou", "sem acesso", "", "none", "nulo", "-"];

      let filteredAccessData = rawData;
      if (acesso_value === "sem_acesso") {
        filteredAccessData = rawData.filter(row => termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase()));
      } else if (acesso_value === "com_acesso") {
        filteredAccessData = rawData.filter(row => !termosSemAcesso.includes(String(row.lastaccess || "").trim().toLowerCase()));
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeTime = hoje.getTime();

      let processedData = filteredAccessData.map(row => {
        let dias: number | string = "-";
        const acessoStr = String(row.lastaccess || "").trim();
        
        if (!acessoStr || termosSemAcesso.includes(acessoStr.toLowerCase())) {
          dias = "-";
        } else {
          try {
            const parts = acessoStr.split("/");
            if (parts.length === 3) {
              const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
              if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                const dt = new Date(y, m, d);
                const diff = Math.floor((hojeTime - dt.getTime()) / (1000 * 60 * 60 * 24));
                dias = diff >= 0 ? diff : 0;
              }
            }
          } catch (e) {
            dias = "-";
          }
        }
        return { ...row, diasSemAcesso: String(dias) };
      });

      if (filtro_inatividade && filtro_inatividade !== "") {
        try {
          if (filtro_inatividade.includes("-")) {
            const [minD, maxD] = filtro_inatividade.split("-").map(Number);
            processedData = processedData.filter(row => {
              const d = parseInt(row.diasSemAcesso as string);
              return !isNaN(d) && d >= minD && d <= maxD;
            });
          } else {
            const match = filtro_inatividade.match(/\d+/);
            if (match) {
              const valMin = parseInt(match[0]);
              processedData = processedData.filter(row => {
                const d = parseInt(row.diasSemAcesso as string);
                return !isNaN(d) && d >= valMin;
              });
            }
          }
        } catch (e) {
          console.error("Erro no filtro de inatividade:", e);
        }
      }

      return processedData;
    } catch (error) {
      console.error("Erro ao exportar dados de notas:", error);
      throw new Error("Falha ao exportar dados");
    }
  }

  async getAvaDashboardStats(user: SessionUser) {
    await this.assertAvaAccess(user);

    try {
      const [progressRecords, gradeRecords] = await Promise.all([
        this.db.select({
          sourceInstitution: avaProgressReport.sourceInstitution,
          progressoTotal: avaProgressReport.progressoTotal,
          lastaccess: avaProgressReport.lastaccess,
          updatedAt: avaProgressReport.updatedAt,
        }).from(avaProgressReport),
        this.db.select({
          sourceInstitution: avaGradesReport.sourceInstitution,
          media: avaGradesReport.media,
          updatedAt: avaGradesReport.updatedAt,
        }).from(avaGradesReport)
      ]);

      const totalStudents = progressRecords.length;

      let totalProgressSum = 0;
      let validProgressCount = 0;
      let noAccessCount = 0;

      progressRecords.forEach(r => {
        const progress = this.parseProgress(r.progressoTotal);
        if (progress !== null) {
          totalProgressSum += progress;
          validProgressCount++;
        }

        const dias = this.calculateDiasSemAcesso(r.lastaccess);
        if (this.isSemAcesso(r.lastaccess) || (dias !== "-" && parseInt(dias) > 14)) {
          noAccessCount++;
        }
      });

      const averageProgress = validProgressCount > 0 ? Math.round(totalProgressSum / validProgressCount) : 0;

      let belowApprovalCount = 0;
      let totalGradesSum = 0;
      let validGradesCount = 0;

      gradeRecords.forEach(r => {
        const grade = this.parseProgress(r.media);
        if (grade !== null) {
          totalGradesSum += grade;
          validGradesCount++;
          if (grade < 60) {
            belowApprovalCount++;
          }
        }
      });

      const averageGrade = validGradesCount > 0 ? Math.round(totalGradesSum / validGradesCount) : 0;

      const institutions = ['ead', 'eefn', 'raizes', 'uni', 'uniego'];
      const institutionsStats = institutions.map(inst => {
        const instProgress = progressRecords.filter(r => r.sourceInstitution === inst);
        const instGrades = gradeRecords.filter(r => r.sourceInstitution === inst);

        let instProgressSum = 0;
        let instProgressCount = 0;
        let instNoAccess = 0;
        let lastSyncProgress: Date | null = null;

        instProgress.forEach(r => {
          const progress = this.parseProgress(r.progressoTotal);
          if (progress !== null) {
            instProgressSum += progress;
            instProgressCount++;
          }
          const dias = this.calculateDiasSemAcesso(r.lastaccess);
          if (this.isSemAcesso(r.lastaccess) || (dias !== "-" && parseInt(dias) > 14)) {
            instNoAccess++;
          }
          const dt = r.updatedAt ? new Date(r.updatedAt) : null;
          if (dt && !isNaN(dt.getTime()) && (!lastSyncProgress || dt > lastSyncProgress)) {
            lastSyncProgress = dt;
          }
        });

        let instGradesSum = 0;
        let instGradesCount = 0;
        let instBelowApproval = 0;
        let lastSyncGrades: Date | null = null;

        instGrades.forEach(r => {
          const grade = this.parseProgress(r.media);
          if (grade !== null) {
            instGradesSum += grade;
            instGradesCount++;
            if (grade < 60) {
              instBelowApproval++;
            }
          }
          const dt = r.updatedAt ? new Date(r.updatedAt) : null;
          if (dt && !isNaN(dt.getTime()) && (!lastSyncGrades || dt > lastSyncGrades)) {
            lastSyncGrades = dt;
          }
        });

        const instAvgProgress = instProgressCount > 0 ? Math.round(instProgressSum / instProgressCount) : 0;
        const instAvgGrade = instGradesCount > 0 ? Math.round(instGradesSum / instGradesCount) : 0;

        let lastSync: Date | null = null;
        if (lastSyncProgress && lastSyncGrades) {
          lastSync = lastSyncProgress > lastSyncGrades ? lastSyncProgress : lastSyncGrades;
        } else {
          lastSync = lastSyncProgress || lastSyncGrades;
        }

        return {
          id: inst,
          name: inst.toUpperCase(),
          totalStudents: instProgress.length,
          averageProgress: instAvgProgress,
          averageGrade: instAvgGrade,
          belowApprovalCount: instBelowApproval,
          noAccessCount: instNoAccess,
          lastSync: lastSync ? (lastSync as any).toISOString() : null,
          status: lastSync ? 'success' : 'offline',
        };
      });

      return {
        totalStudents,
        averageProgress,
        averageGrade,
        belowApprovalCount,
        noAccessCount,
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
