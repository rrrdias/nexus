import { Injectable, Inject } from '@nestjs/common';
import { DB_CONNECTION } from '../../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { 
  syncedTurmas, 
  syncedUsuarios, 
  syncedMatriculas, 
  integrationJobs, 
  avaOpenlms 
} from '../../db/schema';
import { eq, and, sql as drizzleSql, count } from 'drizzle-orm';
import { AcademicService } from '../academic.service';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as mssql from 'mssql';

@Injectable()
export class IntegrationsService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private readonly academicService: AcademicService,
  ) {}

  // Get directory containing Nexus AVA tabula.yaml configs
  private getYamlDir(): string {
    // 1. Check if configured in environment variable
    if (process.env.NEXUS_AVA_YAML_DIR) {
      let dir = process.env.NEXUS_AVA_YAML_DIR;
      if (dir.startsWith('"') && dir.endsWith('"')) dir = dir.substring(1, dir.length - 1);
      if (dir.startsWith("'") && dir.endsWith("'")) dir = dir.substring(1, dir.length - 1);
      return path.normalize(dir);
    }
    
    // 2. Try the local development directory (relative to backend project cwd)
    const devPath = path.join(process.cwd(), 'profiles');
    if (fs.existsSync(devPath)) {
      return devPath;
    }
    
    // 3. Try the docker production directory (relative to monorepo backend build path)
    const prodPath = path.join(process.cwd(), 'apps/backend/profiles');
    if (fs.existsSync(prodPath)) {
      return prodPath;
    }

    return devPath;
  }

  // 1. Retrieve all Tabula YAML config profiles
  async getProfiles() {
    const yamlDir = this.getYamlDir();
    try {
      if (!fs.existsSync(yamlDir)) {
        return [];
      }
      const files = fs.readdirSync(yamlDir);
      const tabulaFiles = files.filter(f => f.startsWith('tabula') && f.endsWith('.yaml'));
      
      const profiles = tabulaFiles.map(file => {
        try {
          const filePath = path.join(yamlDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed: any = yaml.load(content);
          return {
            fileName: file,
            name: parsed.name || file,
            jobs: parsed.jobs ? Object.keys(parsed.jobs) : [],
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      return profiles;
    } catch (err) {
      console.error('[Integrations] Failed to read profiles:', err);
      return [];
    }
  }

  // 2. Get statistics of local synced tables in Postgres
  async getSyncedStats() {
    const [turmasCount, usuariosCount, matriculasCount] = await Promise.all([
      this.db.select({ value: count() }).from(syncedTurmas),
      this.db.select({ value: count() }).from(syncedUsuarios),
      this.db.select({ value: count() }).from(syncedMatriculas),
    ]);

    return {
      turmas: turmasCount[0]?.value || 0,
      usuarios: usuariosCount[0]?.value || 0,
      matriculas: matriculasCount[0]?.value || 0,
    };
  }

  // 3. Get history of integration executions
  async getJobHistory() {
    return this.db.select()
      .from(integrationJobs)
      .orderBy(drizzleSql`${integrationJobs.startedAt} DESC`)
      .limit(20);
  }

  // Helper to generate Conduit compatible XML
  private generateXml(action: string, data: any[], mappings: Record<string, string>, parseFn?: (row: any) => Record<string, any>): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<data>\n`;
    for (const item of data) {
      xml += `  <datum action="${action}">\n`;
      const mapped: Record<string, any> = {};
      for (const [xmlKey, dbKey] of Object.entries(mappings)) {
        mapped[xmlKey] = item[dbKey] ?? '';
      }
      if (parseFn) {
        const parsed = parseFn(item);
        for (const [xmlKey, val] of Object.entries(parsed)) {
          mapped[xmlKey] = val ?? '';
        }
      }

      for (const [key, value] of Object.entries(mapped)) {
        const escapedValue = String(value).replace(/]]>/g, ']]]]><![CDATA[>');
        xml += `    <mapping name="${key}"><![CDATA[${escapedValue}]]></mapping>\n`;
      }
      xml += `  </datum>\n`;
    }
    xml += `</data>`;
    return xml;
  }

  // Helper to send HTTP requests to Moodle Conduit API
  private async sendToMoodle(site: string, token: string, endpoint: string, xmlContent: string, logCallback: (msg: string) => void): Promise<boolean> {
    const url = `https://${site}/blocks/conduit/webservices/rest/${endpoint}`;
    logCallback(`[MOODLE] Enviando ${xmlContent.split('<datum').length - 1} registros para ${url}...`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          method: 'handle',
          token: token,
          xml: xmlContent,
        }),
      });

      if (response.ok) {
        logCallback(`[MOODLE] Sucesso: HTTP ${response.status}`);
        return true;
      } else {
        const errorText = await response.text();
        logCallback(`[MOODLE] Erro HTTP ${response.status}: ${errorText.substring(0, 150)}`);
        return false;
      }
    } catch (err: any) {
      logCallback(`[MOODLE] Exceção de conexão: ${err.message}`);
      return false;
    }
  }

  // 4. RUN SYNC ENGINE IN TYPESCRIPT
  async runSyncJob(profileName: string, jobName: string, logCallback: (msg: string) => void) {
    const startTime = new Date();
    const jobId = await this.db.insert(integrationJobs).values({
      name: jobName,
      profile: profileName,
      unidade: 'Carregando...',
      periodo: 'Carregando...',
      status: 'running',
      logs: '',
    }).returning();

    const jobRecordId = jobId[0].id;
    let logsAccumulator = '';
    const appendLog = (msg: string) => {
      const formatted = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
      logsAccumulator += formatted;
      logCallback(msg);
    };

    try {
      appendLog(`Iniciando Job "${jobName}" de perfil "${profileName}"`);

      // A. Load YAML Configuration
      const yamlDir = this.getYamlDir();
      const filePath = path.join(yamlDir, profileName);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo de configuração ${profileName} não encontrado em ${yamlDir}`);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const parsed: any = yaml.load(content);
      const jobConfig = parsed?.jobs?.[jobName];
      if (!jobConfig) {
        throw new Error(`Job "${jobName}" não encontrado dentro de ${profileName}`);
      }

      const unidade = jobConfig.unidade;
      const periodo = jobConfig.periodo;
      const cursoTipo = jobConfig['curso-tipo'];
      const modo = jobConfig.modo || 'sandbox';
      const syncTurmasOption = !!jobConfig.sync?.turmas;
      const syncAlunosOption = !!jobConfig.sync?.matriculas?.aluno;

      appendLog(`Unidade: ${unidade} | Período: ${periodo} | Modo: ${modo}`);
      
      // Update job properties in db
      await this.db.update(integrationJobs)
        .set({ unidade, periodo })
        .where(eq(integrationJobs.id, jobRecordId));

      // B. Fetch Moodle Credentials from local PostgreSQL
      const moodleConfig = await this.db.select()
        .from(avaOpenlms)
        .where(and(eq(avaOpenlms.unidadeEns, unidade), eq(avaOpenlms.status, true)))
        .limit(1);

      if (moodleConfig.length === 0) {
        throw new Error(`Credenciais Moodle não cadastradas para a unidade "${unidade}" na tabela ava_openlms`);
      }

      const mConn = moodleConfig[0];
      const site = modo === 'sandbox' ? mConn.urlSandbox : mConn.urlProd;
      const token = modo === 'sandbox' ? mConn.tokenSandbox : mConn.tokenProd;

      appendLog(`Moodle URL conectada: ${site}`);

      // C. Connect to SQL Server
      const pool = this.academicService.getSqlPool();
      const dbPrefix = this.academicService.getDbPrefix();

      // ==========================================
      // ETAPA 1: Sincronização de Turmas (Salas)
      // ==========================================
      if (syncTurmasOption) {
        appendLog(`[TURMAS] Buscando turmas ativas do Lyceum...`);
        const req = pool.request();
        req.input('unidade', mssql.VarChar, unidade);
        req.input('cursoTipo', mssql.VarChar, cursoTipo);
        req.input('periodo', mssql.VarChar, periodo);

        const sqlTurmas = `
          SELECT TOP (10000)
              C.UNIDADE_ENS,
              CASE 
                  WHEN T.UNIDADE_FISICA = 'CA1' THEN 'Campus Anápolis'
                  WHEN T.UNIDADE_FISICA = 'CA2' THEN 'Campus Ceres'
                  WHEN T.UNIDADE_FISICA = 'FACER3' THEN 'Campus Jaraguá'
                  WHEN T.UNIDADE_FISICA = 'FACER1' THEN 'Campus Rubiataba'
                  WHEN T.UNIDADE_FISICA = 'FESCAN' THEN 'Campus Senador Canedo'
              END AS UNIDADE_FISICA,
              C.NOME AS CURSO_NOME,
              T.TURMA,
              T.PERIODO,
              T.ID AS TURMA_ID,
              CONCAT(
                  T.DISCIPLINA COLLATE database_default, 
                  '|', 
                  T.TURMA COLLATE database_default, 
                  '|', 
                  REPLACE(T.PERIODO COLLATE database_default, '-', '|')
              ) AS ID_NUMBER,
              T.NOME_DISCIPLINA AS DISCIPLINA_NOME,
              T.MODELAGEM,
              T.SERIE,
              'SM_PRESENCIAL_20261' AS coursetemplate
          FROM ${dbPrefix}VW_AVA_CURSO C
              INNER JOIN ${dbPrefix}VW_AVA_TURMA T ON (T.CURSO = C.ID OR T.CURSO_RESP = C.ID )
          WHERE T.ID IS NOT NULL
              AND (T.NIVEL NOT IN ('EAD', 'POLO') OR T.NIVEL IS NULL)
              AND C.UNIDADE_ENS = @unidade
              AND C.TIPO = @cursoTipo
              AND T.PERIODO = @periodo
              AND (T.MODELAGEM NOT IN ('DISCIPLINA 100% ONLINE', 'Disciplina 100% online', 'Disciplina100') OR T.MODELAGEM IS NULL)
        `;

        const resTurmas = await req.query(sqlTurmas);
        const allTurmas = resTurmas.recordset;
        appendLog(`[TURMAS] Encontradas ${allTurmas.length} turmas no Lyceum.`);

        if (allTurmas.length > 0) {
          // Compare with local PostgreSQL synced_turma
          const syncedLocal = await this.db.select({ id: syncedTurmas.turmaId })
            .from(syncedTurmas)
            .where(eq(syncedTurmas.unidadeEns, unidade));
          const syncedLocalSet = new Set(syncedLocal.map(s => s.id));

          // Filter only untracked/new turmas
          const newTurmas = allTurmas.filter(t => !syncedLocalSet.has(t.TURMA_ID));
          appendLog(`[TURMAS] ${newTurmas.length} turmas novas a sincronizar.`);

          if (newTurmas.length > 0) {
            // Generate XML
            const xmlTurmas = this.generateXml('create', newTurmas, {
              shortname: 'TURMA_ID',
              idnumber: 'ID_NUMBER',
              externalkey: 'TURMA_ID',
              coursetemplate: 'coursetemplate',
            }, (row) => {
              // Resolve category and fullname dynamically from jobConfig formats
              let fullname = '';
              for (const part of jobConfig.sala || ['%DISCIPLINA_NOME', ' - ', '%TURMA_ID']) {
                if (part.startsWith('%')) {
                  fullname += row[part.substring(1)] || '';
                } else {
                  fullname += part;
                }
              }

              let category = '';
              for (const part of jobConfig.categoria || ['%UNIDADE_FISICA', '%CURSO_NOME', '%PERIODO', 'Disciplinas Presenciais']) {
                if (part.startsWith('%')) {
                  category += '/' + (row[part.substring(1)] || '');
                } else {
                  category += '/' + part;
                }
              }

              return { fullname, category };
            });

            // Send XML
            const success = await this.sendToMoodle(site, token, 'course.php', xmlTurmas, appendLog);
            if (success) {
              // Save to synced_turma
              for (const item of newTurmas) {
                await this.db.insert(syncedTurmas).values({
                  unidadeEns: unidade,
                  turmaId: item.TURMA_ID,
                }).onConflictDoNothing();
              }
              appendLog(`[TURMAS] Sucesso! Sincronizadas.`);
            }
          }
        }
      }

      // ==========================================
      // ETAPA 2: Sincronização de Alunos (Usuários & Matrículas)
      // ==========================================
      if (syncAlunosOption) {
        appendLog(`[ALUNOS] Buscando discentes do Lyceum...`);
        const req = pool.request();
        req.input('unidade', mssql.VarChar, unidade);
        req.input('cursoTipo', mssql.VarChar, cursoTipo);
        req.input('periodo', mssql.VarChar, periodo);

        const sqlAlunos = `
          SELECT DISTINCT TOP (10000)
              U.ID,
              ISNULL(U.NOME_SOCIAL, U.NOME) AS NOME,
              ISNULL(U.SOBRENOME_SOCIAL, U.SOBRENOME) AS SOBRENOME,
              U.EMAIL,
              LOWER(CONVERT(NVARCHAR(128), U2.SENHA, 2)) AS SENHA,
              U.ID AS USERNAME,
              LEFT(U.TELEFONE, 20) AS TELEFONE,
              U.CIDADE,
              U.PAIS,
              U.SERIE AS PERIODO,
              U.NOME_UNIDADE_FISICA AS UNIDADE_FISICA,
              C.UNIDADE_ENS AS INSTITUICAO,
              C.NOME AS COURSE
          FROM ${dbPrefix}VW_AVA_DISCENTE U
              INNER JOIN ${dbPrefix}VW_AVA_USUARIOS U2 ON U2.ID = U.ID
              INNER JOIN ${dbPrefix}VW_AVA_MATRICULA M ON M.USUARIO = U.ID
              INNER JOIN ${dbPrefix}VW_AVA_TURMA T ON T.ID = M.TURMA
              INNER JOIN ${dbPrefix}VW_AVA_CURSO C ON (T.CURSO = C.ID OR T.CURSO_RESP = C.ID)
          WHERE M.NIVEL = '2'
              AND (M.SITUACAO = 'Aberta' OR M.SITUACAO = 'Matriculado')
              AND C.UNIDADE_ENS = @unidade
              AND C.TIPO = @cursoTipo
              AND T.PERIODO = @periodo
              AND (T.MODELAGEM != 'DISCIPLINA 100% ONLINE' OR T.MODELAGEM IS NULL)
              AND C.ID NOT IN ('0051')
        `;

        const resAlunos = await req.query(sqlAlunos);
        const allAlunos = resAlunos.recordset;
        appendLog(`[ALUNOS] Encontrados ${allAlunos.length} discentes ativos no Lyceum.`);

        if (allAlunos.length > 0) {
          // Compare with local PostgreSQL synced_usuario
          const syncedLocal = await this.db.select({ username: syncedUsuarios.username })
            .from(syncedUsuarios)
            .where(eq(syncedUsuarios.unidadeEns, unidade));
          const syncedLocalSet = new Set(syncedLocal.map(s => s.username));

          const newAlunos = allAlunos.filter(u => !syncedLocalSet.has(String(u.USERNAME)));
          appendLog(`[ALUNOS] ${newAlunos.length} novos discentes para criar/atualizar no Moodle.`);

          if (newAlunos.length > 0) {
            const xmlAlunos = this.generateXml('create', newAlunos, {
              username: 'USERNAME',
              idnumber: 'ID',
              email: 'EMAIL',
              firstname: 'NOME',
              lastname: 'SOBRENOME',
              phone1: 'TELEFONE',
              institution: 'INSTITUICAO',
              city: 'CIDADE',
              period: 'PERIODO',
              unity: 'UNIDADE_FISICA',
              course: 'COURSE',
            }, (row) => {
              // Resolve MD5 password if missing
              let password = row.SENHA;
              if (!password) {
                password = require('crypto').createHash('md5').update(String(row.USERNAME)).digest('hex');
              }
              return { password };
            });

            const success = await this.sendToMoodle(site, token, 'user.php', xmlAlunos, appendLog);
            if (success) {
              for (const item of newAlunos) {
                await this.db.insert(syncedUsuarios).values({
                  unidadeEns: unidade,
                  username: String(item.USERNAME),
                }).onConflictDoNothing();
              }
              appendLog(`[ALUNOS] Contas de estudantes sincronizadas com sucesso.`);
            }
          }

          // Matrículas (Inscrições)
          appendLog(`[INSCRIÇÕES] Buscando inscrições de alunos no Lyceum...`);
          const reqMat = pool.request();
          reqMat.input('unidade', mssql.VarChar, unidade);
          reqMat.input('cursoTipo', mssql.VarChar, cursoTipo);
          reqMat.input('periodo', mssql.VarChar, periodo);

          const sqlMatriculas = `
            SELECT DISTINCT
                M.TURMA,
                M.USUARIO as USERNAME,
                M.NIVEL
            FROM ${dbPrefix}VW_AVA_USUARIOS U
                INNER JOIN ${dbPrefix}VW_AVA_MATRICULA M ON M.USUARIO = U.ID
                INNER JOIN ${dbPrefix}VW_AVA_TURMA T ON T.ID = M.TURMA
                INNER JOIN ${dbPrefix}VW_AVA_CURSO C ON (T.CURSO = C.ID OR T.CURSO_RESP = C.ID )
            WHERE M.NIVEL = '2'
                AND (M.SITUACAO = 'Aberta' OR M.SITUACAO = 'Matriculado')
                AND T.PERIODO = @periodo
                AND C.UNIDADE_ENS = @unidade
                AND C.TIPO = @cursoTipo
                AND (T.MODELAGEM != 'DISCIPLINA 100% ONLINE' OR T.MODELAGEM IS NULL)
                AND C.ID NOT IN ('0051')
          `;

          const resMats = await reqMat.query(sqlMatriculas);
          const allMats = resMats.recordset;
          appendLog(`[INSCRIÇÕES] Encontradas ${allMats.length} inscrições ativas no Lyceum.`);

          if (allMats.length > 0) {
            const syncedMatsLocal = await this.db.select({
              turma: syncedMatriculas.turma,
              username: syncedMatriculas.username,
            })
            .from(syncedMatriculas)
            .where(and(eq(syncedMatriculas.unidadeEns, unidade), eq(syncedMatriculas.nivel, 2)));

            const syncedMatsSet = new Set(syncedMatsLocal.map(m => `${m.turma}-${m.username}`));

            const newMats = allMats.filter(m => !syncedMatsSet.has(`${m.TURMA}-${m.USERNAME}`));
            appendLog(`[INSCRIÇÕES] ${newMats.length} novas inscrições a processar.`);

            if (newMats.length > 0) {
              const xmlMats = this.generateXml('create', newMats, {
                course: 'TURMA',
                username: 'USERNAME',
              }, () => {
                return {
                  status: '0', // 0 = active
                  role: 'student',
                  timestart: Math.floor(new Date('2026-02-01 23:00').getTime() / 1000).toString(),
                };
              });

              const success = await this.sendToMoodle(site, token, 'enroll.php', xmlMats, appendLog);
              if (success) {
                for (const item of newMats) {
                  await this.db.insert(syncedMatriculas).values({
                    unidadeEns: unidade,
                    turma: item.TURMA,
                    username: String(item.USERNAME),
                    nivel: 2,
                  }).onConflictDoNothing();
                }
                appendLog(`[INSCRIÇÕES] Inscrições de alunos concluídas com sucesso.`);
              }
            }
          }
        }
      }

      appendLog(`Sincronização do Job "${jobName}" concluída com SUCESSO!`);
      
      // Update job completed state in db
      await this.db.update(integrationJobs)
        .set({
          status: 'success',
          finishedAt: new Date(),
          logs: logsAccumulator,
        })
        .where(eq(integrationJobs.id, jobRecordId));

      return { success: true };
    } catch (err: any) {
      appendLog(`ERRO CRÍTICO no processamento: ${err.message}`);
      
      await this.db.update(integrationJobs)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          logs: logsAccumulator,
        })
        .where(eq(integrationJobs.id, jobRecordId));

      return { success: false, error: err.message };
    }
  }

  // 5. RUN DOWN JOB (CANCELATIONS) IN TYPESCRIPT
  async runDownJob(profileName: string, jobName: string, logCallback: (msg: string) => void) {
    const startTime = new Date();
    const jobId = await this.db.insert(integrationJobs).values({
      name: `${jobName} (DOWN)`,
      profile: profileName,
      unidade: 'Carregando...',
      periodo: 'Carregando...',
      status: 'running',
      logs: '',
    }).returning();

    const jobRecordId = jobId[0].id;
    let logsAccumulator = '';
    const appendLog = (msg: string) => {
      const formatted = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
      logsAccumulator += formatted;
      logCallback(msg);
    };

    try {
      appendLog(`Iniciando Limpeza/Cancelamento (Down) para "${jobName}"`);

      // A. Load config
      const yamlDir = this.getYamlDir();
      const filePath = path.join(yamlDir, profileName);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo de configuração ${profileName} não encontrado`);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const parsed: any = yaml.load(content);
      const jobConfig = parsed?.jobs?.[jobName];
      if (!jobConfig) {
        throw new Error(`Job "${jobName}" não configurado em ${profileName}`);
      }

      const unidade = jobConfig.unidade;
      const periodo = jobConfig.periodo;
      const cursoTipo = jobConfig['curso-tipo'];
      const modo = jobConfig.modo || 'sandbox';

      appendLog(`Unidade: ${unidade} | Período: ${periodo}`);

      await this.db.update(integrationJobs)
        .set({ unidade, periodo })
        .where(eq(integrationJobs.id, jobRecordId));

      // B. Fetch Moodle credentials
      const moodleConfig = await this.db.select()
        .from(avaOpenlms)
        .where(and(eq(avaOpenlms.unidadeEns, unidade), eq(avaOpenlms.status, true)))
        .limit(1);

      if (moodleConfig.length === 0) {
        throw new Error(`Credenciais Moodle não configuradas`);
      }

      const mConn = moodleConfig[0];
      const site = modo === 'sandbox' ? mConn.urlSandbox : mConn.urlProd;
      const token = modo === 'sandbox' ? mConn.tokenSandbox : mConn.tokenProd;

      // C. Connect SQL Server
      const pool = this.academicService.getSqlPool();
      const dbPrefix = this.academicService.getDbPrefix();

      appendLog(`Buscando matrículas inativas / canceladas no Lyceum...`);
      const req = pool.request();
      req.input('unidade', mssql.VarChar, unidade);
      req.input('cursoTipo', mssql.VarChar, cursoTipo);
      req.input('periodo', mssql.VarChar, periodo);

      // Lyceum query for dropped/canceled students
      const sqlCancel = `
        SELECT
            M.TURMA,
            M.USUARIO AS USERNAME,
            M.NIVEL,
            '1' AS STATUS
        FROM ${dbPrefix}VW_AVA_MATRICULA M
        INNER JOIN ${dbPrefix}VW_AVA_TURMA T ON T.ID = M.TURMA
        INNER JOIN ${dbPrefix}VW_AVA_CURSO C ON T.CURSO = C.ID
        WHERE M.NIVEL = '2' AND
            M.SITUACAO NOT IN ('Aberta', 'Matriculado') AND
            NOT EXISTS (
                SELECT 1
                FROM ${dbPrefix}VW_AVA_MATRICULA M2
                WHERE M2.TURMA = M.TURMA
                AND M2.USUARIO = M.USUARIO
                AND M2.NIVEL = M.NIVEL
                AND M2.SITUACAO IN ('Aberta', 'Matriculado')
            ) AND
            T.PERIODO = @periodo AND
            C.UNIDADE_ENS = @unidade AND
            (T.MODELAGEM NOT IN ('DISCIPLINA 100% ONLINE', 'Disciplina100', 'Disciplina100% online', 'Disciplina100%online') OR T.MODELAGEM IS NULL)
      `;

      const resCancel = await req.query(sqlCancel);
      const allCanceledLyceum = resCancel.recordset;
      appendLog(`[DOWN] Encontradas ${allCanceledLyceum.length} matrículas inativas no Lyceum.`);

      // Matrículas que estão no PostgreSQL local do Nexus, mas que não existem mais ativas
      const syncedMatsLocal = await this.db.select()
        .from(syncedMatriculas)
        .where(and(eq(syncedMatriculas.unidadeEns, unidade), eq(syncedMatriculas.nivel, 2)));

      // Compare local track with Lyceum active set to find absolute removals
      const lyceumActiveReq = pool.request();
      lyceumActiveReq.input('unidade', mssql.VarChar, unidade);
      lyceumActiveReq.input('cursoTipo', mssql.VarChar, cursoTipo);
      lyceumActiveReq.input('periodo', mssql.VarChar, periodo);

      const resActive = await lyceumActiveReq.query(`
        SELECT DISTINCT M.TURMA, M.USUARIO as USERNAME
        FROM ${dbPrefix}VW_AVA_MATRICULA M
        INNER JOIN ${dbPrefix}VW_AVA_TURMA T ON T.ID = M.TURMA
        INNER JOIN ${dbPrefix}VW_AVA_CURSO C ON (T.CURSO = C.ID OR T.CURSO_RESP = C.ID )
        WHERE M.NIVEL = '2' AND (M.SITUACAO = 'Aberta' OR M.SITUACAO = 'Matriculado')
          AND T.PERIODO = @periodo AND C.UNIDADE_ENS = @unidade AND C.TIPO = @cursoTipo
      `);
      
      const activeLyceumSet = new Set(resActive.recordset.map(r => `${r.TURMA}-${r.USERNAME}`));

      const orphanMats = syncedMatsLocal.filter(s => !activeLyceumSet.has(`${s.turma}-${s.username}`));
      appendLog(`[DOWN] Encontrados ${orphanMats.length} registros órfãos locais que precisam de remoção.`);

      // Merge cancelations
      const finalDeactivations: any[] = [];
      const deactKeys = new Set<string>();

      allCanceledLyceum.forEach(item => {
        const key = `${item.TURMA}-${item.USERNAME}`;
        if (!deactKeys.has(key)) {
          deactKeys.add(key);
          finalDeactivations.push({
            TURMA: item.TURMA,
            USERNAME: String(item.USERNAME),
          });
        }
      });

      orphanMats.forEach(item => {
        const key = `${item.turma}-${item.username}`;
        if (!deactKeys.has(key)) {
          deactKeys.add(key);
          finalDeactivations.push({
            TURMA: item.turma,
            USERNAME: String(item.username),
          });
        }
      });

      appendLog(`[DOWN] Total de ${finalDeactivations.length} desativações a transmitir para o Moodle.`);

      if (finalDeactivations.length > 0) {
        const xmlDown = this.generateXml('create', finalDeactivations, {
          course: 'TURMA',
          username: 'USERNAME',
        }, () => {
          return {
            status: '1', // 1 = suspended
            role: 'student',
          };
        });

        const success = await this.sendToMoodle(site, token, 'enroll.php', xmlDown, appendLog);
        if (success) {
          // Remove from local PostgreSQL
          let deletedCount = 0;
          for (const item of finalDeactivations) {
            const res = await this.db.delete(syncedMatriculas)
              .where(and(
                eq(syncedMatriculas.unidadeEns, unidade),
                eq(syncedMatriculas.turma, item.TURMA),
                eq(syncedMatriculas.username, item.USERNAME),
                eq(syncedMatriculas.nivel, 2)
              ));
            deletedCount++;
          }
          appendLog(`[DOWN] Sucesso! ${deletedCount} inscrições suspensas e removidas do Postgres local.`);
        }
      }

      appendLog(`Job Down de limpeza executado com SUCESSO!`);

      await this.db.update(integrationJobs)
        .set({
          status: 'success',
          finishedAt: new Date(),
          logs: logsAccumulator,
        })
        .where(eq(integrationJobs.id, jobRecordId));

      return { success: true };
    } catch (err: any) {
      appendLog(`ERRO no processamento do Down: ${err.message}`);
      
      await this.db.update(integrationJobs)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          logs: logsAccumulator,
        })
        .where(eq(integrationJobs.id, jobRecordId));

      return { success: false, error: err.message };
    }
  }
}
