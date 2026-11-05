import { Test, TestingModule } from '@nestjs/testing';
import { TutoriaService } from './tutoria.service';
import { TutoriaSyncService } from './tutoria-sync.service';
import { DB_CONNECTION } from '../db/db.provider';
import { CacheService } from '../cache/cache.service';

describe('TutoriaService', () => {
  let service: TutoriaService;
  let mockDb: any;
  let mockSyncService: any;
  let mockCache: any;

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn().mockImplementation((query) => {
        return Promise.resolve([
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
        ]);
      }),
    };

    mockSyncService = {
      syncTutoriaLogs: jest.fn().mockResolvedValue({ status: 'success', records: 150 }),
      getSyncStatus: jest.fn().mockReturnValue({ isSyncing: false, status: 'idle' }),
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
  });

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
});
