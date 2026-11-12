import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TutoriaService } from './tutoria.service';
import { TutoriaSyncService } from './tutoria-sync.service';
import { DB_CONNECTION } from '../db/db.provider';
import { CacheService } from '../cache/cache.service';

export interface MockDbState {
  users: Array<{ id: string; name: string; email: string; isActive: boolean }>;
  cards: Array<{
    id: string;
    matricula: string;
    periodo: string;
    sourceInstitution: string;
    status_kanban: string;
    tutor_responsavel_id: string | null;
    tutor_iniciador_id: string | null;
    tutor_nome?: string;
    observacoes: string | null;
    canal_contato_utilizado: string | null;
    ultimo_contato_em: Date | null;
    ultima_intervencao_em: Date | null;
    qtd_intervencoes: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  history: Array<{
    id: string;
    atendimento_id: string | null;
    atendimentoId?: string | null;
    matricula: string;
    periodo: string;
    sourceInstitution: string;
    tipo_evento: string;
    tipoEvento?: string;
    autor_id: string | null;
    autor_nome: string | null;
    tutor_responsavel_anterior_id: string | null;
    tutor_responsavel_novo_id: string | null;
    estado_anterior: string | null;
    estado_novo: string | null;
    canal_contato: string | null;
    observacoes: string | null;
    metadata: string | null;
    createdAt: Date;
  }>;
}

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

function createUniversalMockDb(initialState?: Partial<MockDbState>) {
  const state: MockDbState = {
    users: [
      {
        id: 'tutor-lead-1',
        name: 'Prof. Carlos Titular',
        email: 'carlos@unievangelica.edu.br',
        isActive: true,
      },
      {
        id: 'tutor-collab-2',
        name: 'Profa. Marina Colaboradora',
        email: 'marina@unievangelica.edu.br',
        isActive: true,
      },
      {
        id: 'tutor-new-3',
        name: 'Prof. Roberto Sucessor',
        email: 'roberto@unievangelica.edu.br',
        isActive: true,
      },
      {
        id: 'inactive-tutor-4',
        name: 'Tutor Inativo',
        email: 'inativo@unievangelica.edu.br',
        isActive: false,
      },
    ],
    cards: [
      {
        id: 'card-101',
        matricula: '20261001',
        periodo: '2026-2',
        sourceInstitution: 'ead',
        status_kanban: 'pendente',
        tutor_responsavel_id: 'tutor-lead-1',
        tutor_iniciador_id: 'tutor-lead-1',
        tutor_nome: 'Prof. Carlos Titular',
        observacoes: 'Card inicial',
        canal_contato_utilizado: null,
        ultimo_contato_em: null,
        ultima_intervencao_em: null,
        qtd_intervencoes: 0,
        createdAt: new Date('2026-08-01T10:00:00Z'),
        updatedAt: new Date('2026-08-01T10:00:00Z'),
      },
    ],
    history: [],
    ...initialState,
  };

  let currentQueryResult: any = [];

  const createQueryBuilder = () => {
    const qb: any = {
      from: jest.fn().mockImplementation(() => qb),
      innerJoin: jest.fn().mockImplementation(() => qb),
      leftJoin: jest.fn().mockImplementation(() => qb),
      where: jest.fn().mockImplementation(() => qb),
      groupBy: jest.fn().mockImplementation(() => qb),
      orderBy: jest.fn().mockImplementation(() => qb),
      limit: jest.fn().mockImplementation(() => qb),
      offset: jest.fn().mockImplementation(() => qb),
      values: jest.fn().mockImplementation(() => qb),
      set: jest.fn().mockImplementation(() => qb),
      returning: jest
        .fn()
        .mockImplementation(() => Promise.resolve(currentQueryResult)),
      then(resolve: (val: any) => void) {
        resolve(currentQueryResult);
      },
    };
    return qb;
  };

  const mockDbInstance = {
    _state: state,
    select: jest.fn().mockImplementation(() => createQueryBuilder()),
    selectDistinct: jest.fn().mockImplementation(() => createQueryBuilder()),
    insert: jest.fn().mockImplementation(() => createQueryBuilder()),
    update: jest.fn().mockImplementation(() => createQueryBuilder()),
    delete: jest.fn().mockImplementation(() => createQueryBuilder()),
    execute: jest.fn().mockImplementation(async (query: any) => {
      const sqlText = extractSqlString(query).toUpperCase();

      // 1. DDL Queries
      if (
        sqlText.includes('CREATE TABLE') ||
        sqlText.includes('ALTER TABLE') ||
        sqlText.includes('CREATE INDEX')
      ) {
        return [];
      }

      // 2. Summary Dashboard
      if (sqlText.includes('COUNT(CASE WHEN GRUPO_RISCO_CALCULADO')) {
        return [
          {
            total_alunos_disciplinas: 100,
            total_alunos_unicos: 40,
            total_disciplinas: 5,
            total_critico: 10,
            total_atencao: 25,
            total_autonomo: 65,
            media_tempo_minutos: 48.5,
            media_score_engajamento: 72,
          },
        ];
      }

      // 3. User Queries (Users Directory / Author Profile)
      if (sqlText.includes('FROM "USER"') || sqlText.includes('FROM USER')) {
        if (
          sqlText.includes('WHERE ID =') ||
          sqlText.includes('WHERE "ID" =') ||
          sqlText.includes('WHERE ID=')
        ) {
          for (const u of state.users) {
            if (sqlText.includes(u.id.toUpperCase())) return [u];
          }
          return [];
        }
        return state.users
          .filter((u) => u.isActive)
          .map((u) => ({ id: u.id, name: u.name, email: u.email }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // 4. Kanban Cards: SELECT
      if (
        sqlText.includes('FROM TUTORIA_ATENDIMENTOS_KANBAN') &&
        sqlText.includes('SELECT')
      ) {
        const matching = state.cards.filter(
          (c) =>
            sqlText.includes(c.id.toUpperCase()) ||
            sqlText.includes(c.matricula.toUpperCase()),
        );
        return matching;
      }

      // 5. Kanban Cards: UPDATE
      if (sqlText.includes('UPDATE TUTORIA_ATENDIMENTOS_KANBAN')) {
        for (const card of state.cards) {
          if (sqlText.includes(card.id.toUpperCase())) {
            card.updatedAt = new Date();
            if (sqlText.includes('TUTOR_RESPONSAVEL_ID =')) {
              for (const u of state.users) {
                if (sqlText.includes(u.id.toUpperCase())) {
                  card.tutor_responsavel_id = u.id;
                  break;
                }
              }
            }
            return [card];
          }
        }
        return [];
      }

      // 6. Timeline History: SELECT
      if (
        sqlText.includes('FROM TUTORIA_ATENDIMENTOS_HISTORICO') &&
        sqlText.includes('SELECT')
      ) {
        let events = state.history.map((h) => ({
          id: h.id,
          atendimentoId: h.atendimento_id || h.atendimentoId,
          matricula: h.matricula,
          periodo: h.periodo,
          sourceInstitution: h.sourceInstitution,
          tipoEvento: h.tipo_evento || h.tipoEvento,
          autorId: h.autor_id,
          autorNome: h.autor_nome,
          tutorResponsavelAnteriorId: h.tutor_responsavel_anterior_id,
          tutorResponsavelNovoId: h.tutor_responsavel_novo_id,
          estadoAnterior: h.estado_anterior,
          estadoNovo: h.estado_novo,
          canalContato: h.canal_contato,
          observacoes: h.observacoes,
          metadata: h.metadata,
          createdAt: h.createdAt,
        }));

        events = events.filter((e) =>
          sqlText.includes(e.matricula.toUpperCase()),
        );

        if (
          sqlText.includes('ATENDIMENTO_ID =') ||
          sqlText.includes('ATENDIMENTO_ID=')
        ) {
          events = events.filter(
            (e) =>
              e.atendimentoId &&
              sqlText.includes(e.atendimentoId.toUpperCase()),
          );
        }

        return events.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      }

      // 7. Timeline History: INSERT
      if (sqlText.includes('INSERT INTO TUTORIA_ATENDIMENTOS_HISTORICO')) {
        return [{ id: 'hist-new', createdAt: new Date() }];
      }

      return currentQueryResult;
    }),
  };

  return {
    mockDb: mockDbInstance,
    setQueryResult: (val: any) => {
      currentQueryResult = val;
    },
    state,
  };
}

describe('TutoriaService', () => {
  let service: TutoriaService;
  let mockDbFixture: ReturnType<typeof createUniversalMockDb>;
  let mockDb: any;
  let mockSyncService: any;
  let mockCache: any;

  beforeEach(async () => {
    mockDbFixture = createUniversalMockDb();
    mockDb = mockDbFixture.mockDb;

    mockSyncService = {
      syncTutoriaLogs: jest
        .fn()
        .mockResolvedValue({ status: 'success', records: 150 }),
      getSyncStatus: jest
        .fn()
        .mockReturnValue({ isSyncing: false, status: 'idle' }),
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutoriaService,
        {
          provide: DB_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: TutoriaSyncService,
          useValue: mockSyncService,
        },
        {
          provide: CacheService,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<TutoriaService>(TutoriaService);
    await service.onModuleInit();
    mockDb.execute.mockClear();
  });

  // =========================================================================
  // Baseline System Tests
  // =========================================================================
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return dashboard summary', async () => {
    const summary = await service.getDashboardSummary('2026-2', 'ead');
    expect(summary).toBeDefined();
    expect(summary.total_alunos_disciplinas).toBe(100);
    expect(mockDb.execute).toHaveBeenCalled();
  });

  it('should trigger manual sync via TutoriaSyncService', async () => {
    const res = await service.triggerManualSync('ead');
    expect(res).toEqual({ status: 'success', records: 150 });
    expect(mockSyncService.syncTutoriaLogs).toHaveBeenCalledWith('ead');
  });

  it('should run onModuleInit and ensure kanban and timeline tables without throwing', async () => {
    await expect(service.onModuleInit()).resolves.not.toThrow();
  });

  it('should gracefully handle database errors in ensureTimelineTable without crashing', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('Connection offline'));
    (service as any).hasEnsuredTimelineTable = false;
    (service as any).hasEnsuredKanbanTable = false;
    await expect(service.ensureTimelineTable()).resolves.not.toThrow();
  });

  // =========================================================================
  // Test Group 1: updateKanbanCard (Hybrid Multi-Tutor Ownership)
  // =========================================================================
  describe('updateKanbanCard (Hybrid Ownership & History)', () => {
    it('should preserve tutorResponsavelId when a collaborator moves card', async () => {
      const res = await service.updateKanbanCard(
        'card-101',
        { statusKanban: 'em_contato' },
        'tutor-collab-2',
      );

      expect(res.success).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();

      const executedSqls = mockDb.execute.mock.calls.map((call: any[]) =>
        extractSqlString(call[0]),
      );
      const overwriteSql = executedSqls.find((s: string) =>
        s.includes('tutor_responsavel_id = tutor-collab-2'),
      );
      expect(overwriteSql).toBeUndefined();

      const card = mockDbFixture.state.cards.find((c) => c.id === 'card-101');
      expect(card?.tutor_responsavel_id).toBe('tutor-lead-1');
    });

    it('should automatically record audit event on status change with author snapshot', async () => {
      await service.updateKanbanCard(
        'card-101',
        { statusKanban: 'em_contato' },
        'tutor-collab-2',
      );

      const executedSqls = mockDb.execute.mock.calls.map((call: any[]) =>
        extractSqlString(call[0]),
      );
      const insertSql = executedSqls.find((s: string) =>
        s.includes('INSERT INTO tutoria_atendimentos_historico'),
      );
      expect(insertSql).toBeDefined();
      expect(insertSql).toContain('mudanca_status');
    });

    it('should increment qtdIntervencoes and update ultimaIntervencaoEm when meaningful change happens', async () => {
      await service.updateKanbanCard(
        'card-101',
        { observacoes: 'Aluno contatado via telefone' },
        'tutor-collab-2',
      );

      const executedSqls = mockDb.execute.mock.calls.map((call: any[]) =>
        extractSqlString(call[0]),
      );
      const updateSql = executedSqls.find((s: string) =>
        s.includes('UPDATE tutoria_atendimentos_kanban'),
      );
      expect(updateSql).toBeDefined();
      expect(updateSql).toContain('ultima_intervencao_em');
      expect(updateSql).toContain('qtd_intervencoes');
    });

    it('should update canalContatoUtilizado and ultimoContatoEm when contact channel provided', async () => {
      await service.updateKanbanCard(
        'card-101',
        { canalContatoUtilizado: 'whatsapp' },
        'tutor-collab-2',
      );

      const executedSqls = mockDb.execute.mock.calls.map((call: any[]) =>
        extractSqlString(call[0]),
      );
      const updateSql = executedSqls.find((s: string) =>
        s.includes('UPDATE tutoria_atendimentos_kanban'),
      );
      expect(updateSql).toBeDefined();
      expect(updateSql).toContain('canal_contato_utilizado');
      expect(updateSql).toContain('ultimo_contato_em');
    });

    it('should throw NotFoundException when card does not exist', async () => {
      await expect(
        service.updateKanbanCard(
          'non-existent-card',
          { statusKanban: 'em_recuperacao' },
          'tutor-collab-2',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is invalid', async () => {
      await expect(
        service.updateKanbanCard(
          'card-101',
          { statusKanban: 'status_invalido_xyz' },
          'tutor-collab-2',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // Test Group 2: createIntervencao / registrarIntervencao
  // =========================================================================
  describe('createIntervencao / registrarIntervencao', () => {
    it('should record a manual intervention and link to card', async () => {
      const dto = {
        atendimentoId: 'card-101',
        matricula: '20261001',
        tipoEvento: 'intervencao_manual' as const,
        observacoes: 'Orientação de entrega da Fase 1',
      };

      const result = await service.registrarIntervencao(dto, {
        id: 'tutor-collab-2',
        name: 'Profa. Marina Colaboradora',
      });

      expect(result).toBeDefined();
      expect(result.tipoEvento).toBe('intervencao_manual');
      expect(result.autorNome).toBe('Profa. Marina Colaboradora');
      expect(result.atendimentoId).toBe('card-101');
    });

    it('should record a contact attempt with channel via alias createIntervencao', async () => {
      const dto = {
        matricula: '20261001',
        tipoEvento: 'contato_enviado' as const,
        canalContato: 'whatsapp' as const,
        observacoes: 'Contato via WhatsApp realizado',
      };

      const result = await service.createIntervencao(dto, {
        id: 'tutor-lead-1',
      });

      expect(result).toBeDefined();
      expect(result.canalContato).toBe('whatsapp');
      expect(result.autorNome).toBe('Prof. Carlos Titular');
    });

    it('should throw BadRequestException when matricula is empty', async () => {
      await expect(
        service.registrarIntervencao(
          {
            matricula: '',
            tipoEvento: 'intervencao_manual' as const,
            observacoes: 'Obs',
          },
          'tutor-lead-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when observacoes is empty', async () => {
      await expect(
        service.registrarIntervencao(
          {
            matricula: '20261001',
            tipoEvento: 'intervencao_manual' as const,
            observacoes: '   ',
          },
          'tutor-lead-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tipoEvento is invalid', async () => {
      await expect(
        service.registrarIntervencao(
          {
            matricula: '20261001',
            tipoEvento: 'evento_invalido' as any,
            observacoes: 'Obs',
          },
          'tutor-lead-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // Test Group 3: transferirTutor (Passagem de Bastão)
  // =========================================================================
  describe('transferirTutor (Passagem de Bastão)', () => {
    it('should transfer card ownership to new tutor and create passagem_bastao event', async () => {
      const res = await service.transferirTutor(
        'card-101',
        {
          novoTutorId: 'tutor-new-3',
          notaTransicao: 'Transferência para acompanhamento especializado',
        },
        { id: 'tutor-lead-1', name: 'Prof. Carlos Titular' },
      );

      expect(res.success).toBe(true);
      expect(res.card.tutorResponsavelId).toBe('tutor-new-3');
      expect(res.evento.tipoEvento).toBe('passagem_bastao');
      expect(res.evento.tutorResponsavelAnteriorId).toBe('tutor-lead-1');
      expect(res.evento.tutorResponsavelNovoId).toBe('tutor-new-3');
    });

    it('should throw NotFoundException when card does not exist for transfer', async () => {
      await expect(
        service.transferirTutor(
          'unknown-card',
          { novoTutorId: 'tutor-new-3', notaTransicao: 'Nota válida' },
          { id: 'tutor-lead-1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when target tutor does not exist', async () => {
      await expect(
        service.transferirTutor(
          'card-101',
          { novoTutorId: 'tutor-unknown-999', notaTransicao: 'Nota válida' },
          { id: 'tutor-lead-1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when target tutor is inactive', async () => {
      await expect(
        service.transferirTutor(
          'card-101',
          { novoTutorId: 'inactive-tutor-4', notaTransicao: 'Nota válida' },
          { id: 'tutor-lead-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when target tutor is already current owner', async () => {
      await expect(
        service.transferirTutor(
          'card-101',
          { novoTutorId: 'tutor-lead-1', notaTransicao: 'Nota válida' },
          { id: 'tutor-lead-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when transition note is too short (< 5 chars)', async () => {
      await expect(
        service.transferirTutor(
          'card-101',
          { novoTutorId: 'tutor-new-3', notaTransicao: '123' },
          { id: 'tutor-lead-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // Test Group 4: getTimelineAluno / getStudentTimeline
  // =========================================================================
  describe('getTimelineAluno / getStudentTimeline', () => {
    it('should return chronological timeline events', async () => {
      mockDbFixture.state.history.push({
        id: 'hist-1',
        atendimento_id: 'card-101',
        matricula: '20261001',
        periodo: '2026-2',
        sourceInstitution: 'ead',
        tipo_evento: 'abertura',
        autor_id: 'tutor-lead-1',
        autor_nome: 'Prof. Carlos Titular',
        tutor_responsavel_anterior_id: null,
        tutor_responsavel_novo_id: null,
        estado_anterior: null,
        estado_novo: 'pendente',
        canal_contato: null,
        observacoes: 'Atendimento iniciado',
        metadata: null,
        createdAt: new Date('2026-08-01T10:00:00Z'),
      });

      const timeline = await service.getTimelineAluno('20261001');
      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0].tipoEvento).toBe('abertura');
    });

    it('should filter timeline events by atendimentoId when query parameter is provided', async () => {
      mockDbFixture.state.history = [
        {
          id: 'hist-1',
          atendimento_id: 'card-101',
          matricula: '20261001',
          periodo: '2026-2',
          sourceInstitution: 'ead',
          tipo_evento: 'abertura',
          autor_id: 'tutor-lead-1',
          autor_nome: 'Prof. Carlos Titular',
          tutor_responsavel_anterior_id: null,
          tutor_responsavel_novo_id: null,
          estado_anterior: null,
          estado_novo: 'pendente',
          canal_contato: null,
          observacoes: 'Atendimento 101',
          metadata: null,
          createdAt: new Date('2026-08-01T10:00:00Z'),
        },
      ];

      const timeline = await service.getStudentTimeline('20261001', 'card-101');
      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBe(1);
    });

    it('should generate fallback abertura event when 0 history events exist for card', async () => {
      mockDbFixture.state.history = [];

      const timeline = await service.getStudentTimeline('20261001');
      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBe(1);
      expect(timeline[0].tipoEvento).toBe('abertura');
      expect(timeline[0].id).toContain('legacy-');
    });

    it('should return empty array when matricula has no card and no history', async () => {
      mockDbFixture.state.history = [];
      const timeline = await service.getTimelineAluno('99999999');
      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBe(0);
    });

    it('should throw BadRequestException when matricula is empty', async () => {
      await expect(service.getTimelineAluno('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================================
  // Test Group 5: getTutoresAtivos / getActiveTutors
  // =========================================================================
  describe('getTutoresAtivos / getActiveTutors', () => {
    it('should return active tutors list excluding inactive tutors', async () => {
      const tutors = await service.getTutoresAtivos();
      expect(Array.isArray(tutors)).toBe(true);
      expect(
        tutors.find((t: any) => t.id === 'inactive-tutor-4'),
      ).toBeUndefined();
      expect(tutors.find((t: any) => t.id === 'tutor-lead-1')).toBeDefined();
    });

    it('should work identically through getActiveTutors alias', async () => {
      const tutors = await service.getActiveTutors();
      expect(Array.isArray(tutors)).toBe(true);
      expect(tutors.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Test Group 6: Author Name Resolution & Cache (resolveTutorInfo)
  // =========================================================================
  describe('Author Name Resolution & Cache (resolveTutorInfo)', () => {
    it('should return cached tutor info on repeated invocations without querying database', async () => {
      const first = await service.resolveTutorInfo('tutor-lead-1');
      expect(first).toBeDefined();
      expect(first?.name).toBe('Prof. Carlos Titular');

      mockDb.execute.mockClear();

      const second = await service.resolveTutorInfo('tutor-lead-1');
      expect(second).toBeDefined();
      expect(second?.name).toBe('Prof. Carlos Titular');
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should return default fallback name when user id is null or undefined', async () => {
      const fallback = await service.resolveTutorInfo(undefined);
      expect(fallback).toBeDefined();
      expect(fallback?.name).toBe('Tutor Atuante');
    });
  });
});
