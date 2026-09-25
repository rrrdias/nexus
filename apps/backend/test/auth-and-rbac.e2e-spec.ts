import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { DB_CONNECTION } from '../src/db/db.provider';
import { CacheService } from '../src/cache/cache.service';
import { JobsService } from '../src/jobs/jobs.service';

describe('Auth & RBAC (e2e)', () => {
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
    wrap: jest.fn().mockImplementation((key, fn) => fn()),
  };

  const mockJobsService = {
    checkRedisHealth: jest
      .fn()
      .mockResolvedValue({ status: 'up', latencyMs: 2 }),
    addAcademicSyncJob: jest
      .fn()
      .mockResolvedValue({ jobId: 'job-academic-123', queue: 'academic-sync' }),
    addAvaSyncJob: jest
      .fn()
      .mockResolvedValue({ jobId: 'job-ava-123', queue: 'ava-sync' }),
    getJobStatus: jest
      .fn()
      .mockResolvedValue({ id: 'job-123', state: 'completed', progress: 100 }),
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

  it('GET /api/health - deve ser acessível publicamente sem token (200 OK)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('services');
  });

  it('GET /api/users - deve bloquear requisição não autenticada (401 Unauthorized)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 401,
      error: 'UnauthorizedException',
    });
  });

  it('GET /api/academic/discentes - deve bloquear usuário sem permissão no módulo (403 Forbidden)', async () => {
    const token = jwtService.sign({
      sub: 'user-regular-id',
      email: 'regular@unievangelica.edu.br',
      isSuperAdmin: false,
    });

    const response = await request(app.getHttpServer())
      .get('/api/academic/discentes')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 403,
      error: 'Forbidden',
    });
  });

  it('GET /api/academic/discentes - deve permitir acesso quando usuário é Super Admin (200 OK)', async () => {
    const token = jwtService.sign({
      sub: 'user-admin-id',
      email: 'admin@unievangelica.edu.br',
      isSuperAdmin: true,
    });

    const response = await request(app.getHttpServer())
      .get('/api/academic/discentes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });
});
