import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DB_CONNECTION } from '../src/db/db.provider';
import { CacheService } from '../src/cache/cache.service';
import { JobsService } from '../src/jobs/jobs.service';
import { AcademicService } from '../src/academic/academic.service';

describe('Observability & Health (e2e)', () => {
  let app: INestApplication;

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
      .mockResolvedValue({ jobId: 'job-1', queue: 'academic-sync' }),
    addAvaSyncJob: jest
      .fn()
      .mockResolvedValue({ jobId: 'job-2', queue: 'ava-sync' }),
    getJobStatus: jest
      .fn()
      .mockResolvedValue({ id: 'job-1', state: 'completed', progress: 100 }),
  };

  const mockAcademicService = {
    checkLyceumHealth: jest
      .fn()
      .mockResolvedValue({ status: 'up', latencyMs: 5 }),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
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
      .overrideProvider(AcademicService)
      .useValue(mockAcademicService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health - deve retornar status ok com verificação dos serviços (database, redis, lyceum)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      services: {
        database: { status: 'up' },
        redis: { status: 'up' },
        lyceum: { status: 'up' },
      },
    });
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptimeSeconds');
  });

  it('Headers - deve propagar o header X-Request-Id nas respostas', async () => {
    const customRequestId = 'test-req-id-uuid-1234';

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', customRequestId)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(customRequestId);
  });

  it('Headers - deve gerar um X-Request-Id automaticamente quando não fornecido', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(typeof response.headers['x-request-id']).toBe('string');
  });

  it('GlobalExceptionFilter - deve formatar exceções com envelope padronizado contendo requestId', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 401,
      error: 'UnauthorizedException',
      path: '/api/users',
    });
    expect(response.body).toHaveProperty('requestId');
    expect(response.body).toHaveProperty('timestamp');
  });
});
