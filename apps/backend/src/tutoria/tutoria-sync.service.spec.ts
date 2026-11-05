import { Test, TestingModule } from '@nestjs/testing';
import { TutoriaSyncService } from './tutoria-sync.service';
import { DB_CONNECTION } from '../db/db.provider';
import { CacheService } from '../cache/cache.service';

describe('TutoriaSyncService', () => {
  let service: TutoriaSyncService;
  let mockDb: any;
  let mockCache: any;

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    mockCache = {
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutoriaSyncService,
        {
          provide: DB_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: CacheService,
          useValue: mockCache,
        },
      ],
    }).compile();

    service = module.get<TutoriaSyncService>(TutoriaSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should report idle status initially', () => {
    const status = service.getSyncStatus();
    expect(status.status).toBe('idle');
    expect(status.isSyncing).toBe(false);
  });

  it('should trigger moodle update successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const result = await service.triggerMoodleUpdate('ead', 'http://moodle-test.com/att');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('http://moodle-test.com/att', { cache: 'no-store' });
  });

  it('should handle moodle update network failure gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection timeout'));

    const result = await service.triggerMoodleUpdate('ead', 'http://moodle-test.com/att');
    expect(result).toBe(false);
  });
});
