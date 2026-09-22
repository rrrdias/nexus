import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { DB_CONNECTION } from '../db/db.provider';
import { JobsService } from '../jobs/jobs.service';
import { AcademicService } from '../academic/academic.service';

describe('HealthService', () => {
  let service: HealthService;
  let mockDb: any;
  let mockJobsService: any;
  let mockAcademicService: any;

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    mockJobsService = {
      checkRedisHealth: jest.fn().mockResolvedValue({ status: 'up', latencyMs: 2 }),
    };
    mockAcademicService = {
      checkLyceumHealth: jest.fn().mockResolvedValue({ status: 'up', latencyMs: 5 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DB_CONNECTION, useValue: mockDb },
        { provide: JobsService, useValue: mockJobsService },
        { provide: AcademicService, useValue: mockAcademicService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should return ok when database, redis and lyceum are up', async () => {
    const res = await service.checkHealth();

    expect(res.status).toBe('ok');
    expect(res.services.database.status).toBe('up');
    expect(res.services.redis.status).toBe('up');
    expect(res.services.lyceum.status).toBe('up');
    expect(res.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.memory.heapUsedMb).toBeGreaterThan(0);
  });

  it('should return error status when database is down', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await service.checkHealth();

    expect(res.status).toBe('error');
    expect(res.services.database.status).toBe('down');
  });

  it('should return degraded status when redis or lyceum is down but database is up', async () => {
    mockJobsService.checkRedisHealth.mockResolvedValueOnce({ status: 'down', message: 'Redis down' });

    const res = await service.checkHealth();

    expect(res.status).toBe('degraded');
    expect(res.services.database.status).toBe('up');
    expect(res.services.redis.status).toBe('down');
  });
});
