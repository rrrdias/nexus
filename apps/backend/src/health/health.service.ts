import { Injectable, Inject, Optional } from '@nestjs/common';
import { DB_CONNECTION } from '../db/db.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { JobsService } from '../jobs/jobs.service';
import { AcademicService } from '../academic/academic.service';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  nodeVersion: string;
  memory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
  services: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
      message?: string;
    };
    redis: {
      status: 'up' | 'down';
      latencyMs?: number;
      message?: string;
    };
    lyceum: {
      status: 'up' | 'down';
      latencyMs?: number;
      message?: string;
    };
  };
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: PostgresJsDatabase<any>,
    @Optional() private readonly jobsService?: JobsService,
    @Optional() private readonly academicService?: AcademicService,
  ) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const mem = process.memoryUsage();
    const memory = {
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
    };

    // 1. PostgreSQL Check
    let dbStatus: { status: 'up' | 'down'; latencyMs?: number; message?: string } = { status: 'down' };
    const dbStart = Date.now();
    try {
      await this.db.execute(sql`SELECT 1`);
      dbStatus = {
        status: 'up',
        latencyMs: Date.now() - dbStart,
      };
    } catch (err: any) {
      dbStatus = {
        status: 'down',
        message: err.message || 'Falha ao conectar no PostgreSQL.',
      };
    }

    // 2. Redis Check
    let redisStatus: { status: 'up' | 'down'; latencyMs?: number; message?: string } = {
      status: 'down',
      message: 'Módulo Jobs/Redis não configurado.',
    };
    if (this.jobsService) {
      redisStatus = await this.jobsService.checkRedisHealth();
    }

    // 3. Lyceum Check
    let lyceumStatus: { status: 'up' | 'down'; latencyMs?: number; message?: string } = {
      status: 'down',
      message: 'Módulo Acadêmico/Lyceum não inicializado.',
    };
    if (this.academicService) {
      lyceumStatus = await this.academicService.checkLyceumHealth();
    }

    // Determine overall status
    // Database (PostgreSQL) is the critical dependency
    let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';
    if (dbStatus.status === 'down') {
      overallStatus = 'error';
    } else if (redisStatus.status === 'down' || lyceumStatus.status === 'down') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      memory,
      services: {
        database: dbStatus,
        redis: redisStatus,
        lyceum: lyceumStatus,
      },
    };
  }
}
