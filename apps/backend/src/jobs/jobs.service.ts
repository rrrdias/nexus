import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { QUEUE_ACADEMIC_SYNC, QUEUE_AVA_SYNC, JOB_ACADEMIC_SYNC, JOB_AVA_SYNC } from './jobs.constants';

export interface JobStatusResponse {
  id: string;
  queue: string;
  name: string;
  state: string;
  progress: number;
  step?: string;
  data: any;
  result?: any;
  failedReason?: string;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(QUEUE_ACADEMIC_SYNC) private readonly academicQueue: Queue,
    @InjectQueue(QUEUE_AVA_SYNC) private readonly avaQueue: Queue,
  ) {}

  private getQueue(queueName: string): Queue {
    if (queueName === QUEUE_ACADEMIC_SYNC) return this.academicQueue;
    if (queueName === QUEUE_AVA_SYNC) return this.avaQueue;
    throw new NotFoundException(`Fila "${queueName}" não encontrada.`);
  }

  async addAcademicSyncJob(): Promise<{ jobId: string; queue: string }> {
    // Check if an active or waiting job already exists to avoid duplicate simultaneous syncs
    const activeJobs = await this.academicQueue.getActive();
    const waitingJobs = await this.academicQueue.getWaiting();
    
    const existingJob = [...activeJobs, ...waitingJobs][0];
    if (existingJob) {
      this.logger.log(`Reutilizando job de sincronização acadêmica já em andamento (${existingJob.id})`);
      return { jobId: existingJob.id as string, queue: QUEUE_ACADEMIC_SYNC };
    }

    const job = await this.academicQueue.add(
      JOB_ACADEMIC_SYNC,
      {},
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 50,
          age: 86400,
        },
        removeOnFail: {
          count: 100,
        },
      }
    );

    this.logger.log(`Novo job de sincronização acadêmica enfileirado: ${job.id}`);
    return { jobId: job.id as string, queue: QUEUE_ACADEMIC_SYNC };
  }

  async addAvaSyncJob(data: { institution?: string; type?: 'grades' | 'progress' }): Promise<{ jobId: string; queue: string }> {
    const job = await this.avaQueue.add(
      JOB_AVA_SYNC,
      data,
      {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: {
          count: 50,
          age: 86400,
        },
        removeOnFail: {
          count: 100,
        },
      }
    );

    this.logger.log(`Novo job de sincronização AVA enfileirado: ${job.id}`);
    return { jobId: job.id as string, queue: QUEUE_AVA_SYNC };
  }

  async getJobStatus(queueName: string, jobId: string): Promise<JobStatusResponse> {
    const queue = this.getQueue(queueName);
    const job: Job | undefined = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job "${jobId}" não encontrado na fila "${queueName}".`);
    }

    const state = await job.getState();
    const rawProgress = job.progress;

    let progressNum = 0;
    let stepText: string | undefined = undefined;

    if (typeof rawProgress === 'number') {
      progressNum = rawProgress;
    } else if (rawProgress && typeof rawProgress === 'object') {
      progressNum = (rawProgress as any).progress ?? 0;
      stepText = (rawProgress as any).step;
    }

    if (state === 'completed') {
      progressNum = 100;
    }

    return {
      id: job.id as string,
      queue: queueName,
      name: job.name,
      state,
      progress: progressNum,
      step: stepText,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
    };
  }

  async checkRedisHealth(): Promise<{ status: 'up' | 'down'; latencyMs?: number; message?: string }> {
    const start = Date.now();
    try {
      await this.academicQueue.count();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: 'down', message: err.message };
    }
  }
}
