import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  JOB_ACADEMIC_GRADES_CORRELATE,
  JOB_ACADEMIC_GRADES_MIRROR,
  QUEUE_ACADEMIC_SYNC,
} from '../jobs.constants';
import { AcademicSyncService } from '../../academic/academic-sync.service';
import { AcademicGradesMirrorService } from '../../academic/grades/academic-grades-mirror.service';
import { AcademicGradesSearchService } from '../../academic/grades/academic-grades-search.service';

@Processor(QUEUE_ACADEMIC_SYNC, {
  concurrency: 1,
})
export class AcademicSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AcademicSyncProcessor.name);

  constructor(
    private readonly academicSyncService: AcademicSyncService,
    @Optional()
    private readonly gradesMirrorService?: AcademicGradesMirrorService,
    @Optional()
    private readonly gradesSearchService?: AcademicGradesSearchService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Starting job ${job.name} (ID: ${job.id})`);

    await job.updateProgress(0);

    const onProgress = async (progress: number, step: string) => {
      await job.updateProgress({ progress, step });
      this.logger.log(`[Job ${job.id}] ${progress}% - ${step}`);
    };

    if (job.name === JOB_ACADEMIC_GRADES_MIRROR) {
      if (!this.gradesMirrorService) {
        throw new Error(
          'AcademicGradesMirrorService não disponível no worker.',
        );
      }
      const mirrorResult = await this.gradesMirrorService.syncMirror100Online(
        job.data?.periodo,
        async (pct, step) => {
          const scaled =
            job.data?.correlateAfter === false ? pct : Math.round(pct * 0.6);
          await onProgress(scaled, step);
        },
      );

      let correlationResult: any = null;
      if (job.data?.correlateAfter !== false && this.gradesSearchService) {
        correlationResult =
          await this.gradesSearchService.correlateAllOnlineTurmas(
            job.data?.periodo,
            async (pct, step) => {
              const scaled = 60 + Math.round(pct * 0.4);
              await onProgress(scaled, step);
            },
          );
      }

      await job.updateProgress({
        progress: 100,
        step: 'Espelhamento de notas 100% online concluído',
      });
      return { mirror: mirrorResult, correlation: correlationResult };
    }

    if (job.name === JOB_ACADEMIC_GRADES_CORRELATE) {
      if (!this.gradesSearchService) {
        throw new Error(
          'AcademicGradesSearchService não disponível no worker.',
        );
      }
      const result = job.data?.turmaId
        ? await this.gradesSearchService.correlateGradesForTurma(
            job.data.turmaId,
          )
        : await this.gradesSearchService.correlateAllOnlineTurmas(
            job.data?.periodo,
            onProgress,
          );

      await job.updateProgress({
        progress: 100,
        step: 'Correlação de notas concluída com sucesso',
      });
      return result;
    }

    const result = await this.academicSyncService.syncActivePeriods(onProgress);

    if (result && result.status === 'error') {
      throw new Error(result.error || 'Erro na sincronização do Lyceum');
    }

    await job.updateProgress({
      progress: 100,
      step: 'Sincronização concluída com sucesso',
    });
    this.logger.log(`Completed job ${job.name} (ID: ${job.id})`);
    return result;
  }
}
