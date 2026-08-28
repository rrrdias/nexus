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
import { eq, ilike, or, and, sql as drizzleSql, desc, asc, inArray, isNull } from 'drizzle-orm';
import { academicDiscente, academicDocente, academicTurma, academicMatricula } from '../db/schema';


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
      user: process.env.LYCEUM_DB_USERNAME || '',
      password: process.env.LYCEUM_DB_PASSWORD || '',
      server: process.env.LYCEUM_DB_HOST || '',
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
    const offset = (page - 1) * size;
    let whereClause: any = undefined;

    if (search) {
      const trimmedSearch = search.trim();
      const isCodeSearch = /\d/.test(trimmedSearch);

      if (isCodeSearch) {
        whereClause = or(
          ilike(academicDiscente.matricula, `%${trimmedSearch}%`),
          ilike(academicDiscente.cpf, `%${trimmedSearch}%`),
          ilike(academicDiscente.usuario, `%${trimmedSearch}%`),
          ilike(academicDiscente.id, `%${trimmedSearch}%`)
        );
      } else {
        const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);
        const textConditions = words.map(word => or(
          ilike(academicDiscente.nome, `%${word}%`),
          ilike(academicDiscente.sobrenome, `%${word}%`),
          ilike(academicDiscente.nomeSocial, `%${word}%`),
          ilike(academicDiscente.sobrenomeSocial, `%${word}%`)
        ));
        whereClause = and(...textConditions);
      }
    }

    const countRes = await this.db.select({ count: drizzleSql<number>`count(*)` })
      .from(academicDiscente)
      .where(whereClause);
    const total = Number(countRes[0]?.count || 0);

    const data = await this.db.select()
      .from(academicDiscente)
      .where(whereClause)
      .orderBy(asc(academicDiscente.nome))
      .limit(size)
      .offset(offset);

    return {
      data,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    };
  }

  async getTeachers(search?: string, page = 1, size = 15) {
    const offset = (page - 1) * size;
    let whereClause: any = undefined;

    if (search) {
      const trimmedSearch = search.trim();
      const isCodeSearch = /\d/.test(trimmedSearch);

      if (isCodeSearch) {
        whereClause = or(
          ilike(academicDocente.cpf, `%${trimmedSearch}%`),
          ilike(academicDocente.id, `%${trimmedSearch}%`)
        );
      } else {
        const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);
        const textConditions = words.map(word => or(
          ilike(academicDocente.nome, `%${word}%`),
          ilike(academicDocente.sobrenome, `%${word}%`),
          ilike(academicDocente.nomeSocial, `%${word}%`),
          ilike(academicDocente.sobrenomeSocial, `%${word}%`)
        ));
        whereClause = and(...textConditions);
      }
    }

    const countRes = await this.db.select({ count: drizzleSql<number>`count(*)` })
      .from(academicDocente)
      .where(whereClause);
    const total = Number(countRes[0]?.count || 0);

    const data = await this.db.select()
      .from(academicDocente)
      .where(whereClause)
      .orderBy(asc(academicDocente.nome))
      .limit(size)
      .offset(offset);

    return {
      data,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    };
  }

  async getClasses(search?: string, page = 1, size = 15) {
    const offset = (page - 1) * size;
    let whereClause: any = undefined;

    if (search) {
      const trimmedSearch = search.trim();
      const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);
      
      const textConditions = words.map(word => or(
        ilike(academicTurma.id, `%${word}%`),
        ilike(academicTurma.turma, `%${word}%`),
        ilike(academicTurma.codTurma, `%${word}%`),
        ilike(academicTurma.disciplina, `%${word}%`),
        ilike(academicTurma.nomeDisciplina, `%${word}%`),
        ilike(academicTurma.codDisciplina, `%${word}%`),
        ilike(academicTurma.cursoNome, `%${word}%`),
        ilike(academicTurma.periodo, `%${word}%`)
      ));
      whereClause = and(...textConditions);
    }

    const countRes = await this.db.select({ count: drizzleSql<number>`count(*)` })
      .from(academicTurma)
      .where(whereClause);
    const total = Number(countRes[0]?.count || 0);

    const data = await this.db.select()
      .from(academicTurma)
      .where(whereClause)
      .orderBy(desc(academicTurma.periodo), asc(academicTurma.nomeDisciplina), asc(academicTurma.turma))
      .limit(size)
      .offset(offset);

    return {
      data,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    };
  }


  async getMatriculas(search?: string, page = 1, size = 15) {
    const offset = (page - 1) * size;
    let whereClause: any = undefined;

    if (search) {
      const trimmedSearch = search.trim();
      const words = trimmedSearch.split(/\s+/).filter(w => w.length > 0);
      
      const textConditions = words.map(word => or(
        ilike(academicDiscente.nome, `%${word}%`),
        ilike(academicDiscente.sobrenome, `%${word}%`),
        ilike(academicDiscente.nomeSocial, `%${word}%`),
        ilike(academicTurma.turma, `%${word}%`),
        ilike(academicTurma.nomeDisciplina, `%${word}%`),
        ilike(academicMatricula.usuarioId, `%${word}%`)
      ));
      whereClause = and(...textConditions);
    }

    const baseQuery = this.db.select({
      id: academicMatricula.id,
      usuario: academicMatricula.usuarioId,
      turma: academicMatricula.turmaId,
      nivel: academicMatricula.nivel,
      ativo: academicMatricula.ativo,
      situacao: academicMatricula.situacao,
      nome: academicDiscente.nome,
      sobrenome: academicDiscente.sobrenome,
      nomeSocial: academicDiscente.nomeSocial,
      sobrenomeSocial: academicDiscente.sobrenomeSocial,
      nomeDisciplina: academicTurma.nomeDisciplina,
      turmaNome: academicTurma.turma
    })
    .from(academicMatricula)
    .leftJoin(academicDiscente, eq(academicMatricula.usuarioId, academicDiscente.id))
    .leftJoin(academicTurma, eq(academicMatricula.turmaId, academicTurma.id));

    if (whereClause && search) {
      baseQuery.where(whereClause);
    }

    // Workaround for counting with joins in Drizzle
    const countQuery = this.db.select({ count: drizzleSql<number>`count(*)` })
      .from(academicMatricula)
      .leftJoin(academicDiscente, eq(academicMatricula.usuarioId, academicDiscente.id))
      .leftJoin(academicTurma, eq(academicMatricula.turmaId, academicTurma.id));
      
    if (whereClause && search) countQuery.where(whereClause);
    
    const countRes = await countQuery;
    const total = Number(countRes[0]?.count || 0);

    const data = await baseQuery
      .limit(size)
      .offset(offset);

    // Format output to match old Lyceum response
    const formattedData = data.map(m => ({
      ID: m.id,
      USUARIO: m.usuario,
      TURMA: m.turma,
      NIVEL: m.nivel,
      ATIVO: m.ativo,
      SITUACAO: m.situacao,
      NOME: m.nomeSocial || m.nome,
      SOBRENOME: m.sobrenomeSocial || m.sobrenome,
      NOME_DISCIPLINA: m.nomeDisciplina || m.turmaNome
    }));

    return {
      data: formattedData,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size)
    };
  }

  async getStudentDisciplines(matricula: string) {
    const trimmed = (matricula || '').trim();
    if (!trimmed) return [];

    // 1. Localiza o discente para capturar id, matrícula e usuário
    const studentInfo = await this.db.select({
      id: academicDiscente.id,
      matricula: academicDiscente.matricula,
      usuario: academicDiscente.usuario,
      cpf: academicDiscente.cpf,
    })
    .from(academicDiscente)
    .where(or(
      eq(academicDiscente.id, trimmed),
      eq(academicDiscente.matricula, trimmed),
      eq(academicDiscente.usuario, trimmed),
      eq(academicDiscente.cpf, trimmed)
    ))
    .limit(1);

    const userIds = new Set<string>([trimmed]);
    if (studentInfo[0]) {
      if (studentInfo[0].id) userIds.add(studentInfo[0].id);
      if (studentInfo[0].matricula) userIds.add(studentInfo[0].matricula);
      if (studentInfo[0].usuario) userIds.add(studentInfo[0].usuario);
    }

    const data = await this.db.select({
      TURMA: academicTurma.id,
      DISCIPLINA: academicTurma.disciplina,
      NOME_DISCIPLINA: academicTurma.nomeDisciplina,
      PERIODO: academicTurma.periodo,
      COD_TURMA: academicTurma.turma,
      SITUACAO: academicMatricula.situacao,
      ATIVO: academicMatricula.ativo,
      NIVEL: academicMatricula.nivel,
    })
    .from(academicMatricula)
    .innerJoin(academicTurma, eq(academicMatricula.turmaId, academicTurma.id))
    .where(
      and(
        inArray(academicMatricula.usuarioId, Array.from(userIds)),
        or(
          eq(academicMatricula.nivel, '2'),
          eq(academicMatricula.nivel, 'Aluno'),
          isNull(academicMatricula.nivel)
        )
      )
    )
    .orderBy(desc(academicTurma.periodo), asc(academicTurma.nomeDisciplina));

    return data;
  }

  async getTeacherDisciplines(docenteId: string) {
    const trimmed = (docenteId || '').trim();
    if (!trimmed) return [];

    const teacherInfo = await this.db.select({
      id: academicDocente.id,
      cpf: academicDocente.cpf,
    })
    .from(academicDocente)
    .where(or(
      eq(academicDocente.id, trimmed),
      eq(academicDocente.cpf, trimmed)
    ))
    .limit(1);

    const userIds = new Set<string>([trimmed]);
    if (teacherInfo[0]?.id) userIds.add(teacherInfo[0].id);

    const data = await this.db.select({
      TURMA: academicTurma.id,
      DISCIPLINA: academicTurma.disciplina,
      NOME_DISCIPLINA: academicTurma.nomeDisciplina,
      PERIODO: academicTurma.periodo,
      COD_TURMA: academicTurma.turma,
      SITUACAO: academicMatricula.situacao,
      ATIVO: academicMatricula.ativo,
      NIVEL: academicMatricula.nivel,
    })
    .from(academicMatricula)
    .innerJoin(academicTurma, eq(academicMatricula.turmaId, academicTurma.id))
    .where(
      and(
        inArray(academicMatricula.usuarioId, Array.from(userIds)),
        or(
          eq(academicMatricula.nivel, '1'),
          eq(academicMatricula.nivel, 'Docente'),
          isNull(academicMatricula.nivel)
        )
      )
    )
    .orderBy(desc(academicTurma.periodo), asc(academicTurma.nomeDisciplina));

    return data;
  }


  getSqlPool() {
    if (!this.pool) throw new Error('Lyceum database not connected.');
    return this.pool;
  }

  getDbPrefix() {
    return this.dbPrefix;
  }
}
