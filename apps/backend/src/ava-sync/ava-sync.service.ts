import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { eq, and, or, sql } from 'drizzle-orm';
import { avaProgressReport, avaGradesReport } from '../db/schema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

async function processInChunks<T>(items: T[], chunkSize: number, processor: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await processor(chunk);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

@Injectable()
export class AvaSyncService implements OnModuleInit {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
  ) {}

  async onModuleInit() {
    try {
      await this.db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS unq_ava_grades ON ava_grades_report ("sourceInstitution", user_id, course_id);
        CREATE UNIQUE INDEX IF NOT EXISTS unq_ava_progress ON ava_progress_report ("sourceInstitution", aluno_id, curso);
        CREATE INDEX IF NOT EXISTS idx_ava_grades_join_user ON ava_grades_report ("sourceInstitution", user_id, course_fullname);
        CREATE INDEX IF NOT EXISTS idx_ava_grades_join_ident ON ava_grades_report ("sourceInstitution", user_identification, course_fullname);
        CREATE INDEX IF NOT EXISTS idx_ava_grades_join_user_short ON ava_grades_report ("sourceInstitution", user_id, course_shortname);
        CREATE INDEX IF NOT EXISTS idx_ava_grades_join_ident_short ON ava_grades_report ("sourceInstitution", user_identification, course_shortname);
        CREATE INDEX IF NOT EXISTS idx_ava_progress_join_aluno ON ava_progress_report ("sourceInstitution", aluno_id, curso);
        CREATE INDEX IF NOT EXISTS idx_ava_progress_join_mat ON ava_progress_report ("sourceInstitution", matricula, curso);
      `);
      console.log('[AvaSyncService] Unique constraints e índices de performance validados no PostgreSQL.');
    } catch (err: any) {
      console.error('[AvaSyncService] Erro ao validar índices no PostgreSQL:', err.message);
    }
  }


  async syncGrades(institution: string, getUrl: string | undefined, attUrl: string | undefined) {

    if (!getUrl) return { source: `${institution}_grades`, status: 'skipped', reason: 'URL missing' };
    console.log(`[SYNC] Iniciando Notas ${institution}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      let res;
      try {
        res = await fetch(getUrl, { cache: 'no-store', signal: controller.signal });
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          return { source: `${institution}_grades`, status: 'skipped', reason: 'Timeout na resposta do Moodle (120s)' };
        }
        return { source: `${institution}_grades`, status: 'skipped', reason: `Erro de conexão: ${fetchError.message}` };
      } finally {
        clearTimeout(timeoutId);
      }


      if (!res.ok) {
        if (res.status === 404) {
          return { source: `${institution}_grades`, status: 'skipped', reason: 'Relatório de notas em fila no Moodle (aguardando geração)' };
        }
        return { source: `${institution}_grades`, status: 'skipped', reason: `Link indisponível no Moodle (HTTP ${res.status})` };
      }


      const textContent = await res.text();
      if (!textContent || textContent.trim() === '') {
        return { source: `${institution}_grades`, status: 'skipped', reason: 'Arquivo de relatório vazio (Moodle gerando)' };
      }

      const cleanText = textContent.trim();
      if (cleanText.startsWith('<!DOCTYPE') || cleanText.startsWith('<html') || cleanText.startsWith('<xml')) {
        return { source: `${institution}_grades`, status: 'skipped', reason: 'Moodle retornou HTML/Erro (Relatório sendo gerado ou não autorizado)' };
      }

      let data;
      try {
        data = JSON.parse(cleanText);
      } catch (parseError: any) {
        return { source: `${institution}_grades`, status: 'skipped', reason: `JSON inválido retornado pelo Moodle: ${parseError.message.substring(0, 50)}` };
      }

      if (!Array.isArray(data)) {
        if (data && typeof data === 'object' && ('exception' in data || 'error' in data || 'message' in data)) {
          return { source: `${institution}_grades`, status: 'skipped', reason: `Erro no Moodle: ${(data as any).message || (data as any).exception || 'Desconhecido'}` };
        }
        return { source: `${institution}_grades`, status: 'skipped', reason: 'Formato de dados inválido (esperado array)' };
      }

      let inserted = 0;
      let updated = 0;

      await processInChunks(data, 250, async (chunk) => {
        const validItems = chunk.filter(item => {

          const userId = String(item.user_id || item.aluno_id || '');
          const courseId = String(item.course_id || '');
          return userId && courseId;
        });

        if (validItems.length === 0) return;

        const inserts = validItems.map(item => ({
            sourceInstitution: institution,
            courseId: String(item.course_id || ''),
            courseFullname: item.course_fullname,
            courseShortname: item.course_shortname,
            userId: String(item.user_id || item.aluno_id || ''),
            userIdentification: item.user_identification,
            userUsername: item.user_username || item.usuario,
            studentName: item.student_name || item.aluno,
            userEmail: item.user_email,
            userPhone1: item.user_phone1,
            userPhone2: item.user_phone2,
            enrolmentStatus: item.enrolment_status,
            cursoPerfil: item.curso_perfil,
            periodoPerfil: item.periodo_perfil,
            unidadeFisica: item.unidade_fisica,
            periodo: item.periodo,
            fase1: String(item.fase1 || ''),
            fase2: String(item.fase2 || ''),
            fase3: String(item.fase3 || ''),
            media: String(item.media || ''),
            customCourse: item.custom_course,
            lastaccess: item.lastaccess,
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
              updatedAt: sql`EXCLUDED."updatedAt"`,
            }
          });

        inserted += inserts.length;
      });

      if (attUrl) {
        console.log(`[MOODLE] Disparando comando de atualização de SQL Adiado para ${institution} (Notas)...`);
        fetch(attUrl, { cache: 'no-store' }).catch(e => console.error(`Erro ao disparar atualização moodle ${institution}:`, e));
      }

      return { source: `${institution}_grades`, status: 'success', inserted, updated };
    } catch (error: any) {
      console.error(`Erro sync notas ${institution}:`, error);
      const cleanReason = error.message && error.message.length > 150
        ? error.message.substring(0, 150) + '...'
        : error.message || 'Erro ao salvar notas no banco';
      return { source: `${institution}_grades`, status: 'error', reason: cleanReason };
    }
  }

  async syncProgress(institution: string, getUrl: string | undefined, attUrl: string | undefined) {
    if (!getUrl) return { source: `${institution}_progress`, status: 'skipped', reason: 'URL missing' };
    console.log(`[SYNC] Iniciando Progresso ${institution}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      let res;
      try {
        res = await fetch(getUrl, { cache: 'no-store', signal: controller.signal });
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          return { source: `${institution}_progress`, status: 'skipped', reason: 'Timeout na resposta do Moodle (120s)' };
        }
        return { source: `${institution}_progress`, status: 'skipped', reason: `Erro de conexão: ${fetchError.message}` };
      } finally {
        clearTimeout(timeoutId);
      }


      if (!res.ok) {
        if (res.status === 404) {
          return { source: `${institution}_progress`, status: 'skipped', reason: 'Relatório de progresso em fila no Moodle (aguardando geração pelo cron)' };
        }
        return { source: `${institution}_progress`, status: 'skipped', reason: `Link indisponível no Moodle (HTTP ${res.status})` };
      }


      const textContent = await res.text();
      if (!textContent || textContent.trim() === '') {
        return { source: `${institution}_progress`, status: 'skipped', reason: 'Arquivo de relatório vazio (Moodle gerando)' };
      }

      const cleanText = textContent.trim();
      if (cleanText.startsWith('<!DOCTYPE') || cleanText.startsWith('<html') || cleanText.startsWith('<xml')) {
        return { source: `${institution}_progress`, status: 'skipped', reason: 'Moodle retornou HTML/Erro (Relatório sendo gerado ou não autorizado)' };
      }

      let data;
      try {
        data = JSON.parse(cleanText);
      } catch (parseError: any) {
        return { source: `${institution}_progress`, status: 'skipped', reason: `JSON inválido retornado pelo Moodle: ${parseError.message.substring(0, 50)}` };
      }

      if (!Array.isArray(data)) {
        if (data && typeof data === 'object' && ('exception' in data || 'error' in data || 'message' in data)) {
          return { source: `${institution}_progress`, status: 'skipped', reason: `Erro no Moodle: ${(data as any).message || (data as any).exception || 'Desconhecido'}` };
        }
        return { source: `${institution}_progress`, status: 'skipped', reason: 'Formato de dados inválido (esperado array)' };
      }

      let inserted = 0;
      let updated = 0;

      await processInChunks(data, 250, async (chunk) => {
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
      });

      if (attUrl) {
        console.log(`[MOODLE] Disparando comando de atualização de SQL Adiado para ${institution} (Progresso)...`);
        fetch(attUrl, { cache: 'no-store' }).catch(e => console.error(`Erro ao disparar atualização moodle progress ${institution}:`, e));
      }

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
