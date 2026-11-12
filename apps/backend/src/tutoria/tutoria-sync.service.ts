import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DB_CONNECTION } from '../db/db.provider';
import { sql } from 'drizzle-orm';
import { tutoriaLogsAtividades } from '../db/schema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CacheService } from '../cache/cache.service';

interface TutoriaRawLogItem {
  periodo?: string;
  disciplina_id?: string | number;
  disciplina_codigo?: string;
  disciplina_nome?: string;
  aluno_id?: string | number;
  matricula?: string;
  aluno_nome?: string;
  aluno_email?: string;
  unidade_tematica_nome?: string;
  atividade_id?: string | number;
  tipo_modulo?: string;
  conteudo_nome?: string;
  qtd_cliques_acessos?: string | number;
  tempo_conteudo_minutos?: string | number;
  data_primeiro_acesso_conteudo?: string;
  data_ultimo_acesso_conteudo?: string;
  data_ultimo_acesso_disciplina?: string;
  data_ultimo_login?: string;
}

async function processInChunks<T>(
  label: string,
  items: T[],
  chunkSize: number,
  processor: (chunk: T[]) => Promise<void>,
  onChunkProgress?: (
    chunkNum: number,
    totalChunks: number,
    processedItems: number,
    totalItems: number,
  ) => Promise<void> | void,
) {
  const totalChunks = Math.ceil(items.length / chunkSize);
  console.log(
    `[TUTORIA-SYNC] ${label}: total de ${items.length} registros para processar em ${totalChunks} lotes...`,
  );
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkNum = Math.floor(i / chunkSize) + 1;
    const processedItems = Math.min(i + chunkSize, items.length);
    if (chunkNum === 1 || chunkNum % 10 === 0 || chunkNum === totalChunks) {
      console.log(
        `[TUTORIA-SYNC] ${label}: gravando lote ${chunkNum}/${totalChunks} (${processedItems}/${items.length} registros)...`,
      );
    }
    await processor(chunk);
    if (onChunkProgress) {
      await onChunkProgress(
        chunkNum,
        totalChunks,
        processedItems,
        items.length,
      );
    }
  }
}

@Injectable()
export class TutoriaSyncService {
  private readonly logger = new Logger(TutoriaSyncService.name);
  private isSyncing = false;
  private lastSyncTime: Date | null = null;
  private lastSyncStatus: {
    status: 'idle' | 'running' | 'success' | 'failed';
    recordsProcessed?: number;
    error?: string;
    startedAt?: Date;
    finishedAt?: Date;
  } = { status: 'idle' };

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  // Sincronização automática 2x ao dia: 04:00 AM e 13:00 PM
  @Cron('0 4,13 * * *')
  async handleScheduledSync() {
    this.logger.log(
      '⏰ [CRON] Executando sincronização agendada de logs da Tutoria (EaD - ID 63)...',
    );
    try {
      await this.syncTutoriaLogs('ead');
    } catch (err: any) {
      this.logger.error(
        '❌ [CRON] Falha na sincronização agendada de logs da Tutoria:',
        err.message,
      );
    }
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      ...this.lastSyncStatus,
    };
  }

  async triggerMoodleUpdate(
    institution: string,
    attUrl: string | undefined,
  ): Promise<boolean> {
    if (!attUrl) return false;
    try {
      this.logger.log(
        `[MOODLE] Disparando recálculo de SQL Adiado (Tutoria ID 63) para ${institution}: ${attUrl}`,
      );
      const r = await fetch(attUrl, { cache: 'no-store' });
      this.logger.log(
        `[MOODLE] Recálculo disparado para ${institution} - HTTP ${r.status}`,
      );
      return r.ok;
    } catch (e: any) {
      this.logger.error(
        `[MOODLE] Erro ao disparar recálculo de Tutoria para ${institution}: ${e.message}`,
      );
      return false;
    }
  }

  async syncTutoriaLogs(
    institution = 'ead',
    customGetUrl?: string,
    customAttUrl?: string,
    onProgress?: (progress: number, step: string) => Promise<void>,
  ) {
    if (this.isSyncing) {
      this.logger.warn(
        '⚠️ Sincronização de logs de tutoria já em andamento. Ignorando nova chamada.',
      );
      return { status: 'already_running', message: 'Sync already in progress' };
    }

    const getUrl =
      customGetUrl ||
      process.env.MOODLE_EAD_TUTORIA_GET_URL ||
      'https://avaead.unievangelica.edu.br/webservice/pluginfile.php/1/block_reports/def_report_json/63/dfr.json?token=b9dc7b9cbd71a62048cdd1b27e0bb72d';
    const attUrl =
      customAttUrl ||
      process.env.MOODLE_EAD_TUTORIA_ATT_URL ||
      'https://avaead.unievangelica.edu.br/webservice/rest/server.php?wstoken=b9dc7b9cbd71a62048cdd1b27e0bb72d&moodlewsrestformat=json&wsfunction=block_reports_queue_deferred_report&id=63';

    if (!getUrl) {
      this.logger.error(
        '❌ MOODLE_EAD_TUTORIA_GET_URL não configurada no .env',
      );
      return { status: 'error', reason: 'URL missing' };
    }

    this.isSyncing = true;
    const startedAt = new Date();
    this.lastSyncStatus = { status: 'running', startedAt };

    try {
      if (onProgress) {
        await onProgress(
          5,
          `Buscando relatório de logs (${institution.toUpperCase()}) no Moodle...`,
        );
      }
      this.logger.log(
        `📥 [SYNC] Baixando logs de Tutoria do Moodle: ${getUrl}`,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

      let res: globalThis.Response;
      try {
        res = await fetch(getUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json, text/plain, */*' },
        });
      } catch (fetchError: any) {
        await this.triggerMoodleUpdate(institution, attUrl);
        throw new Error(
          `Falha de conexão com Moodle: ${fetchError.message}. Recálculo agendado via link de atualização.`,
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        await this.triggerMoodleUpdate(institution, attUrl);
        throw new Error(
          `Link de logs indisponível no Moodle (HTTP ${res.status}). Disparada atualização no Moodle.`,
        );
      }

      const textData = await res.text();
      let rawItems: TutoriaRawLogItem[] = [];

      try {
        rawItems = JSON.parse(textData);
      } catch (parseError) {
        // Se ainda não gerou JSON ou retornou HTML de fila
        await this.triggerMoodleUpdate(institution, attUrl);
        throw new Error(
          'O Moodle ainda está processando o relatório em fila ou retornou formato inválido. Solicitação de recálculo enviada.',
        );
      }

      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        this.logger.warn(
          `⚠️ Nenhum registro retornado pelo relatório de Tutoria para ${institution}.`,
        );
        await this.triggerMoodleUpdate(institution, attUrl);
        this.isSyncing = false;
        this.lastSyncTime = new Date();
        this.lastSyncStatus = {
          status: 'success',
          recordsProcessed: 0,
          startedAt,
          finishedAt: new Date(),
        };
        return { status: 'success', records: 0 };
      }

      this.logger.log(
        `📊 [SYNC] ${rawItems.length} registros recebidos. Iniciando gravação em lotes...`,
      );
      if (onProgress) {
        await onProgress(
          20,
          `Gravando ${rawItems.length} registros de logs no banco de dados...`,
        );
      }

      // 1. Inserir os logs brutos em lotes de 1000
      await processInChunks(
        `Logs Tutoria ${institution}`,
        rawItems,
        1000,
        async (chunk) => {
          const rowsToInsert = chunk
            .map((item) => ({
              sourceInstitution: institution,
              periodo: String(item.periodo || '2026-2').trim(),
              disciplinaId: String(item.disciplina_id || '').trim(),
              disciplinaCodigo: item.disciplina_codigo
                ? String(item.disciplina_codigo).trim()
                : null,
              disciplinaNome: item.disciplina_nome
                ? String(item.disciplina_nome).trim()
                : null,
              alunoId: String(item.aluno_id || '').trim(),
              matricula: item.matricula ? String(item.matricula).trim() : null,
              alunoNome: item.aluno_nome
                ? String(item.aluno_nome).trim()
                : null,
              alunoEmail: item.aluno_email
                ? String(item.aluno_email).trim()
                : null,
              unidadeTematicaNome: item.unidade_tematica_nome
                ? String(item.unidade_tematica_nome).trim()
                : null,
              atividadeId: String(item.atividade_id || '').trim(),
              tipoModulo: item.tipo_modulo
                ? String(item.tipo_modulo).trim()
                : null,
              conteudoNome: item.conteudo_nome
                ? String(item.conteudo_nome).trim()
                : null,
              qtdCliquesAcessos: item.qtd_cliques_acessos
                ? parseInt(String(item.qtd_cliques_acessos), 10) || 0
                : 0,
              tempoConteudoMinutos: String(
                item.tempo_conteudo_minutos || '0',
              ).trim(),
              dataPrimeiroAcessoConteudo: item.data_primeiro_acesso_conteudo
                ? String(item.data_primeiro_acesso_conteudo).trim()
                : null,
              dataUltimoAcessoConteudo: item.data_ultimo_acesso_conteudo
                ? String(item.data_ultimo_acesso_conteudo).trim()
                : null,
              dataUltimoAcessoDisciplina: item.data_ultimo_acesso_disciplina
                ? String(item.data_ultimo_acesso_disciplina).trim()
                : null,
              dataUltimoLogin: item.data_ultimo_login
                ? String(item.data_ultimo_login).trim()
                : null,
              updatedAt: new Date(),
            }))
            .filter((r) => r.disciplinaId && r.alunoId && r.atividadeId);

          if (rowsToInsert.length === 0) return;

          await this.db
            .insert(tutoriaLogsAtividades)
            .values(rowsToInsert)
            .onConflictDoUpdate({
              target: [
                tutoriaLogsAtividades.sourceInstitution,
                tutoriaLogsAtividades.periodo,
                tutoriaLogsAtividades.disciplinaId,
                tutoriaLogsAtividades.alunoId,
                tutoriaLogsAtividades.atividadeId,
              ],
              set: {
                disciplinaCodigo: sql`EXCLUDED.disciplina_codigo`,
                disciplinaNome: sql`EXCLUDED.disciplina_nome`,
                matricula: sql`EXCLUDED.matricula`,
                alunoNome: sql`EXCLUDED.aluno_nome`,
                alunoEmail: sql`EXCLUDED.aluno_email`,
                unidadeTematicaNome: sql`EXCLUDED.unidade_tematica_nome`,
                tipoModulo: sql`EXCLUDED.tipo_modulo`,
                conteudoNome: sql`EXCLUDED.conteudo_nome`,
                qtdCliquesAcessos: sql`EXCLUDED.qtd_cliques_acessos`,
                tempoConteudoMinutos: sql`EXCLUDED.tempo_conteudo_minutos`,
                dataPrimeiroAcessoConteudo: sql`EXCLUDED.data_primeiro_acesso_conteudo`,
                dataUltimoAcessoConteudo: sql`EXCLUDED.data_ultimo_acesso_conteudo`,
                dataUltimoAcessoDisciplina: sql`EXCLUDED.data_ultimo_acesso_disciplina`,
                dataUltimoLogin: sql`EXCLUDED.data_ultimo_login`,
                updatedAt: new Date(),
              },
            });
        },
        async (chunkNum, totalChunks, processedItems, totalItems) => {
          if (onProgress) {
            const pct = Math.floor(20 + (processedItems / totalItems) * 60);
            await onProgress(
              pct,
              `Gravando lote ${chunkNum}/${totalChunks} (${processedItems}/${totalItems})...`,
            );
          }
        },
      );

      // 2. Recalcular a tabela de engajamento consolidado
      if (onProgress) {
        await onProgress(
          85,
          'Recalculando indicadores de engajamento por aluno e fase...',
        );
      }
      await this.refreshEngagementSnapshot(institution);

      // 3. Dispara ping pós-sincronização para o Moodle pré-recalcular o próximo ciclo
      this.triggerMoodleUpdate(institution, attUrl).catch(() => {});

      if (this.cacheService) {
        await this.cacheService.delByPattern('tutoria:*');
      }

      if (onProgress) {
        await onProgress(
          100,
          `Sincronização concluída com sucesso! ${rawItems.length} registros processados.`,
        );
      }

      const finishedAt = new Date();
      this.lastSyncTime = finishedAt;
      this.lastSyncStatus = {
        status: 'success',
        recordsProcessed: rawItems.length,
        startedAt,
        finishedAt,
      };

      this.logger.log(
        `✅ [SYNC] Sincronização de Tutoria finalizada: ${rawItems.length} registros salvos e agregados.`,
      );

      return {
        status: 'success',
        records: rawItems.length,
        startedAt,
        finishedAt,
      };
    } catch (err: any) {
      this.lastSyncStatus = {
        status: 'failed',
        error: err.message,
        startedAt,
        finishedAt: new Date(),
      };
      this.logger.error(
        `❌ [SYNC] Erro durante sincronização de Tutoria: ${err.message}`,
      );
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  // Consolidação automática da tabela tutoria_engajamento_aluno
  async refreshEngagementSnapshot(institution = 'ead', periodo?: string) {
    this.logger.log(
      `🔄 [AGREGAÇÃO] Atualizando tabela de engajamento consolidado (${institution})...`,
    );

    const periodoFilter = periodo ? sql`AND l.periodo = ${periodo}` : sql``;

    await this.db.execute(sql`
      INSERT INTO tutoria_engajamento_aluno (
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
        tempo_outros_minutos,
        total_cliques,
        total_atividades_acessadas,
        tempo_leitura_minutos,
        tempo_avaliacoes_minutos,
        grupo_risco_calculado,
        score_engajamento,
        data_ultimo_acesso,
        data_ultimo_login,
        "updatedAt"
      )
      SELECT
        gen_random_uuid(),
        l."sourceInstitution",
        l.periodo,
        l.disciplina_id,
        l.disciplina_codigo,
        l.disciplina_nome,
        l.aluno_id,
        l.matricula,
        l.aluno_nome,
        l.aluno_email,
        ROUND(SUM(COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric), 2)::text,
        ROUND(SUM(CASE WHEN l.unidade_tematica_nome ILIKE 'Fase 1%' THEN COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric ELSE 0 END), 2)::text,
        ROUND(SUM(CASE WHEN l.unidade_tematica_nome ILIKE 'Fase 2%' THEN COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric ELSE 0 END), 2)::text,
        ROUND(SUM(CASE WHEN l.unidade_tematica_nome ILIKE 'Fase 3%' THEN COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric ELSE 0 END), 2)::text,
        ROUND(SUM(CASE WHEN l.unidade_tematica_nome ILIKE '%Apresenta%' THEN COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric ELSE 0 END), 2)::text,
        ROUND(SUM(CASE WHEN l.unidade_tematica_nome NOT ILIKE 'Fase%' AND l.unidade_tematica_nome NOT ILIKE '%Apresenta%' THEN COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric ELSE 0 END), 2)::text,
        SUM(COALESCE(l.qtd_cliques_acessos, 0)),
        COUNT(DISTINCT l.atividade_id),
        ROUND(SUM(CASE WHEN l.tipo_modulo IN ('page', 'book', 'resource', 'folder') THEN COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric ELSE 0 END), 2)::text,
        ROUND(SUM(CASE WHEN l.tipo_modulo IN ('quiz', 'assign') THEN COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric ELSE 0 END), 2)::text,
        -- Classificação preliminar de risco baseada no tempo e engajamento
        CASE
          WHEN SUM(COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric) < 15 THEN 'critico'
          WHEN SUM(COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric) < 60 THEN 'atencao'
          ELSE 'autonomo'
        END,
        -- Score de engajamento normalizado (0 - 100)
        LEAST(100, ROUND(SUM(COALESCE(NULLIF(regexp_replace(l.tempo_conteudo_minutos, '[^0-9.]', '', 'g'), ''), '0')::numeric) / 2))::text,
        -- Datas consolidadas
        COALESCE(MAX(l.data_ultimo_acesso_disciplina), MAX(l.data_ultimo_acesso_conteudo)),
        MAX(l.data_ultimo_login),
        now()
      FROM tutoria_logs_atividades l
      WHERE l."sourceInstitution" = ${institution}
        ${periodoFilter}
      GROUP BY
        l."sourceInstitution",
        l.periodo,
        l.disciplina_id,
        l.disciplina_codigo,
        l.disciplina_nome,
        l.aluno_id,
        l.matricula,
        l.aluno_nome,
        l.aluno_email
      ON CONFLICT ("sourceInstitution", periodo, disciplina_id, aluno_id) DO UPDATE SET
        disciplina_codigo = EXCLUDED.disciplina_codigo,
        disciplina_nome = EXCLUDED.disciplina_nome,
        matricula = EXCLUDED.matricula,
        aluno_nome = EXCLUDED.aluno_nome,
        aluno_email = EXCLUDED.aluno_email,
        tempo_total_minutos = EXCLUDED.tempo_total_minutos,
        tempo_fase1_minutos = EXCLUDED.tempo_fase1_minutos,
        tempo_fase2_minutos = EXCLUDED.tempo_fase2_minutos,
        tempo_fase3_minutos = EXCLUDED.tempo_fase3_minutos,
        tempo_apresentacao_minutos = EXCLUDED.tempo_apresentacao_minutos,
        tempo_outros_minutos = EXCLUDED.tempo_outros_minutos,
        total_cliques = EXCLUDED.total_cliques,
        total_atividades_acessadas = EXCLUDED.total_atividades_acessadas,
        tempo_leitura_minutos = EXCLUDED.tempo_leitura_minutos,
        tempo_avaliacoes_minutos = EXCLUDED.tempo_avaliacoes_minutos,
        grupo_risco_calculado = EXCLUDED.grupo_risco_calculado,
        score_engajamento = EXCLUDED.score_engajamento,
        data_ultimo_acesso = EXCLUDED.data_ultimo_acesso,
        data_ultimo_login = EXCLUDED.data_ultimo_login,
        "updatedAt" = now();
    `);

    this.logger.log(
      `✅ [AGREGAÇÃO] Tabela de engajamento consolidado atualizada.`,
    );
  }
}
