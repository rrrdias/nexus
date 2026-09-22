import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_ACADEMIC_SYNC, JOB_ACADEMIC_SYNC } from '../jobs.constants';
import { AcademicSyncService } from '../../academic/academic-sync.service';

@Processor(QUEUE_ACADEMIC_SYNC, {
  concurrency: 1,
})
export class AcademicSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AcademicSyncProcessor.name);

  constructor(private readonly academicSyncService: AcademicSyncService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Starting job ${job.name} (ID: ${job.id})`);

    await job.updateProgress(0);

    const onProgress = async (progress: number, step: string) => {
      await job.updateProgress({ progress, step });
      this.logger.log(`[Job ${job.id}] ${progress}% - ${step}`);
    };

    const result = await this.academicSyncService.syncActivePeriods(onProgress);

    if (result && result.status === 'error') {
      throw new Error(result.error || 'Erro na sincronização do Lyceum');
    }

    await job.updateProgress({ progress: 100, step: 'Sincronização concluída com sucesso' });
    this.logger.log(`Completed job ${job.name} (ID: ${job.id})`);
    return result;
  }
}
