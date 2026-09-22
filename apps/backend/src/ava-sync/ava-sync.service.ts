import { Injectable, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { eq, and, or, sql } from 'drizzle-orm';
import { avaProgressReport, avaGradesReport } from '../db/schema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CacheService } from '../cache/cache.service';

async function processInChunks<T>(
  label: string,
  items: T[],
  chunkSize: number,
  processor: (chunk: T[]) => Promise<void>,
  onChunkProgress?: (chunkNum: number, totalChunks: number, processedItems: number, totalItems: number) => Promise<void> | void
) {
  const totalChunks = Math.ceil(items.length / chunkSize);
  console.log(`[SYNC] ${label}: total de ${items.length} registros para processar em ${totalChunks} lotes...`);
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkNum = Math.floor(i / chunkSize) + 1;
    const processedItems = Math.min(i + chunkSize, items.length);
    if (chunkNum === 1 || chunkNum % 10 === 0 || chunkNum === totalChunks) {
      console.log(`[SYNC] ${label}: gravando lote ${chunkNum}/${totalChunks} (${processedItems}/${items.length} registros)...`);
    }
    await processor(chunk);
    if (onChunkProgress) {
      await onChunkProgress(chunkNum, totalChunks, processedItems, items.length);
    }
  }
}


@Injectable()
export class AvaSyncService implements OnModuleInit {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  async onModuleInit() {
    try {
      await this.db.execute(sql`
        CREATE EXTENSION IF NOT EXISTS pg_trgm;

        ALTER TABLE ava_grades_report ADD COLUMN IF NOT EXISTS lista_fase1 text;
        ALTER TABLE ava_grades_report ADD COLUMN IF NOT EXISTS lista_fase2 text;
        ALTER TABLE ava_grades_report ADD COLUMN IF NOT EXISTS lista_fase3 text;
        ALTER TABLE ava_grades_report ADD COLUMN IF NOT EXISTS lista_notas text;

        CREATE UNIQUE INDEX IF NOT EXISTS unq_ava_grades ON ava_grades_report ("sourceInstitution", user_id, course_id);
        CREATE UNIQUE INDEX IF NOT EXISTS unq_ava_progress ON ava_progress_report ("sourceInstitution", aluno_id, curso);
        CREATE INDEX IF NOT EXISTS idx_ava_grades_join_user ON ava_grades_report ("sourceInstitution", user_id, course_fullname);
        CREATE INDEX IF NOT EXISTS idx_ava_grades_join_ident ON ava_grades_report ("sourceInstitution", user_identification, course_fullname);
        CREATE INDEX IF NOT EXISTS idx_ava_grades_join_user_short ON ava_grades_report ("sourceInstitution", user_id, course_shortname);
        CREATE INDEX IF NOT EXISTS idx_ava_grades_join_ident_short ON ava_grades_report ("sourceInstitution", user_identification, course_shortname);
        CREATE INDEX IF NOT EXISTS idx_ava_progress_join_aluno ON ava_progress_report ("sourceInstitution", aluno_id, curso);
        CREATE INDEX IF NOT EXISTS idx_ava_progress_join_mat ON ava_progress_report ("sourceInstitution", matricula, curso);

        CREATE TABLE IF NOT EXISTS ava_consolidated_report (
          "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
          "sourceInstitution" text NOT NULL,
          "aluno_id" text,
          "matricula" text,
          "usuario" text,
          "aluno" text,
          "email" text,
          "user_phone1" text,
          "periodo" text,
          "curso" text,
          "curso_perfil" text,
          "periodo_perfil" text,
          "unidade_fisica" text,
          "enrolment_status" text,
          "lastaccess" text,
          "dias_sem_acesso" text,
          "progresso_fase1" text,
          "progresso_fase2" text,
          "progresso_fase3" text,
          "progresso_total" text,
          "progresso_lista_fase1" text,
          "progresso_lista_fase2" text,
          "progresso_lista_fase3" text,
          "grade_id" text,
          "nota_fase1" text,
          "nota_fase2" text,
          "nota_fase3" text,
          "media_final" text,
          "notas_lista_fase1" text,
          "notas_lista_fase2" text,
          "notas_lista_fase3" text,
          "lista_notas" text,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS unq_ava_consolidated ON ava_consolidated_report ("sourceInstitution", aluno_id, curso);
        CREATE INDEX IF NOT EXISTS idx_ava_consolidated_inst_period ON ava_consolidated_report ("sourceInstitution", periodo);
        CREATE INDEX IF NOT EXISTS idx_ava_consolidated_filters ON ava_consolidated_report ("sourceInstitution", periodo, curso_perfil, periodo_perfil, unidade_fisica);
        CREATE INDEX IF NOT EXISTS idx_ava_consolidated_status ON ava_consolidated_report ("sourceInstitution", enrolment_status);
        CREATE INDEX IF NOT EXISTS idx_ava_consolidated_aluno_trgm ON ava_consolidated_report USING gin (aluno gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_ava_consolidated_curso_trgm ON ava_consolidated_report USING gin (curso gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_ava_consolidated_matricula_trgm ON ava_consolidated_report USING gin (matricula gin_trgm_ops);
      `);
      console.log('[AvaSyncService] Colunas, unique constraints e índices de performance validados no PostgreSQL.');

      // População inicial automática caso o snapshot esteja vazio
      const countRes: any = await this.db.execute(sql`SELECT count(*) as total FROM ava_consolidated_report;`);
      if (Number(countRes[0]?.total || 0) === 0) {
        console.log('[AvaSyncService] Snapshot consolidado vazio. Executando população inicial automática...');
        await this.refreshConsolidatedSnapshot();
      }
    } catch (err: any) {
      console.error('[AvaSyncService] Erro ao validar schema e índices no PostgreSQL:', err.message);
    }
  }

  async refreshConsolidatedSnapshot(institution?: string) {
    console.log(`[AvaSyncService] Atualizando snapshot consolidado${institution ? ` (${institution})` : ''}...`);
    const t0 = Date.now();
    try {
      const instFilter = institution ? sql`AND p."sourceInstitution" = ${institution}` : sql``;

      await this.db.execute(sql`
        INSERT INTO ava_consolidated_report (
          "id",
          "sourceInstitution",
          "aluno_id",
          "matricula",
          "usuario",
          "aluno",
          "email",
          "user_phone1",
          "periodo",
          "curso",
          "curso_perfil",
          "periodo_perfil",
          "unidade_fisica",
          "enrolment_status",
          "lastaccess",
          "dias_sem_acesso",
          "progresso_fase1",
          "progresso_fase2",
          "progresso_fase3",
          "progresso_total",
          "progresso_lista_fase1",
          "progresso_lista_fase2",
          "progresso_lista_fase3",
          "grade_id",
          "nota_fase1",
          "nota_fase2",
          "nota_fase3",
          "media_final",
          "notas_lista_fase1",
          "notas_lista_fase2",
          "notas_lista_fase3",
          "lista_notas",
          "updatedAt"
        )
        SELECT 
          gen_random_uuid(),
          p."sourceInstitution",
          p.aluno_id,
          p.matricula,
          p.usuario,
          p.aluno,
          g.user_email,
          p.user_phone1,
          p.periodo,
          p.curso,
          p.curso_perfil,
          p.periodo_perfil,
          p.unidade_fisica,
          p.enrolment_status,
          p.lastaccess,
          p.dias_sem_acesso,
          p.fase1,
          p.fase2,
          p.fase3,
          p.progresso_total,
          p.lista_fase1,
          p.lista_fase2,
          p.lista_fase3,
          g.id,
          g.fase1,
          g.fase2,
          g.fase3,
          g.media,
          g.lista_fase1,
          g.lista_fase2,
          g.lista_fase3,
          g.lista_notas,
          now()
        FROM ava_progress_report p
        LEFT JOIN ava_grades_report g
          ON p."sourceInstitution" = g."sourceInstitution"
         AND (p.aluno_id = g.user_id OR p.matricula = g.user_identification)
         AND (
           p.curso = g.course_fullname 
           OR p.curso = g.course_shortname
           OR regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_fullname, '[^a-zA-Z0-9]', '', 'g')
           OR regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_shortname, '[^a-zA-Z0-9]', '', 'g')
         )
        WHERE 1=1 ${instFilter}
        ON CONFLICT ("sourceInstitution", aluno_id, curso) DO UPDATE SET
          "matricula" = EXCLUDED."matricula",
          "usuario" = EXCLUDED."usuario",
          "aluno" = EXCLUDED."aluno",
          "email" = EXCLUDED."email",
          "user_phone1" = EXCLUDED."user_phone1",
          "periodo" = EXCLUDED."periodo",
          "curso_perfil" = EXCLUDED."curso_perfil",
          "periodo_perfil" = EXCLUDED."periodo_perfil",
          "unidade_fisica" = EXCLUDED."unidade_fisica",
          "enrolment_status" = EXCLUDED."enrolment_status",
          "lastaccess" = EXCLUDED."lastaccess",
          "dias_sem_acesso" = EXCLUDED."dias_sem_acesso",
          "progresso_fase1" = EXCLUDED."progresso_fase1",
          "progresso_fase2" = EXCLUDED."progresso_fase2",
          "progresso_fase3" = EXCLUDED."progresso_fase3",
          "progresso_total" = EXCLUDED."progresso_total",
          "progresso_lista_fase1" = EXCLUDED."progresso_lista_fase1",
          "progresso_lista_fase2" = EXCLUDED."progresso_lista_fase2",
          "progresso_lista_fase3" = EXCLUDED."progresso_lista_fase3",
          "grade_id" = EXCLUDED."grade_id",
          "nota_fase1" = EXCLUDED."nota_fase1",
          "nota_fase2" = EXCLUDED."nota_fase2",
          "nota_fase3" = EXCLUDED."nota_fase3",
          "media_final" = EXCLUDED."media_final",
          "notas_lista_fase1" = EXCLUDED."notas_lista_fase1",
          "notas_lista_fase2" = EXCLUDED."notas_lista_fase2",
          "notas_lista_fase3" = EXCLUDED."notas_lista_fase3",
          "lista_notas" = EXCLUDED."lista_notas",
          "updatedAt" = now();
      `);

      console.log(`[AvaSyncService] Snapshot consolidado atualizado com sucesso em ${Date.now() - t0}ms.`);

      if (this.cacheService) {
        await this.cacheService.delByPattern('ava:dropdowns:*');
      }
    } catch (err: any) {
      console.error('[AvaSyncService] Erro ao atualizar snapshot consolidado:', err.message);
    }
  }



  async triggerMoodleUpdate(institution: string, attUrl: string | undefined, label: string): Promise<boolean> {
    if (!attUrl) return false;
    try {
      console.log(`[MOODLE] Disparando comando de atualização de SQL Adiado para ${institution} (${label}): ${attUrl}`);
      const r = await fetch(attUrl, { cache: 'no-store' });
      console.log(`[MOODLE] Atualização de SQL Adiado disparada para ${institution} (${label}) - HTTP ${r.status}`);
      return r.ok;
    } catch (e: any) {
      console.error(`[MOODLE] Erro ao disparar atualização para ${institution} (${label}):`, e.message);
      return false;
    }
  }

  async syncGrades(
    institution: string,
    getUrl: string | undefined,
    attUrl: string | undefined,
    onProgress?: (progress: number, step: string) => Promise<void>
  ) {
    if (!getUrl) return { source: `${institution}_grades`, status: 'skipped', reason: 'URL missing' };
    console.log(`[SYNC] Iniciando Notas ${institution}...`);
    if (onProgress) await onProgress(5, `Buscando relatório de notas (${institution.toUpperCase()}) no Moodle...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      let res;
      try {
        res = await fetch(getUrl, { cache: 'no-store', signal: controller.signal });
      } catch (fetchError: any) {
        await this.triggerMoodleUpdate(institution, attUrl, 'Notas');
        if (fetchError.name === 'AbortError') {
          return { source: `${institution}_grades`, status: 'queued', reason: 'Timeout na resposta do Moodle (120s). Disparada solicitação de atualização do SQL Adiado.' };
        }
        return { source: `${institution}_grades`, status: 'queued', reason: `Erro de conexão com Moodle: ${fetchError.message}. Disparada solicitação de atualização do SQL Adiado.` };
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        await this.triggerMoodleUpdate(institution, attUrl, 'Notas');
        if (res.status === 404) {
          return { source: `${institution}_grades`, status: 'queued', reason: 'Relatório de notas em fila no Moodle (aguardando geração). Disparada a execução do SQL Adiado no Moodle.' };
        }
        return { source: `${institution}_grades`, status: 'queued', reason: `Link indisponível no Moodle (HTTP ${res.status}). Disparada atualização do SQL Adiado.` };
      }

      const textContent = await res.text();
      if (!textContent || textContent.trim() === '') {
        await this.triggerMoodleUpdate(institution, attUrl, 'Notas');
        return { source: `${institution}_grades`, status: 'queued', reason: 'Arquivo de relatório vazio (Moodle gerando). Disparada atualização do SQL Adiado.' };
      }

      const cleanText = textContent.trim();
      if (cleanText.startsWith('<!DOCTYPE') || cleanText.startsWith('<html') || cleanText.startsWith('<xml')) {
        await this.triggerMoodleUpdate(institution, attUrl, 'Notas');
        return { source: `${institution}_grades`, status: 'queued', reason: 'Moodle retornou HTML/Processamento. Disparada atualização do SQL Adiado.' };
      }

      let data;
      try {
        data = JSON.parse(cleanText);
      } catch (parseError: any) {
        await this.triggerMoodleUpdate(institution, attUrl, 'Notas');
        return { source: `${institution}_grades`, status: 'skipped', reason: `JSON inválido retornado pelo Moodle: ${parseError.message.substring(0, 50)}` };
      }

      if (!Array.isArray(data)) {
        if (data && typeof data === 'object' && ('exception' in data || 'error' in data || 'message' in data)) {
          this.triggerMoodleUpdate(institution, attUrl, 'Notas').catch(() => {});
          return { source: `${institution}_grades`, status: 'skipped', reason: `Erro no Moodle: ${(data as any).message || (data as any).exception || 'Desconhecido'}` };
        }
        return { source: `${institution}_grades`, status: 'skipped', reason: 'Formato de dados inválido (esperado array)' };
      }

      if (onProgress) await onProgress(15, `Processando ${data.length} notas (${institution.toUpperCase()})...`);

      let inserted = 0;
      let updated = 0;

      await processInChunks(`Notas ${institution}`, data, 250, async (chunk) => {
        const validItems = chunk.filter(item => {
          const userId = String(item.user_id || item.aluno_id || '');
          const courseId = String(item.course_id || '');
          return userId && courseId;
        });

        if (validItems.length === 0) return;

        const inserts = validItems.map(item => ({
            sourceInstitution: institution,
            courseId: String(item.course_id || item.courseid || ''),
            courseFullname: item.course_fullname || item.curso_nome || item.fullname,
            courseShortname: item.course_shortname || item.curso_codigo || item.shortname,
            userId: String(item.user_id || item.aluno_id || item.userid || ''),
            userIdentification: item.user_identification || item.matricula || item.idnumber,
            userUsername: item.user_username || item.usuario || item.username,
            studentName: item.student_name || item.aluno || item.nome_aluno,
            userEmail: item.user_email || item.email,
            userPhone1: item.user_phone1 || item.telefone,
            userPhone2: item.user_phone2,
            enrolmentStatus: item.enrolment_status || item.status_matricula,
            cursoPerfil: item.curso_perfil || item.Curso_Perfil || item.custom_curso,
            periodoPerfil: item.periodo_perfil || item.Periodo_Perfil || item.custom_periodo,
            unidadeFisica: item.unidade_fisica || item.Unidade_Perfil || item.polo,
            periodo: item.periodo || item.Periodo,
            fase1: String(item.fase1 ?? item.fase_1_nota ?? ''),
            fase2: String(item.fase2 ?? item.fase_2_nota ?? ''),
            fase3: String(item.fase3 ?? item.fase_3_nota ?? ''),
            media: String(item.media ?? item.curso_nota_final ?? item.media_final ?? ''),
            customCourse: item.custom_course,
            lastaccess: item.lastaccess,
            listaFase1: item.lista_fase1 || item.lista_notas_fase1 || item.fase_1_atividades || null,
            listaFase2: item.lista_fase2 || item.lista_notas_fase2 || item.fase_2_atividades || null,
            listaFase3: item.lista_fase3 || item.lista_notas_fase3 || item.fase_3_atividades || null,
            listaNotas: item.lista_notas || null,
            updatedAt: new Date()
        }));

        // Deduplicate locally to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const uniqueInsertsMap = new Map();
        for (const insert of inserts) {
          const key = `${insert.sourceInstitution}-${insert.userId}-${insert.courseId}`;
          uniqueInsertsMap.set(key, insert);
        }
        const uniqueInserts = Array.from(uniqueInsertsMap.values());

        await this.db.insert(avaGradesReport)
          .values(uniqueInserts)
          .onConflictDoUpdate({
            target: [avaGradesReport.sourceInstitution, avaGradesReport.userId, avaGradesReport.courseId],
            set: {
              courseFullname: sql`EXCLUDED."course_fullname"`,
              courseShortname: sql`EXCLUDED."course_shortname"`,
              userIdentification: sql`EXCLUDED."user_identification"`,
              userUsername: sql`EXCLUDED."user_username"`,
              studentName: sql`EXCLUDED."student_name"`,
              userEmail: sql`EXCLUDED."user_email"`,
              userPhone1: sql`EXCLUDED."user_phone1"`,
              userPhone2: sql`EXCLUDED."user_phone2"`,
              enrolmentStatus: sql`EXCLUDED."enrolment_status"`,
              cursoPerfil: sql`EXCLUDED."curso_perfil"`,
              periodoPerfil: sql`EXCLUDED."periodo_perfil"`,
              unidadeFisica: sql`EXCLUDED."unidade_fisica"`,
              periodo: sql`EXCLUDED."periodo"`,
              fase1: sql`EXCLUDED."fase1"`,
              fase2: sql`EXCLUDED."fase2"`,
              fase3: sql`EXCLUDED."fase3"`,
              media: sql`EXCLUDED."media"`,
              customCourse: sql`EXCLUDED."custom_course"`,
              lastaccess: sql`EXCLUDED."lastaccess"`,
              listaFase1: sql`EXCLUDED."lista_fase1"`,
              listaFase2: sql`EXCLUDED."lista_fase2"`,
              listaFase3: sql`EXCLUDED."lista_fase3"`,
              listaNotas: sql`EXCLUDED."lista_notas"`,
              updatedAt: sql`EXCLUDED."updatedAt"`,
            }
          });

        inserted += inserts.length;
      }, async (chunkNum, totalChunks, processedItems, totalItems) => {
        if (onProgress) {
          const chunkPct = Math.round(15 + (chunkNum / totalChunks) * 70);
          await onProgress(chunkPct, `Gravando notas (${institution.toUpperCase()}): lote ${chunkNum}/${totalChunks} (${processedItems}/${totalItems})`);
        }
      });

      console.log(`[SYNC] Notas ${institution} concluído: ${inserted} registros salvos no banco.`);

      // Atualizar Snapshot Consolidado automaticamente
      if (onProgress) await onProgress(88, `Atualizando consolidado de ${institution.toUpperCase()}...`);
      await this.refreshConsolidatedSnapshot(institution);

      // Disparar atualização do SQL Adiado para o próximo ciclo
      this.triggerMoodleUpdate(institution, attUrl, 'Notas').catch(() => {});

      if (onProgress) await onProgress(100, `Notas de ${institution.toUpperCase()} sincronizadas com sucesso!`);
      return { source: `${institution}_grades`, status: 'success', inserted, updated };

    } catch (error: any) {
      console.error(`Erro sync notas ${institution}:`, error);
      const cleanReason = error.message && error.message.length > 150
        ? error.message.substring(0, 150) + '...'
        : error.message || 'Erro ao salvar notas no banco';
      return { source: `${institution}_grades`, status: 'error', reason: cleanReason };
    }
  }

  async syncProgress(
    institution: string,
    getUrl: string | undefined,
    attUrl: string | undefined,
    onProgress?: (progress: number, step: string) => Promise<void>
  ) {
    if (!getUrl) return { source: `${institution}_progress`, status: 'skipped', reason: 'URL missing' };
    console.log(`[SYNC] Iniciando Progresso ${institution}...`);
    if (onProgress) await onProgress(5, `Buscando relatório de progresso (${institution.toUpperCase()}) no Moodle...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      let res;
      try {
        res = await fetch(getUrl, { cache: 'no-store', signal: controller.signal });
      } catch (fetchError: any) {
        await this.triggerMoodleUpdate(institution, attUrl, 'Progresso');
        if (fetchError.name === 'AbortError') {
          return { source: `${institution}_progress`, status: 'queued', reason: 'Timeout na resposta do Moodle (120s). Disparada solicitação de atualização do SQL Adiado.' };
        }
        return { source: `${institution}_progress`, status: 'queued', reason: `Erro de conexão: ${fetchError.message}. Disparada solicitação de atualização do SQL Adiado.` };
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        await this.triggerMoodleUpdate(institution, attUrl, 'Progresso');
        if (res.status === 404) {
          return { source: `${institution}_progress`, status: 'queued', reason: 'Relatório de progresso em fila no Moodle (aguardando geração). Disparada a execução do SQL Adiado no Moodle.' };
        }
        return { source: `${institution}_progress`, status: 'queued', reason: `Link indisponível no Moodle (HTTP ${res.status}). Disparada atualização do SQL Adiado.` };
      }

      const textContent = await res.text();
      if (!textContent || textContent.trim() === '') {
        await this.triggerMoodleUpdate(institution, attUrl, 'Progresso');
        return { source: `${institution}_progress`, status: 'queued', reason: 'Arquivo de relatório vazio (Moodle gerando). Disparada atualização do SQL Adiado.' };
      }

      const cleanText = textContent.trim();
      if (cleanText.startsWith('<!DOCTYPE') || cleanText.startsWith('<html') || cleanText.startsWith('<xml')) {
        await this.triggerMoodleUpdate(institution, attUrl, 'Progresso');
        return { source: `${institution}_progress`, status: 'queued', reason: 'Moodle retornou HTML/Processamento. Disparada atualização do SQL Adiado.' };
      }

      let data;
      try {
        data = JSON.parse(cleanText);
      } catch (parseError: any) {
        await this.triggerMoodleUpdate(institution, attUrl, 'Progresso');
        return { source: `${institution}_progress`, status: 'skipped', reason: `JSON inválido retornado pelo Moodle: ${parseError.message.substring(0, 50)}` };
      }

      if (!Array.isArray(data)) {
        if (data && typeof data === 'object' && ('exception' in data || 'error' in data || 'message' in data)) {
          this.triggerMoodleUpdate(institution, attUrl, 'Progresso').catch(() => {});
          return { source: `${institution}_progress`, status: 'skipped', reason: `Erro no Moodle: ${(data as any).message || (data as any).exception || 'Desconhecido'}` };
        }
        return { source: `${institution}_progress`, status: 'skipped', reason: 'Formato de dados inválido (esperado array)' };
      }

      if (onProgress) await onProgress(15, `Processando ${data.length} registros de progresso (${institution.toUpperCase()})...`);

      let inserted = 0;
      let updated = 0;

      await processInChunks(`Progresso ${institution}`, data, 250, async (chunk) => {
        const validItems = chunk.filter(item => {
          const matricula = String(item.matricula || '');
          const curso = String(item.curso || '');
          return matricula && curso;
        });

        if (validItems.length === 0) return;

        const inserts = validItems.map(item => {
          const studentIdentifier = String(item.aluno_id || item.matricula || item.usuario || '').trim();
          return {
            sourceInstitution: institution,
            alunoId: studentIdentifier,
            usuario: item.usuario,
            aluno: item.aluno,
            matricula: String(item.matricula || ''),
            userPhone1: item.user_phone1 || null,
            periodo: item.periodo,
            enrolmentStatus: item.enrolment_status,
            lastaccess: item.lastaccess,
            curso: String(item.curso || ''),
            fase1: String(item.fase1 || ''),
            fase2: String(item.fase2 || ''),
            fase3: String(item.fase3 || ''),
            cursoPerfil: item.curso_perfil,
            periodoPerfil: item.periodo_perfil,
            unidadeFisica: item.unidade_fisica,
            progressoTotal: String(item.progresso_total || item.media || ''),
            listaFase1: item.lista_fase1,
            listaFase2: item.lista_fase2,
            listaFase3: item.lista_fase3,
            diasSemAcesso: String(item.dias_sem_acesso || ''),
            updatedAt: new Date()
          };
        });

        // Deduplicate locally to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const uniqueInsertsMap = new Map();
        for (const insert of inserts) {
          const studentKey = insert.alunoId || insert.matricula || insert.usuario;
          const key = `${insert.sourceInstitution}-${studentKey}-${insert.curso}`;
          uniqueInsertsMap.set(key, insert);
        }
        const uniqueInserts = Array.from(uniqueInsertsMap.values());

        await this.db.insert(avaProgressReport)
          .values(uniqueInserts)
          .onConflictDoUpdate({
            target: [avaProgressReport.sourceInstitution, avaProgressReport.alunoId, avaProgressReport.curso],
            set: {
              usuario: sql`EXCLUDED."usuario"`,
              aluno: sql`EXCLUDED."aluno"`,
              matricula: sql`EXCLUDED."matricula"`,
              userPhone1: sql`EXCLUDED."user_phone1"`,
              periodo: sql`EXCLUDED."periodo"`,
              enrolmentStatus: sql`EXCLUDED."enrolment_status"`,
              lastaccess: sql`EXCLUDED."lastaccess"`,
              fase1: sql`EXCLUDED."fase1"`,
              fase2: sql`EXCLUDED."fase2"`,
              fase3: sql`EXCLUDED."fase3"`,
              cursoPerfil: sql`EXCLUDED."curso_perfil"`,
              periodoPerfil: sql`EXCLUDED."periodo_perfil"`,
              unidadeFisica: sql`EXCLUDED."unidade_fisica"`,
              progressoTotal: sql`EXCLUDED."progresso_total"`,
              listaFase1: sql`EXCLUDED."lista_fase1"`,
              listaFase2: sql`EXCLUDED."lista_fase2"`,
              listaFase3: sql`EXCLUDED."lista_fase3"`,
              diasSemAcesso: sql`EXCLUDED."dias_sem_acesso"`,
              updatedAt: sql`EXCLUDED."updatedAt"`,
            }
          });

        inserted += inserts.length;
      }, async (chunkNum, totalChunks, processedItems, totalItems) => {
        if (onProgress) {
          const chunkPct = Math.round(15 + (chunkNum / totalChunks) * 70);
          await onProgress(chunkPct, `Gravando progresso (${institution.toUpperCase()}): lote ${chunkNum}/${totalChunks} (${processedItems}/${totalItems})`);
        }
      });

      console.log(`[SYNC] Progresso ${institution} concluído: ${inserted} registros salvos no banco.`);

      // Atualizar Snapshot Consolidado automaticamente
      if (onProgress) await onProgress(88, `Atualizando consolidado de ${institution.toUpperCase()}...`);
      await this.refreshConsolidatedSnapshot(institution);

      // Disparar atualização do SQL Adiado para o próximo ciclo
      this.triggerMoodleUpdate(institution, attUrl, 'Progresso').catch(() => {});

      if (onProgress) await onProgress(100, `Progresso de ${institution.toUpperCase()} sincronizado com sucesso!`);
      return { source: `${institution}_progress`, status: 'success', inserted, updated };

    } catch (error: any) {
      console.error(`Erro sync progresso ${institution}:`, error);
      const cleanReason = error.message && error.message.length > 150
        ? error.message.substring(0, 150) + '...'
        : error.message || 'Erro ao salvar progresso no banco';
      return { source: `${institution}_progress`, status: 'error', reason: cleanReason };
    }
  }

}
