import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DB_CONNECTION } from '../src/db/db.provider';
import { CacheService } from '../src/cache/cache.service';
import { JobsService } from '../src/jobs/jobs.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  const mockDb = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ isActive: true }]),
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              offset: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        orderBy: jest.fn().mockResolvedValue([]),
        limit: jest.fn().mockResolvedValue([]),
      }),
    }),
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
    checkRedisHealth: jest.fn().mockResolvedValue({ status: 'up', latencyMs: 2 }),
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});

