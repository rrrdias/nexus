import { AvaReportsService } from './ava-reports.service';

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
    service = new AvaReportsService(db);
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
    expect(stats.institutionsStats.find(i => i.id === 'ead')?.status).toBe('success');
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

    const result = await service.getProgressData(superAdminUser, 1, 15, { sourceInstitution: 'ead' });

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

    db.where
      .mockResolvedValueOnce([{ count: 1200 }])
      .mockReturnValueOnce(db)
      .mockResolvedValueOnce([
        {
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

    const result = await service.getConsolidatedData(superAdminUser, 1, 15, { sourceInstitution: 'ead' });

    expect(result.total_records).toBe(1200);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].progressoFase1).toBe('100');
    expect(result.data[0].notaFase1).toBe('9.0');
    expect(result.data[0].mediaFinal).toBe('8.1');
    expect(result.average_progress).toBe(77);
    expect(result.average_grade).toBe(81);
  });
});

