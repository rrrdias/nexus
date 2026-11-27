import {
  AvaReportsService,
  countUnidadesTematicas,
  resolveTipoTurmaEad,
} from './ava-reports.service';

describe('AvaReportsService (Performance and SQL Aggregation Tests)', () => {
  let service: AvaReportsService;
  let db: any;

  beforeEach(() => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      selectDistinct: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
    };

    db = queryBuilder;
    service = new AvaReportsService(
      db,
      {} as any,
      {
        get: jest.fn(),
        set: jest.fn(),
        wrap: jest.fn((_key: string, fn: () => any) => fn()),
      } as any,
    );
  });

  const superAdminUser = {
    id: 'admin-1',
    isSuperAdmin: true,
    isDisabled: false,
  };

  it('should execute getAvaDashboardStats with SQL GROUP BY without full table memory scan', async () => {
    // Mock progress stats response
    const mockProgressStats = [
      {
        sourceInstitution: 'ead',
        totalStudents: 150,
        validProgressCount: 140,
        avgProgress: 75.5,
        noAccessCount: 10,
        lastSync: new Date('2026-08-25T10:00:00Z'),
      },
    ];

    // Mock grade stats response
    const mockGradeStats = [
      {
        sourceInstitution: 'ead',
        validGradesCount: 140,
        avgGrade: 82.0,
        belowApprovalCount: 12,
        lastSync: new Date('2026-08-25T10:00:00Z'),
      },
    ];

    db.groupBy
      .mockResolvedValueOnce(mockProgressStats)
      .mockResolvedValueOnce(mockGradeStats);

    const stats = await service.getAvaDashboardStats(superAdminUser);

    expect(stats.totalStudents).toBe(150);
    expect(stats.averageProgress).toBe(76);
    expect(stats.averageGrade).toBe(82);
    expect(stats.belowApprovalCount).toBe(12);
    expect(stats.noAccessCount).toBe(10);
    expect(stats.institutionsStats.find((i) => i.id === 'ead')?.status).toBe(
      'success',
    );
  });

  it('should paginate getProgressData directly in SQL with LIMIT and OFFSET', async () => {
    const mockRows = [
      {
        id: '1',
        aluno: 'Aluno Teste 1',
        curso: 'Engenharia',
        lastaccess: '20/08/2026',
        progressoTotal: '80',
      },
    ];

    // Call 1 (count): where returns promise
    // Call 2 (paginated rows): where returns queryBuilder, offset returns promise
    // Call 3 (metrics): where returns promise
    db.where
      .mockResolvedValueOnce([{ count: 500 }])
      .mockReturnValueOnce(db)
      .mockResolvedValueOnce([
        {
          avgTotal: 78.4,
          avgF1: 85.0,
          avgF2: 70.0,
          avgF3: 0,
          matSemAcesso: 15,
          uniqueStudents: 450,
          uniqueDisciplines: 30,
          belowExpected: 25,
        },
      ]);

    db.offset.mockResolvedValueOnce(mockRows);

    const result = await service.getProgressData(superAdminUser, 1, 15, {
      sourceInstitution: 'ead',
    });

    expect(result.total_records).toBe(500);
    expect(result.total_pages).toBe(34);
    expect(result.data).toHaveLength(1);
    expect(result.average_progress).toBe(78);
  });

  it('should paginate and join getConsolidatedData returning progress and grades together', async () => {
    const mockConsolidatedRows = [
      {
        id: '1',
        aluno: 'Aluno Teste Unificado',
        curso: 'Administração',
        progressoFase1: '100',
        progressoFase2: '80',
        progressoFase3: '50',
        progressoTotal: '76',
        notaFase1: '9.0',
        notaFase2: '7.5',
        notaFase3: '8.0',
        mediaFinal: '8.1',
        lastaccess: '25/08/2026',
      },
    ];

    db.where.mockReturnValueOnce(db).mockResolvedValueOnce([
      {
        totalRecords: 1200,
        avgProgress: 76.5,
        avgGrade: 81.0,
        belowApproval: 10,
        noAccessCount: 5,
        uniqueStudents: 1100,
        uniqueDisciplines: 25,
      },
    ]);

    db.offset.mockResolvedValueOnce(mockConsolidatedRows);
    db.orderBy
      .mockReturnValueOnce(db)
      .mockResolvedValueOnce([{ value: '2026-1' }])
      .mockResolvedValueOnce([{ value: 'Administração' }])
      .mockResolvedValueOnce([{ value: 'Polo Anápolis' }]);

    const result = await service.getConsolidatedData(superAdminUser, 1, 15, {
      sourceInstitution: 'ead',
    });

    expect(result.total_records).toBe(1200);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].progressoFase1).toBe('100');
    expect(result.data[0].notaFase1).toBe('9.0');
    expect(result.data[0].mediaFinal).toBe('8.1');
    expect(result.average_progress).toBe(77);
    expect(result.average_grade).toBe(81);
  });

  it('should resolve EaD tipoTurma and count distinct Unidades Tematicas accurately', () => {
    expect(resolveTipoTurmaEad('REGULARES')).toBe('Regular');
    expect(resolveTipoTurmaEad('ESPECIAIS')).toBe('Especial');
    expect(resolveTipoTurmaEad('2026-2')).toBeNull();
    expect(resolveTipoTurmaEad(null)).toBeNull();

    // Deduplica UT 01..04 quando aparece tanto no livro quanto na atividade de fixacao
    const count = countUnidadesTematicas(
      'Unidade Temática 01:Concluído:10/08/2026|Atividade de Fixação - Unidade Temática 01:Concluído:10/08/2026|Unidade Temática 02:Pendente:-',
      'Atividade de Fixação - Unidade Temática 05:Pendente:-|Unidade Temática 06:Pendente:-',
      'Unidade Temática 09:Pendente:-|3ª Verificação de Aprendizagem:Pendente:-',
    );
    expect(count).toBe(5);

    // Disciplinas especiais sem UTs retornam 0
    expect(
      countUnidadesTematicas(
        'Entrega 1 — Carta de Apresentação:Pendente:-|Entrega 2 — Plano:Pendente:-',
      ),
    ).toBe(0);
  });

  it('should include tipoTurma and unidadesTematicas in getConsolidatedExportData only for EaD', async () => {
    const mockRow = {
      id: 'exp-1',
      sourceInstitution: 'ead',
      aluno: 'Aluno EaD',
      curso: 'GESTÃO ORÇAMENTÁRIA – D0535T01-EAD-A20262',
      subcategoria: 'REGULARES',
      progressoListaFase1:
        'Unidade Temática 01:Concluído:-|Unidade Temática 02:Concluído:-',
      progressoListaFase2: 'Unidade Temática 05:Pendente:-',
      progressoListaFase3: null,
      notasListaFase1: null,
      notasListaFase2: null,
      notasListaFase3: null,
      lastaccess: '25/08/2026',
    };

    db.orderBy.mockResolvedValueOnce([mockRow]).mockResolvedValueOnce([
      { ...mockRow, sourceInstitution: 'uni' },
    ]);

    const eadExport = await service.getConsolidatedExportData(superAdminUser, {
      sourceInstitution: 'ead',
    });
    expect(eadExport[0]).toMatchObject({
      tipoTurma: 'Regular',
      unidadesTematicas: 3,
    });
    expect((eadExport[0] as any).progressoListaFase1).toBeUndefined();

    const uniExport = await service.getConsolidatedExportData(superAdminUser, {
      sourceInstitution: 'uni',
    });
    expect((uniExport[0] as any).tipoTurma).toBeUndefined();
    expect((uniExport[0] as any).unidadesTematicas).toBeUndefined();
  });

  it('should filter EaD consolidated export by unidades_tematicas and tipo_turma without impacting other institutions', async () => {
    const courseRows = [
      {
        curso: 'DISCIPLINA 8 UTS - D100-EAD',
        progressoListaFase1: 'Unidade Temática 01:Concluído:-|Unidade Temática 02:Pendente:-',
        progressoListaFase2: 'Unidade Temática 05:Pendente:-|Unidade Temática 06:Pendente:-',
        progressoListaFase3:
          'Unidade Temática 09:Pendente:-|Unidade Temática 10:Pendente:-|Unidade Temática 11:Pendente:-|Unidade Temática 12:Pendente:-',
        notasListaFase1: null,
        notasListaFase2: null,
        notasListaFase3: null,
      },
      {
        curso: 'DISCIPLINA 12 UTS - D200-EAD',
        progressoListaFase1:
          'Unidade Temática 01:Concluído:-|Unidade Temática 02:Concluído:-|Unidade Temática 03:Concluído:-|Unidade Temática 04:Concluído:-',
        progressoListaFase2:
          'Unidade Temática 05:Pendente:-|Unidade Temática 06:Pendente:-|Unidade Temática 07:Pendente:-|Unidade Temática 08:Pendente:-',
        progressoListaFase3:
          'Unidade Temática 09:Pendente:-|Unidade Temática 10:Pendente:-|Unidade Temática 11:Pendente:-|Unidade Temática 12:Pendente:-',
        notasListaFase1: null,
        notasListaFase2: null,
        notasListaFase3: null,
      },
    ];

    db.groupBy.mockResolvedValueOnce(courseRows);
    db.orderBy.mockResolvedValueOnce([
      {
        id: 'row-8ut',
        sourceInstitution: 'ead',
        aluno: 'Aluno Teste',
        curso: 'DISCIPLINA 8 UTS - D100-EAD',
        subcategoria: 'REGULARES',
        progressoListaFase1: courseRows[0].progressoListaFase1,
        progressoListaFase2: courseRows[0].progressoListaFase2,
        progressoListaFase3: courseRows[0].progressoListaFase3,
        lastaccess: '25/08/2026',
      },
    ]);

    const res = await service.getConsolidatedExportData(superAdminUser, {
      sourceInstitution: 'ead',
      unidades_tematicas: '8',
      tipo_turma: 'regular',
    });

    expect(db.groupBy).toHaveBeenCalledTimes(1);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      curso: 'DISCIPLINA 8 UTS - D100-EAD',
      tipoTurma: 'Regular',
      unidadesTematicas: 8,
    });
  });
});
