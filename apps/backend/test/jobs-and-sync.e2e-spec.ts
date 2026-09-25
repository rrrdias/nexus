import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { DB_CONNECTION } from '../src/db/db.provider';
import { CacheService } from '../src/cache/cache.service';
import { JobsService } from '../src/jobs/jobs.service';

describe('Jobs & Async Sync (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const createChain = (
    defaultResult: any = [{ id: 'test-id', isActive: true }],
  ) => {
    const chain: any = {
      from: jest.fn().mockImplementation(() => chain),
      innerJoin: jest.fn().mockImplementation(() => chain),
      leftJoin: jest.fn().mockImplementation(() => chain),
      where: jest.fn().mockImplementation(() => chain),
      orderBy: jest.fn().mockImplementation(() => chain),
      groupBy: jest.fn().mockImplementation(() => chain),
      limit: jest.fn().mockImplementation(() => chain),
      offset: jest.fn().mockImplementation(() => chain),
      values: jest.fn().mockImplementation(() => chain),
      set: jest.fn().mockImplementation(() => chain),
      returning: jest.fn().mockImplementation(() => chain),
      onConflictDoNothing: jest.fn().mockImplementation(() => chain),
      onConflictDoUpdate: jest.fn().mockImplementation(() => chain),
      then: (resolve: any) => Promise.resolve(defaultResult).then(resolve),
    };
    return chain;
  };

  const mockDb = {
    select: jest.fn().mockImplementation(() => createChain()),
    insert: jest.fn().mockImplementation(() => createChain()),
    update: jest.fn().mockImplementation(() => createChain()),
    delete: jest.fn().mockImplementation(() => createChain()),
    execute: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
    wrap: jest.fn().mockImplementation((key: string, fn: any) => fn()),
  };

  const mockJobsService = {
    checkRedisHealth: jest
      .fn()
      .mockResolvedValue({ status: 'up', latencyMs: 2 }),
    addAcademicSyncJob: jest
      .fn()
      .mockResolvedValue({ jobId: 'academic-job-456', queue: 'academic-sync' }),
    addAvaSyncJob: jest
      .fn()
      .mockResolvedValue({ jobId: 'ava-job-789', queue: 'ava-sync' }),
    getJobStatus: jest.fn().mockImplementation((queue: string, id: string) => {
      return Promise.resolve({
        id,
        state: 'active',
        progress: 45,
        result: null,
        failedReason: null,
      });
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DB_CONNECTION)
      .useValue(mockDb)
      .overrideProvider(CacheService)
      .useValue(mockCacheService)
      .overrideProvider(JobsService)
      .useValue(mockJobsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/academic/sync - deve enfileirar job de sincronização acadêmica', async () => {
    const token = jwtService.sign({
      sub: 'admin-id',
      email: 'admin@unievangelica.edu.br',
      isSuperAdmin: true,
    });

    const response = await request(app.getHttpServer())
      .post('/api/academic/sync')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      queued: true,
      jobId: 'academic-job-456',
      queue: 'academic-sync',
      message: 'Sincronização do Lyceum enfileirada com sucesso.',
    });
    expect(mockJobsService.addAcademicSyncJob).toHaveBeenCalled();
  });

  it('POST /api/ava-reports/sync - deve enfileirar job de sincronização do AVA Moodle', async () => {
    const token = jwtService.sign({
      sub: 'admin-id',
      email: 'admin@unievangelica.edu.br',
      isSuperAdmin: true,
    });

    const response = await request(app.getHttpServer())
      .post('/api/ava-reports/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        institution: 'anapolis',
        type: 'grades',
      })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      queued: true,
      jobId: 'ava-job-789',
      queue: 'ava-sync',
      message: 'Sincronização AVA enfileirada com sucesso.',
    });
    expect(mockJobsService.addAvaSyncJob).toHaveBeenCalledWith({
      institution: 'anapolis',
      type: 'grades',
    });
  });

  it('GET /api/jobs/:queue/:id/status - deve consultar status e progresso do job', async () => {
    const token = jwtService.sign({
      sub: 'admin-id',
      email: 'admin@unievangelica.edu.br',
      isSuperAdmin: true,
    });

    const response = await request(app.getHttpServer())
      .get('/api/jobs/ava-sync/ava-job-789/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      id: 'ava-job-789',
      state: 'active',
      progress: 45,
      result: null,
      failedReason: null,
    });
    expect(mockJobsService.getJobStatus).toHaveBeenCalledWith(
      'ava-sync',
      'ava-job-789',
    );
  });
});
