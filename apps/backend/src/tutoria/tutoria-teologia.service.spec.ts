import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TutoriaTeologiaService } from './tutoria-teologia.service';
import { TutoriaTeologiaController } from './tutoria-teologia.controller';
import { TutoriaService } from './tutoria.service';
import { TutoriaSyncService } from './tutoria-sync.service';
import { DB_CONNECTION } from '../db/db.provider';
import { CacheService } from '../cache/cache.service';
import {
  REQUIRE_MODULES_KEY,
  REQUIRE_ADMIN_KEY,
} from '../auth/rbac.decorators';
import { TutoriaController } from './tutoria.controller';

function extractSqlString(query: any): string {
  if (!query) return '';
  if (typeof query === 'string') return query;
  if (query.queryChunks) {
    return query.queryChunks
      .map((c: any) => {
        if (!c) return '';
        if (typeof c === 'string') return c;
        if (c.queryChunks) return extractSqlString(c);
        if (Array.isArray(c?.value)) return c.value.join('');
        if (c?.value !== undefined) {
          if (typeof c.value === 'object' && c.value?.queryChunks) {
            return extractSqlString(c.value);
          }
          return String(c.value);
        }
        return String(c?.text || c || '');
      })
      .join(' ');
  }
  return JSON.stringify(query);
}

describe('TutoriaTeologiaService & Grupo Gestão', () => {
  let teologiaService: TutoriaTeologiaService;
  let tutoriaService: TutoriaService;
  let mockDb: any;
  let mockCache: any;
  let executedQueries: string[];

  beforeEach(async () => {
    executedQueries = [];

    mockDb = {
      execute: jest.fn(async (query: any) => {
        const sqlStr = extractSqlString(query);
        executedQueries.push(sqlStr);

        if (sqlStr.includes('FROM tutoria_grupos') && sqlStr.includes('LIMIT 1')) {
          return [{ id: 'grp-teologia-1', slug: 'teologia', nome: 'Teologia', ativo: true }];
        }

        if (sqlStr.includes('FROM tutoria_grupo_alunos tga') && sqlStr.includes('LIMIT 1')) {
          if (sqlStr.includes('FORA_GRUPO')) {
            return [];
          }
          return [{ id: 'member-1' }];
        }

        if (sqlStr.includes('INSERT INTO tutoria_grupo_alunos')) {
          return [{ matricula: 'D2610339' }, { matricula: 'D2620379' }];
        }

        if (sqlStr.includes('DELETE FROM tutoria_grupo_alunos')) {
          return [{ matricula: 'D2610339' }];
        }

        if (sqlStr.includes('SELECT COUNT(*)::int AS total') && sqlStr.includes('tutoria_grupo_alunos')) {
          return [{ total: 1 }];
        }

        if (sqlStr.includes('nota_fase1') && sqlStr.includes('FROM tutoria_engajamento_aluno e')) {
          return [
            {
              id: 'eng-1',
              sourceInstitution: 'ead',
              periodo: '2026-2',
              disciplina_id: '4407',
              disciplina_codigo: 'D1459T01-EAD-A20262',
              disciplina_nome: 'ESPIRITUALIDADE CRISTÃ - D1459T01-EAD-A20262',
              aluno_id: '1001',
              matricula: 'D2610339',
              aluno_nome: 'Pedro Henrique Silva Chaves',
              aluno_email: 'pedro@test.com',
              enrolment_status: 'Ativo',
              tempo_total_minutos: '45.00',
              nota_fase1: '85.00',
              nota_fase2: '90.00',
              nota_fase3: '0.00',
            },
          ];
        }

        if (
          sqlStr.includes('FROM course_activities ca') ||
          sqlStr.includes('FROM tutoria_logs_atividades l')
        ) {
          if (sqlStr.includes('4320')) {
            return [];
          }
          return [
            {
              id: 'log-1',
              unidade_tematica_nome: 'Fase 1',
              conteudo_nome: 'Unidade Temática 01',
              qtd_cliques_acessos: 3,
              tempo_conteudo_minutos: '12.00',
            },
            {
              id: 'catalog-4407-323683',
              unidade_tematica_nome: 'Fase 1',
              conteudo_nome: '1ª Verificação de Aprendizagem',
              qtd_cliques_acessos: 0,
              tempo_conteudo_minutos: '0',
            },
          ];
        }

        if (sqlStr.includes('FROM academic_discente')) {
          return [{ telefone: '62999990000', email: 'pedro@test.com', curso_nome: 'Teologia', unidade_fisica: 'Anápolis' }];
        }

        if (sqlStr.includes('FROM ava_grades_report g')) {
          return [
            {
              fase1: '85.00',
              fase2: '90.00',
              fase3: '0.00',
              lista_fase1:
                '1ª Verificação de Aprendizagem: 85.00 | Atividade de Fixação - Unidade Temática 01: Pendente',
              lista_fase2: 'Atividade de Fixação - Unidade Temática 05: 90.00',
              lista_fase3: null,
              periodo: '2026-2',
              course_id: sqlStr.includes('4320') ? '4320' : '4407',
              course_shortname: 'D1459T01-EAD-A20262',
              course_fullname: 'ESPIRITUALIDADE CRISTÃ',
            },
          ];
        }

        return [];
      }),
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      wrap: jest.fn(async (_k: string, fn: () => Promise<any>) => fn()),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TutoriaController, TutoriaTeologiaController],
      providers: [
        TutoriaService,
        TutoriaTeologiaService,
        {
          provide: TutoriaSyncService,
          useValue: {
            syncTutoriaLogs: jest.fn(),
            getSyncStatus: jest.fn(),
          },
        },
        { provide: DB_CONNECTION, useValue: mockDb },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    teologiaService = module.get<TutoriaTeologiaService>(TutoriaTeologiaService);
    tutoriaService = module.get<TutoriaService>(TutoriaService);
  });

  it('deve exigir @RequireModule("tutoria-teologia") no TutoriaTeologiaController', () => {
    const reflector = new Reflector();
    const modules = reflector.get<string[]>(
      REQUIRE_MODULES_KEY,
      TutoriaTeologiaController,
    );
    expect(modules).toEqual(['tutoria-teologia']);
  });

  it('deve proteger endpoints de gestão de grupos no TutoriaController com @RequireAdmin()', () => {
    const reflector = new Reflector();
    expect(
      reflector.get<boolean>(
        REQUIRE_ADMIN_KEY,
        TutoriaController.prototype.addAlunosToGrupo,
      ),
    ).toBe(true);
    expect(
      reflector.get<boolean>(
        REQUIRE_ADMIN_KEY,
        TutoriaController.prototype.removeAlunoFromGrupo,
      ),
    ).toBe(true);
    expect(
      reflector.get<boolean>(
        REQUIRE_ADMIN_KEY,
        TutoriaController.prototype.listGrupoAlunos,
      ),
    ).toBe(true);
  });

  it('deve retornar listagem de Teologia sem Kanban e com totais das notas Fases 1, 2 e 3', async () => {
    const res = await teologiaService.getTeologiaEngagementList({
      periodo: '2026-2',
      institution: 'ead',
      page: 1,
      limit: 15,
    });

    expect(res.data).toHaveLength(1);
    const item = res.data[0] as any;
    expect(item.nota_fase1).toBe('85.00');
    expect(item.nota_fase2).toBe('90.00');
    expect(item.nota_fase3).toBe('0.00');
    expect(item.status_kanban).toBeUndefined();

    const engQuery = executedQueries.find(
      (q) => q.includes('nota_fase1') && q.includes('FROM tutoria_engajamento_aluno e'),
    );
    expect(engQuery).toBeDefined();
    expect(engQuery).not.toContain('tutoria_atendimentos_kanban');
    expect(engQuery).toContain('tutoria_grupo_alunos');
  });

  it('deve retornar catálogo completo (acessados e não acessados), discente e notas (Fase 1, 2, 3) sem Kanban e mesclar faltantes de ava_grades_report', async () => {
    const res = await teologiaService.getTeologiaStudentActivityLogs(
      'D2610339',
      '4407',
      'ead',
    );

    // 2 do catálogo (1 acessado + 1 não acessado) + 2 faltantes vindos de lista_fase1/lista_fase2 (sem duplicar "1ª Verificação de Aprendizagem")
    expect(res.logs).toHaveLength(4);
    expect(res.logs.filter((l: any) => l.qtd_cliques_acessos === 0)).toHaveLength(3);
    expect(res.logs.map((l: any) => l.conteudo_nome)).toEqual([
      'Unidade Temática 01',
      '1ª Verificação de Aprendizagem',
      'Atividade de Fixação - Unidade Temática 01',
      'Atividade de Fixação - Unidade Temática 05',
    ]);

    const catalogQuery = executedQueries.find((q) =>
      q.includes('WITH course_activities AS'),
    );
    expect(catalogQuery).toBeDefined();
    expect(catalogQuery).toContain('LEFT JOIN tutoria_logs_atividades l');

    expect(res.discente).toMatchObject({ curso_nome: 'Teologia' });
    expect(res.grades).toEqual({
      fase1: '85.00',
      fase2: '90.00',
      fase3: '0.00',
    });
    expect((res as any).kanban).toBeUndefined();
  });

  it('deve utilizar fallback de lista_fase1/2/3 quando o catálogo da disciplina estiver vazio em tutoria_logs_atividades', async () => {
    const res = await teologiaService.getTeologiaStudentActivityLogs(
      'D2610339',
      '4320',
      'ead',
    );

    expect(res.logs).toHaveLength(3);
    expect(res.logs.every((l: any) => l.qtd_cliques_acessos === 0)).toBe(true);
    expect(res.logs[0]).toMatchObject({
      unidade_tematica_nome: 'Fase 1',
      conteudo_nome: '1ª Verificação de Aprendizagem',
      tempo_conteudo_minutos: '0',
    });
  });

  it('deve também consultar catálogo completo em TutoriaService.getStudentActivityLogs quando disciplinaId for informada', async () => {
    const res = await tutoriaService.getStudentActivityLogs('D2610339', '4407');

    expect(res.logs).toHaveLength(2);
    const catalogQuery = executedQueries.find((q) =>
      q.includes('WITH course_activities AS'),
    );
    expect(catalogQuery).toBeDefined();
  });

  it('deve bloquear consulta de detalhes (404 NotFoundException) para matrícula fora do grupo de Teologia', async () => {
    await expect(
      teologiaService.getTeologiaStudentActivityLogs('FORA_GRUPO', '4407', 'ead'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deve deduplicar matrículas e invalidar cache ao adicionar alunos ao grupo', async () => {
    const res = await tutoriaService.addAlunosToGrupo(
      'teologia',
      {
        matriculas: [' D2610339 ', 'D2610339', 'D2620379', '   '],
        institution: 'ead',
      },
      'admin-user-1',
    );

    expect(res.addedCount).toBe(2);
    expect(res.matriculas).toEqual(['D2610339', 'D2620379']);
    expect(mockCache.delByPattern).toHaveBeenCalledWith('tutoria:*');
  });

  it('deve rejeitar lista sem matrículas válidas com BadRequestException', async () => {
    await expect(
      tutoriaService.addAlunosToGrupo(
        'teologia',
        { matriculas: ['   ', ''], institution: 'ead' },
        'admin-user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('deve remover matrícula do grupo de Teologia e invalidar cache', async () => {
    const res = await tutoriaService.removeAlunoFromGrupo(
      'teologia',
      ' D2610339 ',
      'ead',
    );

    expect(res).toEqual({
      success: true,
      grupo: 'teologia',
      removed: true,
      matricula: 'D2610339',
    });
    expect(mockCache.delByPattern).toHaveBeenCalledWith('tutoria:*');
  });
});
