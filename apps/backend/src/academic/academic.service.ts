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
      this.docenteColumns = await this.getViewColumns('VW_AVA_DOCENTE');
      this.turmaColumns = await this.getViewColumns('VW_AVA_TURMA');

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
      const res = await this.pool.request().query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME LIKE '%AVA%'`
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
      const res = await this.pool.request().query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${viewName}'`
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
      const searchFields = this.discenteColumns.filter(col => 
        ['NOME', 'MATRICULA', 'CPF', 'EMAIL', 'USUARIO', 'ALUNO', 'DISCENTE'].includes(col.toUpperCase())
      );
      if (searchFields.length > 0) {
        whereClause = 'WHERE ' + searchFields.map((field, idx) => {
          request.input(`search${idx}`, sql.VarChar, `%${search}%`);
          return `${field} LIKE @search${idx}`;
        }).join(' OR ');
      }
    }

    const orderColumn = this.discenteColumns.find(col => 
      ['NOME', 'ALUNO', 'MATRICULA'].includes(col.toUpperCase())
    ) || this.discenteColumns[0] || '1';

    const countRes = await request.query(
      `SELECT COUNT(*) as total FROM VW_AVA_DISCENTE ${whereClause}`
    );
    const total = countRes.recordset[0]?.total || 0;

    const dataRes = await request.query(
      `SELECT * FROM VW_AVA_DISCENTE ${whereClause} 
       ORDER BY ${orderColumn} 
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
      const searchFields = this.docenteColumns.filter(col => 
        ['NOME', 'DOCENTE', 'CPF', 'EMAIL', 'USUARIO', 'PROFESSOR', 'COD_DOCENTE'].includes(col.toUpperCase())
      );
      if (searchFields.length > 0) {
        whereClause = 'WHERE ' + searchFields.map((field, idx) => {
          request.input(`search${idx}`, sql.VarChar, `%${search}%`);
          return `${field} LIKE @search${idx}`;
        }).join(' OR ');
      }
    }

    const orderColumn = this.docenteColumns.find(col => 
      ['NOME', 'PROFESSOR', 'DOCENTE'].includes(col.toUpperCase())
    ) || this.docenteColumns[0] || '1';

    const countRes = await request.query(
      `SELECT COUNT(*) as total FROM VW_AVA_DOCENTE ${whereClause}`
    );
    const total = countRes.recordset[0]?.total || 0;

    const dataRes = await request.query(
      `SELECT * FROM VW_AVA_DOCENTE ${whereClause} 
       ORDER BY ${orderColumn} 
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
      const searchFields = this.turmaColumns.filter(col => 
        ['TURMA', 'DISCIPLINA', 'COD_TURMA', 'NOME_DISCIPLINA', 'COD_DISCIPLINA', 'CURSO'].includes(col.toUpperCase())
      );
      if (searchFields.length > 0) {
        whereClause = 'WHERE ' + searchFields.map((field, idx) => {
          request.input(`search${idx}`, sql.VarChar, `%${search}%`);
          return `${field} LIKE @search${idx}`;
        }).join(' OR ');
      }
    }

    const orderColumn = this.turmaColumns.find(col => 
      ['TURMA', 'COD_TURMA', 'DISCIPLINA'].includes(col.toUpperCase())
    ) || this.turmaColumns[0] || '1';

    const countRes = await request.query(
      `SELECT COUNT(*) as total FROM VW_AVA_TURMA ${whereClause}`
    );
    const total = countRes.recordset[0]?.total || 0;

    const dataRes = await request.query(
      `SELECT * FROM VW_AVA_TURMA ${whereClause} 
       ORDER BY ${orderColumn} 
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

  // --- Linked Disciplines Consultations (Student & Teacher) ---

  async getStudentDisciplines(matricula: string) {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    const request = this.pool.request();
    request.input('matricula', sql.VarChar, matricula);

    // 1. Identify which columns exist in VW_AVA_TURMA (e.g. MATRICULA/COD_ALUNO)
    // In many setups, VW_AVA_TURMA acts as the enrollment view, OR there is a VW_AVA_MATRICULA.
    // Let's dynamically check if "MATRICULA" or "ALUNO" exists in VW_AVA_TURMA or other AVA views
    const matriculaCol = this.turmaColumns.find(c => 
      ['MATRICULA', 'COD_ALUNO', 'ALUNO', 'DISCENTE', 'ALUNO_ID'].includes(c.toUpperCase())
    );

    if (matriculaCol) {
      // VW_AVA_TURMA has the matricula linked! We can query directly
      const res = await request.query(
        `SELECT * FROM VW_AVA_TURMA WHERE ${matriculaCol} = @matricula`
      );
      return res.recordset;
    }

    // Fallback: If VW_AVA_TURMA doesn't contain matricula, maybe another view does (like VW_AVA_MATRICULA if exists)
    const matriculaView = this.avaViews.find(v => v.toUpperCase().includes('MATRI') || v.toUpperCase().includes('DISCIPLINA'));
    if (matriculaView) {
      const cols = await this.getViewColumns(matriculaView);
      const mCol = cols.find(c => ['MATRICULA', 'COD_ALUNO', 'ALUNO', 'ALUNO_ID'].includes(c.toUpperCase()));
      if (mCol) {
        const res = await request.query(
          `SELECT * FROM ${matriculaView} WHERE ${mCol} = @matricula`
        );
        return res.recordset;
      }
    }

    // Second Fallback: Query all rows in VW_AVA_TURMA to see if any row matches, or search column names
    try {
      const res = await request.query(
        `SELECT * FROM VW_AVA_TURMA WHERE MATRICULA = @matricula`
      );
      return res.recordset;
    } catch (e) {
      // If all fails, return empty list cleanly
      return [];
    }
  }

  async getTeacherDisciplines(docenteId: string) {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    const request = this.pool.request();
    request.input('docenteId', sql.VarChar, docenteId);

    // Identify docente/professor column in VW_AVA_TURMA
    const docenteCol = this.turmaColumns.find(c => 
      ['DOCENTE', 'COD_DOCENTE', 'PROFESSOR', 'DOCENTE_ID', 'DOCENTEID'].includes(c.toUpperCase())
    );

    if (docenteCol) {
      const res = await request.query(
        `SELECT * FROM VW_AVA_TURMA WHERE ${docenteCol} = @docenteId`
      );
      return res.recordset;
    }

    try {
      const res = await request.query(
        `SELECT * FROM VW_AVA_TURMA WHERE DOCENTE = @docenteId`
      );
      return res.recordset;
    } catch (e) {
      return [];
    }
  }
}
