import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import * as sql from 'mssql';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { 
  systemModules, 
  groups, 
  groupSystemAccess, 
  users, 
  usersSystemAccess,
  userGroups 
} from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AcademicService implements OnModuleInit, OnModuleDestroy {
  private pool: sql.ConnectionPool | null = null;
  private dbPrefix: string = '';
  
  // Track schema columns for dynamic search building
  private discenteColumns: string[] = [];
  private docenteColumns: string[] = [];
  private turmaColumns: string[] = [];
  
  // Track available views in Lyceum containing "AVA"
  private avaViews: string[] = [];

  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
  ) {}

  async onModuleInit() {
    // Load Prefix for Linked Server if configured
    this.dbPrefix = process.env.LYCEUM_DB_PREFIX || '';
    if (this.dbPrefix) {
      console.log(`[Lyceum DB] Using database prefix (Linked Server): "${this.dbPrefix}"`);
    }

    // 1. Connect to Lyceum SQL Server
    const config: sql.config = {
      user: process.env.LYCEUM_DB_USERNAME || 'PortAeeConsult',
      password: process.env.LYCEUM_DB_PASSWORD || 'Port4eeC0nsult@Tudo.',
      server: process.env.LYCEUM_DB_HOST || '172.29.44.90',
      port: parseInt(process.env.LYCEUM_DB_PORT || '1433'),
      database: process.env.LYCEUM_DB_DATABASE || 'Lyceum',
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    try {
      this.pool = await new sql.ConnectionPool(config).connect();
      console.log('[Lyceum DB] Connected to SQL Server successfully!');

      // Load available views and columns dynamically
      this.avaViews = await this.getAvaViews();
      console.log('[Lyceum DB] Available AVA views in Lyceum:', this.avaViews);

      this.discenteColumns = await this.getViewColumns('VW_AVA_DISCENTE');
      if (this.discenteColumns.length === 0) {
        this.discenteColumns = ['ID', 'NOME', 'SOBRENOME', 'NOME_SOCIAL', 'SOBRENOME_SOCIAL', 'MATRICULA', 'CPF', 'USUARIO', 'EMAIL', 'TELEFONE', 'CURSO', 'UNIDADE_FISICA', 'SERIE'];
      }

      this.docenteColumns = await this.getViewColumns('VW_AVA_DOCENTE');
      if (this.docenteColumns.length === 0) {
        this.docenteColumns = ['ID', 'NOME', 'SOBRENOME', 'CPF', 'EMAIL', 'TELEFONE'];
      }

      this.turmaColumns = await this.getViewColumns('VW_AVA_TURMA');
      if (this.turmaColumns.length === 0) {
        this.turmaColumns = ['ID', 'TURMA', 'COD_TURMA', 'DISCIPLINA', 'NOME_DISCIPLINA', 'COD_DISCIPLINA', 'CURSO', 'PERIODO', 'SERIE', 'MODELAGEM'];
      }

      console.log('[Lyceum DB] VW_AVA_DISCENTE columns:', this.discenteColumns);
      console.log('[Lyceum DB] VW_AVA_DOCENTE columns:', this.docenteColumns);
      console.log('[Lyceum DB] VW_AVA_TURMA columns:', this.turmaColumns);
    } catch (err) {
      console.error('[Lyceum DB] Connection or metadata initialization failed:', err);
    }

    // 2. Auto-Seeder: Check and register 'Módulo Acadêmico' in Postgres
    try {
      await this.autoSeedModule();
    } catch (err) {
      console.error('[Postgres Seeder] Auto-seeding Academic Module failed:', err);
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close();
      console.log('[Lyceum DB] SQL Server pool closed.');
    }
  }

  // --- Dynamic Metadata Inspectors ---
  private async getAvaViews(): Promise<string[]> {
    if (!this.pool) return [];
    try {
      const schemaPrefix = this.dbPrefix ? this.dbPrefix.replace('dbo.', '') : '';
      const res = await this.pool.request().query(
        `SELECT TABLE_NAME FROM ${schemaPrefix}INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME LIKE '%AVA%'`
      );
      return res.recordset.map(row => row.TABLE_NAME);
    } catch (err) {
      console.error('[Lyceum DB] Failed to list AVA views:', err);
      return [];
    }
  }

  private async getViewColumns(viewName: string): Promise<string[]> {
    if (!this.pool) return [];
    try {
      const schemaPrefix = this.dbPrefix ? this.dbPrefix.replace('dbo.', '') : '';
      const res = await this.pool.request().query(
        `SELECT COLUMN_NAME FROM ${schemaPrefix}INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${viewName}'`
      );
      return res.recordset.map(row => row.COLUMN_NAME);
    } catch (err) {
      console.error(`[Lyceum DB] Failed to get columns for ${viewName}:`, err);
      return [];
    }
  }

  // --- Auto Seeding in PostgreSQL ---
  private async autoSeedModule() {
    // Check if the 'academic' slug already exists
    const [existing] = await this.db.select()
      .from(systemModules)
      .where(eq(systemModules.slug, 'academic'))
      .limit(1);

    if (existing) {
      console.log('[Postgres Seeder] Academic Module is already seeded.');
      return;
    }

    console.log('[Postgres Seeder] Seeding Academic Module...');
    const [newModule] = await this.db.insert(systemModules)
      .values({
        name: 'Módulo Acadêmico',
        slug: 'academic',
        description: 'Consulta de Alunos, Docentes, Matrículas e Turmas no Lyceum',
        colorCode: '#5E35B1',
        iconClass: 'ti-school',
        pathUrl: '/academic',
      })
      .returning();

    // Find the 'Super Admin' group to grant permissions
    const [superAdminGroup] = await this.db.select()
      .from(groups)
      .where(eq(groups.name, 'Super Admin'))
      .limit(1);

    if (superAdminGroup) {
      // 1. Grant group access
      await this.db.insert(groupSystemAccess).values({
        groupId: superAdminGroup.id,
        systemModuleId: newModule.id,
      });

      // 2. Grant direct access to all users belonging to Super Admin group
      const adminUsers = await this.db.select({ userId: userGroups.userId })
        .from(userGroups)
        .where(eq(userGroups.groupId, superAdminGroup.id));

      if (adminUsers.length > 0) {
        await this.db.insert(usersSystemAccess).values(
          adminUsers.map(admin => ({
            userId: admin.userId,
            systemModuleId: newModule.id,
          }))
        );
      }
      console.log('[Postgres Seeder] Academic Module accesses granted successfully.');
    }
  }

  // --- Academic Consultations (Lyceum Views) ---

  async getStudents(search?: string, page = 1, size = 15) {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    const offset = (page - 1) * size;
    let whereClause = '';
    const request = this.pool.request();

    if (search) {
      const trimmedSearch = search.trim();
      const isCodeSearch = /\d/.test(trimmedSearch);

      if (isCodeSearch) {
        // Code/Numeric search: query discente code columns directly using fast prefix match
        const codeFields = this.discenteColumns.filter(col => 
          ['MATRICULA', 'CPF', 'USUARIO', 'ID', 'ALUNO', 'DISCENTE'].includes(col.toUpperCase())
        );
        let conditions: string[] = [];
        let paramIdx = 0;
        codeFields.forEach(field => {
          const paramName = `search${paramIdx++}`;
          request.input(paramName, sql.VarChar, `${trimmedSearch}%`);
          conditions.push(`U.${field} LIKE @${paramName}`);
        });
        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' OR ');
        }
      } else {
        // Name Search: Step 1. Get matching users first from VW_AVA_USUARIOS to bypass buggy VW_AVA_DISCENTE.SOBRENOME view formula
        const userReq = this.pool.request();
        const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);
        let userWhereClause = '';

        if (words.length > 1) {
          // Multi-word name search
          const conditions: string[] = [];
          const textFields = ['NOME', 'SOBRENOME', 'NOME_SOCIAL', 'SOBRENOME_SOCIAL'];
          words.forEach((word, wordIdx) => {
            const wordCond: string[] = [];
            textFields.forEach((field, fieldIdx) => {
              const paramName = `w_${wordIdx}_${fieldIdx}`;
              userReq.input(paramName, sql.VarChar, `%${word}%`);
              wordCond.push(`${field} LIKE @${paramName}`);
            });
            conditions.push(`(${wordCond.join(' OR ')})`);
          });
          userWhereClause = 'WHERE ' + conditions.join(' AND ');
        } else {
          // Single-word name search
          userReq.input('search0', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search1', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search2', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search3', sql.VarChar, `%${trimmedSearch}%`);
          userWhereClause = `WHERE NOME LIKE @search0 
              OR SOBRENOME LIKE @search1 
              OR NOME_SOCIAL LIKE @search2 
              OR SOBRENOME_SOCIAL LIKE @search3`;
        }

        const usersRes = await userReq.query(
          `SELECT TOP 200 ID 
           FROM ${this.dbPrefix}VW_AVA_USUARIOS 
           ${userWhereClause}`
        );

        const userIds = usersRes.recordset.map(row => row.ID);
        if (userIds.length === 0) {
          return { data: [], total: 0, page, size, totalPages: 0 };
        }

        const inParams: string[] = [];
        userIds.forEach((id, idx) => {
          const paramName = `uid${idx}`;
          request.input(paramName, sql.VarChar, id);
          inParams.push(`@${paramName}`);
        });
        whereClause = `WHERE U.ID IN (${inParams.join(', ')})`;
      }
    }

    const orderColumn = this.discenteColumns.find(col => 
      ['NOME', 'ALUNO', 'MATRICULA'].includes(col.toUpperCase())
    ) || this.discenteColumns[0] || '1';

    const countRes = await request.query(
      `SELECT COUNT(*) as total 
       FROM ${this.dbPrefix}VW_AVA_DISCENTE U 
       LEFT JOIN ${this.dbPrefix}VW_AVA_CURSO C ON U.CURSO = C.ID 
       ${whereClause}`
    );
    const total = countRes.recordset[0]?.total || 0;

    const dataRes = await request.query(
      `SELECT 
         U.ID,
         U.NOME,
         U.EMAIL,
         U.CPF,
         U.SERIE,
         U.TURNO,
         U.TELEFONE,
         U.CIDADE,
         U.PAIS,
         U.CURSO,
         U.UNIDADE_FISICA,
         U.NOME_SOCIAL,
         U.NOME_UNIDADE_FISICA,
         U.SENHA,
         U.DATA_CRIACAO,
         U.DATA_ATUALIZACAO,
         U.DATA_EXCLUSAO,
         US.SOBRENOME,
         US.SOBRENOME_SOCIAL,
         C.NOME AS CURSO_NOME, 
         C.UNIDADE_ENS AS CURSO_INSTITUICAO 
       FROM ${this.dbPrefix}VW_AVA_DISCENTE U 
       LEFT JOIN ${this.dbPrefix}VW_AVA_USUARIOS US ON U.ID = US.ID
       LEFT JOIN ${this.dbPrefix}VW_AVA_CURSO C ON U.CURSO = C.ID 
       ${whereClause} 
       ORDER BY U.${orderColumn} 
       OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY`
    );

    return {
      data: dataRes.recordset,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    };
  }

  async getTeachers(search?: string, page = 1, size = 15) {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    const offset = (page - 1) * size;
    let whereClause = '';
    const request = this.pool.request();

    if (search) {
      const trimmedSearch = search.trim();
      const isCodeSearch = /\d/.test(trimmedSearch);

      if (isCodeSearch) {
        const codeFields = this.docenteColumns.filter(col => 
          ['CPF', 'USUARIO', 'PROFESSOR', 'COD_DOCENTE', 'ID'].includes(col.toUpperCase())
        );
        let conditions: string[] = [];
        let paramIdx = 0;
        codeFields.forEach(field => {
          const paramName = `search${paramIdx++}`;
          request.input(paramName, sql.VarChar, `${trimmedSearch}%`);
          conditions.push(`U.${field} LIKE @${paramName}`);
        });
        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' OR ');
        }
      } else {
        // Name Search: Step 1. Get matching users first from VW_AVA_USUARIOS to ensure clean, high-performance execution
        const userReq = this.pool.request();
        const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);
        let userWhereClause = '';

        if (words.length > 1) {
          // Multi-word name search
          const conditions: string[] = [];
          const textFields = ['NOME', 'SOBRENOME', 'NOME_SOCIAL', 'SOBRENOME_SOCIAL'];
          words.forEach((word, wordIdx) => {
            const wordCond: string[] = [];
            textFields.forEach((field, fieldIdx) => {
              const paramName = `w_${wordIdx}_${fieldIdx}`;
              userReq.input(paramName, sql.VarChar, `%${word}%`);
              wordCond.push(`${field} LIKE @${paramName}`);
            });
            conditions.push(`(${wordCond.join(' OR ')})`);
          });
          userWhereClause = 'WHERE ' + conditions.join(' AND ');
        } else {
          // Single-word name search
          userReq.input('search0', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search1', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search2', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search3', sql.VarChar, `%${trimmedSearch}%`);
          userWhereClause = `WHERE NOME LIKE @search0 
              OR SOBRENOME LIKE @search1 
              OR NOME_SOCIAL LIKE @search2 
              OR SOBRENOME_SOCIAL LIKE @search3`;
        }

        const usersRes = await userReq.query(
          `SELECT TOP 200 ID 
           FROM ${this.dbPrefix}VW_AVA_USUARIOS 
           ${userWhereClause}`
        );

        const userIds = usersRes.recordset.map(row => row.ID);
        if (userIds.length === 0) {
          return { data: [], total: 0, page, size, totalPages: 0 };
        }

        const inParams: string[] = [];
        userIds.forEach((id, idx) => {
          const paramName = `uid${idx}`;
          request.input(paramName, sql.VarChar, id);
          inParams.push(`@${paramName}`);
        });
        whereClause = `WHERE U.ID IN (${inParams.join(', ')})`;
      }
    }

    const orderColumn = this.docenteColumns.find(col => 
      ['NOME', 'PROFESSOR', 'DOCENTE'].includes(col.toUpperCase())
    ) || this.docenteColumns[0] || '1';

    const countRes = await request.query(
      `SELECT COUNT(*) as total FROM ${this.dbPrefix}VW_AVA_DOCENTE U ${whereClause}`
    );
    const total = countRes.recordset[0]?.total || 0;

    const dataRes = await request.query(
      `SELECT 
         U.ID,
         U.NOME,
         U.EMAIL,
         U.CPF,
         U.TELEFONE,
         U.CIDADE,
         U.PAIS,
         U.SENHA,
         U.DATA_CRIACAO,
         U.DATA_ATUALIZACAO,
         U.DATA_EXCLUSAO,
         US.SOBRENOME,
         US.NOME_SOCIAL,
         US.SOBRENOME_SOCIAL
       FROM ${this.dbPrefix}VW_AVA_DOCENTE U 
       LEFT JOIN ${this.dbPrefix}VW_AVA_USUARIOS US ON U.ID = US.ID
       ${whereClause} 
       ORDER BY U.${orderColumn} 
       OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY`
    );

    return {
      data: dataRes.recordset,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    };
  }

  async getClasses(search?: string, page = 1, size = 15) {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    const offset = (page - 1) * size;
    let whereClause = '';
    const request = this.pool.request();

    if (search) {
      const trimmedSearch = search.trim();
      const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);

      if (words.length > 1) {
        const textFields = this.turmaColumns.filter(col => 
          ['DISCIPLINA', 'NOME_DISCIPLINA', 'COD_DISCIPLINA', 'CURSO'].includes(col.toUpperCase())
        );
        const conditions: string[] = [];
        words.forEach((word, wordIdx) => {
          const wordConditions: string[] = [];
          textFields.forEach((field, fieldIdx) => {
            const paramName = `w_${wordIdx}_${fieldIdx}`;
            request.input(paramName, sql.VarChar, `%${word}%`);
            wordConditions.push(`T.${field} LIKE @${paramName}`);
          });
          conditions.push(`(${wordConditions.join(' OR ')})`);
        });
        whereClause = 'WHERE ' + conditions.join(' AND ');
      } else {
        const codeFields = this.turmaColumns.filter(col => 
          ['TURMA', 'COD_TURMA', 'ID'].includes(col.toUpperCase())
        );
        const textFields = this.turmaColumns.filter(col => 
          ['DISCIPLINA', 'NOME_DISCIPLINA', 'COD_DISCIPLINA', 'CURSO'].includes(col.toUpperCase())
        );

        let conditions: string[] = [];
        let paramIdx = 0;

        codeFields.forEach(field => {
          const paramName = `search${paramIdx++}`;
          request.input(paramName, sql.VarChar, `${trimmedSearch}%`);
          conditions.push(`T.${field} LIKE @${paramName}`);
        });

        textFields.forEach(field => {
          const paramName = `search${paramIdx++}`;
          request.input(paramName, sql.VarChar, `%${trimmedSearch}%`);
          conditions.push(`T.${field} LIKE @${paramName}`);
        });

        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' OR ');
        }
      }
    }

    const orderColumn = this.turmaColumns.find(col => 
      ['TURMA', 'COD_TURMA', 'DISCIPLINA'].includes(col.toUpperCase())
    ) || this.turmaColumns[0] || '1';

    const countRes = await request.query(
      `SELECT COUNT(*) as total 
       FROM ${this.dbPrefix}VW_AVA_TURMA T 
       LEFT JOIN ${this.dbPrefix}VW_AVA_CURSO C ON T.CURSO = C.ID 
       ${whereClause}`
    );
    const total = countRes.recordset[0]?.total || 0;

    const dataRes = await request.query(
      `SELECT 
         T.*, 
         C.NOME AS CURSO_NOME, 
         C.UNIDADE_ENS AS CURSO_INSTITUICAO 
       FROM ${this.dbPrefix}VW_AVA_TURMA T 
       LEFT JOIN ${this.dbPrefix}VW_AVA_CURSO C ON T.CURSO = C.ID 
       ${whereClause} 
       ORDER BY T.${orderColumn} 
       OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY`
    );

    return {
      data: dataRes.recordset,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    };
  }

  async getMatriculas(search?: string, page = 1, size = 15) {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    const offset = (page - 1) * size;
    let whereClause = '';
    const request = this.pool.request();

    if (search) {
      const trimmedSearch = search.trim();
      const isCodeSearch = /\d/.test(trimmedSearch);

      if (isCodeSearch) {
        // Search strictly on VW_AVA_MATRICULA's indexed code columns (Usuario/Matrícula, Turma, CPF)
        let conditions = [
          'M.USUARIO LIKE @search0',
          'M.TURMA LIKE @search1',
          'M.USUARIO_CPF LIKE @search2'
        ];
        request.input('search0', sql.VarChar, `${trimmedSearch}%`);
        request.input('search1', sql.VarChar, `${trimmedSearch}%`);
        request.input('search2', sql.VarChar, `${trimmedSearch}%`);
        whereClause = 'WHERE ' + conditions.join(' OR ');
      } else {
        // Name Search: Step 1. Get matching users first to avoid massive scanning joins
        const userReq = this.pool.request();
        const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);
        let userWhereClause = '';

        if (words.length > 1) {
          // Multi-word name search
          const conditions: string[] = [];
          const textFields = ['NOME', 'SOBRENOME', 'NOME_SOCIAL', 'SOBRENOME_SOCIAL'];
          
          words.forEach((word, wordIdx) => {
            const wordConditions: string[] = [];
            textFields.forEach((field, fieldIdx) => {
              const paramName = `w_${wordIdx}_${fieldIdx}`;
              userReq.input(paramName, sql.VarChar, `%${word}%`);
              wordConditions.push(`${field} LIKE @${paramName}`);
            });
            conditions.push(`(${wordConditions.join(' OR ')})`);
          });
          userWhereClause = 'WHERE ' + conditions.join(' AND ');
        } else {
          // Single-word name search
          userReq.input('search0', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search1', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search2', sql.VarChar, `%${trimmedSearch}%`);
          userReq.input('search3', sql.VarChar, `%${trimmedSearch}%`);

          userWhereClause = `WHERE NOME LIKE @search0 
              OR SOBRENOME LIKE @search1 
              OR NOME_SOCIAL LIKE @search2 
              OR SOBRENOME_SOCIAL LIKE @search3`;
        }

        const usersRes = await userReq.query(
          `SELECT TOP 200 ID 
           FROM ${this.dbPrefix}VW_AVA_USUARIOS 
           ${userWhereClause}`
        );

        const userIds = usersRes.recordset.map(row => row.ID);
        if (userIds.length === 0) {
          return { data: [], total: 0, page, size, totalPages: 0 };
        }

        // Build IN clause for the main matriculas query
        const inParams: string[] = [];
        userIds.forEach((id, idx) => {
          const paramName = `uid${idx}`;
          request.input(paramName, sql.VarChar, id);
          inParams.push(`@${paramName}`);
        });
        whereClause = `WHERE M.USUARIO IN (${inParams.join(', ')})`;
      }
    }

    // Executing lightweight count query
    const countRes = await request.query(
      `SELECT COUNT(*) as total 
       FROM ${this.dbPrefix}VW_AVA_MATRICULA M
       ${whereClause}`
    );
    const total = countRes.recordset[0]?.total || 0;

    // Optimization: If total matches is 0, skip the paginated query entirely
    if (total === 0) {
      return {
        data: [],
        total: 0,
        page,
        size,
        totalPages: 0
      };
    }

    // Paginated query with highly optimized CTE (joins VW_AVA_USUARIOS and VW_AVA_TURMA only on final 15 rows)
    const dataRes = await request.query(
      `WITH PaginatedMatriculas AS (
         SELECT M.*
         FROM ${this.dbPrefix}VW_AVA_MATRICULA M
         ${whereClause}
         ORDER BY M.USUARIO 
         OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY
       )
       SELECT PM.*, 
              COALESCE(U.NOME_SOCIAL, U.NOME) AS NOME, 
              COALESCE(U.SOBRENOME_SOCIAL, U.SOBRENOME) AS SOBRENOME,
              T.NOME_DISCIPLINA 
       FROM PaginatedMatriculas PM
       LEFT JOIN ${this.dbPrefix}VW_AVA_USUARIOS U ON PM.USUARIO = U.ID
       LEFT JOIN ${this.dbPrefix}VW_AVA_TURMA T ON PM.TURMA = T.ID`
    );

    return {
      data: dataRes.recordset,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    };
  }

  // --- Linked Disciplines Consultations (Student & Teacher) ---

  async getStudentDisciplines(matricula: string) {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    const request = this.pool.request();
    request.input('matricula', sql.VarChar, matricula);

    const res = await request.query(
      `SELECT M.TURMA, T.DISCIPLINA, T.NOME_DISCIPLINA, T.PERIODO, T.TURMA AS COD_TURMA
       FROM ${this.dbPrefix}VW_AVA_MATRICULA M
       LEFT JOIN ${this.dbPrefix}VW_AVA_TURMA T ON M.TURMA = T.ID
       WHERE M.USUARIO = @matricula AND M.NIVEL = '2'`
    );
    return res.recordset;
  }

  async getTeacherDisciplines(docenteId: string) {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    const request = this.pool.request();
    request.input('docenteId', sql.VarChar, docenteId);

    const res = await request.query(
      `SELECT M.TURMA, T.DISCIPLINA, T.NOME_DISCIPLINA, T.PERIODO, T.TURMA AS COD_TURMA
       FROM ${this.dbPrefix}VW_AVA_MATRICULA M
       LEFT JOIN ${this.dbPrefix}VW_AVA_TURMA T ON M.TURMA = T.ID
       WHERE M.USUARIO = @docenteId AND M.NIVEL = '1'`
    );
    return res.recordset;
  }
}
