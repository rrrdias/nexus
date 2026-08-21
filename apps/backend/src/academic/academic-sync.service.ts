import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AcademicService } from './academic.service';
import { sql as drizzleSql } from 'drizzle-orm';
import { 
  academicTurma, 
  academicDiscente, 
  academicDocente, 
  academicMatricula 
} from '../db/schema';

@Injectable()
export class AcademicSyncService {
  private readonly logger = new Logger(AcademicSyncService.name);
  private isSyncing = false;

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    private readonly academicService: AcademicService
  ) {}

  @Cron('0 3 * * *') // Executa todos os dias às 03:00 AM
  async handleDailySync() {
    this.logger.log('Starting scheduled daily Lyceum synchronization...');
    await this.syncActivePeriods();
  }

  // Permite chamada manual via controller se necessario
  async syncActivePeriods() {
    if (this.isSyncing) {
      this.logger.warn('A sync process is already running. Skipping new trigger.');
      return { status: 'already_running' };
    }
    
    this.isSyncing = true;
    const startTime = Date.now();

    try {
      const activePeriodsEnv = process.env.LYCEUM_ACTIVE_PERIODS || '2024-1,2024-2,2025-1,2025-2,2026-1';
      const activePeriods = activePeriodsEnv.split(',').map(p => p.trim()).filter(Boolean);
      
      if (activePeriods.length === 0) {
        this.logger.warn('No LYCEUM_ACTIVE_PERIODS configured. Skipping sync to prevent syncing all historical data.');
        return { status: 'aborted', reason: 'No active periods configured' };
      }

      this.logger.log(`Active periods to sync: ${activePeriods.join(', ')}`);

      const lyceumPool = this.academicService.getSqlPool();
      const prefix = this.academicService.getDbPrefix();
      
      // 1. Sync Turmas
      this.logger.log('Step 1: Syncing Turmas...');
      const periodsInStr = activePeriods.map(p => `'${p}'`).join(',');
      const turmasRes = await lyceumPool.request().query(`
        SELECT 
          T.ID, T.TURMA, T.DISCIPLINA, T.NOME_DISCIPLINA, 
          T.CURSO, T.PERIODO, T.SERIE, T.MODELAGEM,
          C.NOME AS CURSO_NOME, C.UNIDADE_ENS AS CURSO_INSTITUICAO
        FROM ${prefix}VW_AVA_TURMA T
        LEFT JOIN ${prefix}VW_AVA_CURSO C ON T.CURSO = C.ID
        WHERE T.PERIODO IN (${periodsInStr})
      `);
      
      const turmas = turmasRes.recordset;
      this.logger.log(`Found ${turmas.length} active turmas.`);
      
      if (turmas.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < turmas.length; i += chunkSize) {
          const chunk = turmas.slice(i, i + chunkSize);
          await this.db.insert(academicTurma)
            .values(chunk.map(t => ({
              id: t.ID.toString(),
              turma: t.TURMA,
              codTurma: t.TURMA, // Usando TURMA como fallback
              disciplina: t.DISCIPLINA,
              nomeDisciplina: t.NOME_DISCIPLINA,
              codDisciplina: t.DISCIPLINA, // Usando DISCIPLINA como fallback
              curso: t.CURSO,
              periodo: t.PERIODO,
              serie: t.SERIE,
              modelagem: t.MODELAGEM,
              cursoNome: t.CURSO_NOME,
              cursoInstituicao: t.CURSO_INSTITUICAO,
              updatedAt: new Date(),
            })))
            .onConflictDoUpdate({
              target: academicTurma.id,
              set: {
                turma: drizzleSql`EXCLUDED.turma`,
                codTurma: drizzleSql`EXCLUDED.cod_turma`,
                disciplina: drizzleSql`EXCLUDED.disciplina`,
                nomeDisciplina: drizzleSql`EXCLUDED.nome_disciplina`,
                codDisciplina: drizzleSql`EXCLUDED.cod_disciplina`,
                curso: drizzleSql`EXCLUDED.curso`,
                periodo: drizzleSql`EXCLUDED.periodo`,
                serie: drizzleSql`EXCLUDED.serie`,
                modelagem: drizzleSql`EXCLUDED.modelagem`,
                cursoNome: drizzleSql`EXCLUDED.curso_nome`,
                cursoInstituicao: drizzleSql`EXCLUDED.curso_instituicao`,
                updatedAt: drizzleSql`EXCLUDED."updatedAt"`,
              }
            });
        }
      }

      const activeTurmaIds = turmas.map(t => t.ID.toString());
      if (activeTurmaIds.length === 0) {
        this.logger.warn('No active turmas found. Stopping sync.');
        return { status: 'success', synced: 0 };
      }

      // 2. Sync Matriculas
      this.logger.log('Step 2: Syncing Matriculas for active Turmas...');
      // Mssql IN limits to 2100 params usually, so we batch if needed. But let's build dynamic IN or use a subquery if both views are in Lyceum.
      // Better: Query MATRICULA joining TURMA on period
      const matriculasRes = await lyceumPool.request().query(`
        SELECT M.USUARIO, M.TURMA, M.NIVEL, M.ATIVO, M.SITUACAO
        FROM ${prefix}VW_AVA_MATRICULA M
        INNER JOIN ${prefix}VW_AVA_TURMA T ON M.TURMA = T.ID
        WHERE T.PERIODO IN (${periodsInStr})
      `);
      
      const matriculas = matriculasRes.recordset;
      this.logger.log(`Found ${matriculas.length} active matriculas.`);

      // Limpar matrículas antigas antes de inserir as novas em uma transação atômica
      await this.db.transaction(async (tx) => {
        await tx.delete(academicMatricula);

        if (matriculas.length > 0) {
          // Chunk inserts for matriculas
          const chunkSize = 2000;
          for (let i = 0; i < matriculas.length; i += chunkSize) {
            const chunk = matriculas.slice(i, i + chunkSize);
            await tx.insert(academicMatricula)
              .values(chunk.map(m => ({
                usuarioId: m.USUARIO.toString(),
                turmaId: m.TURMA.toString(),
                nivel: m.NIVEL?.toString(),
                ativo: m.ATIVO?.toString() || null,
                situacao: m.SITUACAO?.toString() || null,
              })))
              .onConflictDoNothing();
          }
        }
      });

      // Collect active users
      const activeUserIds = new Set<string>();
      matriculas.forEach(m => activeUserIds.add(m.USUARIO.toString()));
      this.logger.log(`Identified ${activeUserIds.size} unique active users.`);

      if (activeUserIds.size > 0) {
        const usersArray = Array.from(activeUserIds);
        const userChunks: string[][] = [];
        for (let i = 0; i < usersArray.length; i += 1000) {
          userChunks.push(usersArray.slice(i, i + 1000));
        }

        let syncedDiscentes = 0;
        let syncedDocentes = 0;

        for (let i = 0; i < userChunks.length; i++) {
          const chunk = userChunks[i];
          const inParams = chunk.map(id => `'${id}'`).join(',');

          // Sync Discentes
          const discRes = await lyceumPool.request().query(`
            SELECT 
              U.ID, U.NOME, U.EMAIL, U.CPF, U.SERIE, U.TURNO, U.TELEFONE, U.CIDADE, U.PAIS,
              U.CURSO, U.UNIDADE_FISICA, U.NOME_SOCIAL, U.NOME_UNIDADE_FISICA,
              US.SOBRENOME, US.SOBRENOME_SOCIAL, C.NOME AS CURSO_NOME, C.UNIDADE_ENS AS CURSO_INSTITUICAO
            FROM ${prefix}VW_AVA_DISCENTE U
            LEFT JOIN ${prefix}VW_AVA_USUARIOS US ON U.ID = US.ID
            LEFT JOIN ${prefix}VW_AVA_CURSO C ON U.CURSO = C.ID
            WHERE U.ID IN (${inParams})
          `);

          if (discRes.recordset.length > 0) {
            syncedDiscentes += discRes.recordset.length;
            await this.db.insert(academicDiscente)
              .values(discRes.recordset.map(u => ({
                id: u.ID.toString(),
                nome: u.NOME,
                email: u.EMAIL,
                cpf: u.CPF,
                serie: u.SERIE,
                turno: u.TURNO,
                telefone: u.TELEFONE,
                cidade: u.CIDADE,
                pais: u.PAIS,
                curso: u.CURSO,
                unidadeFisica: u.UNIDADE_FISICA,
                nomeSocial: u.NOME_SOCIAL,
                nomeUnidadeFisica: u.NOME_UNIDADE_FISICA,
                sobrenome: u.SOBRENOME,
                sobrenomeSocial: u.SOBRENOME_SOCIAL,
                cursoNome: u.CURSO_NOME,
                cursoInstituicao: u.CURSO_INSTITUICAO,
                matricula: null,
                usuario: null,
                updatedAt: new Date(),
              })))
              .onConflictDoUpdate({
                target: academicDiscente.id,
                set: {
                  nome: drizzleSql`EXCLUDED.nome`,
                  email: drizzleSql`EXCLUDED.email`,
                  cpf: drizzleSql`EXCLUDED.cpf`,
                  serie: drizzleSql`EXCLUDED.serie`,
                  turno: drizzleSql`EXCLUDED.turno`,
                  telefone: drizzleSql`EXCLUDED.telefone`,
                  cidade: drizzleSql`EXCLUDED.cidade`,
                  pais: drizzleSql`EXCLUDED.pais`,
                  curso: drizzleSql`EXCLUDED.curso`,
                  unidadeFisica: drizzleSql`EXCLUDED.unidade_fisica`,
                  nomeSocial: drizzleSql`EXCLUDED.nome_social`,
                  nomeUnidadeFisica: drizzleSql`EXCLUDED.nome_unidade_fisica`,
                  sobrenome: drizzleSql`EXCLUDED.sobrenome`,
                  sobrenomeSocial: drizzleSql`EXCLUDED.sobrenome_social`,
                  cursoNome: drizzleSql`EXCLUDED.curso_nome`,
                  cursoInstituicao: drizzleSql`EXCLUDED.curso_instituicao`,
                  matricula: drizzleSql`EXCLUDED.matricula`,
                  usuario: drizzleSql`EXCLUDED.usuario`,
                  updatedAt: drizzleSql`EXCLUDED."updatedAt"`,
                }
              });
          }

          // Sync Docentes
          const docRes = await lyceumPool.request().query(`
            SELECT 
              U.ID, U.NOME, U.EMAIL, U.CPF, U.TELEFONE, U.CIDADE, U.PAIS,
              US.SOBRENOME, US.NOME_SOCIAL, US.SOBRENOME_SOCIAL
            FROM ${prefix}VW_AVA_DOCENTE U
            LEFT JOIN ${prefix}VW_AVA_USUARIOS US ON U.ID = US.ID
            WHERE U.ID IN (${inParams})
          `);

          if (docRes.recordset.length > 0) {
            syncedDocentes += docRes.recordset.length;
            await this.db.insert(academicDocente)
              .values(docRes.recordset.map(u => ({
                id: u.ID.toString(),
                nome: u.NOME,
                email: u.EMAIL,
                cpf: u.CPF,
                telefone: u.TELEFONE,
                cidade: u.CIDADE,
                pais: u.PAIS,
                sobrenome: u.SOBRENOME,
                nomeSocial: u.NOME_SOCIAL,
                sobrenomeSocial: u.SOBRENOME_SOCIAL,
                updatedAt: new Date(),
              })))
              .onConflictDoUpdate({
                target: academicDocente.id,
                set: {
                  nome: drizzleSql`EXCLUDED.nome`,
                  email: drizzleSql`EXCLUDED.email`,
                  cpf: drizzleSql`EXCLUDED.cpf`,
                  telefone: drizzleSql`EXCLUDED.telefone`,
                  cidade: drizzleSql`EXCLUDED.cidade`,
                  pais: drizzleSql`EXCLUDED.pais`,
                  sobrenome: drizzleSql`EXCLUDED.sobrenome`,
                  nomeSocial: drizzleSql`EXCLUDED.nome_social`,
                  sobrenomeSocial: drizzleSql`EXCLUDED.sobrenome_social`,
                  updatedAt: drizzleSql`EXCLUDED."updatedAt"`,
                }
              });
          }
          
          this.logger.log(`Processed user chunk ${i + 1}/${userChunks.length}`);
        }

        this.logger.log(`Sync complete: ${syncedDiscentes} discentes and ${syncedDocentes} docentes synced.`);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`Synchronization finished in ${duration} seconds.`);
      
      return { 
        status: 'success', 
        turmas: turmas.length, 
        matriculas: matriculas.length,
        usersSync: activeUserIds.size,
        durationSeconds: duration
      };
      
    } catch (error: any) {
      this.logger.error('Error during Lyceum synchronization', error);
      return { status: 'error', error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }
}
