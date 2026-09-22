import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AVA_SYNC } from '../jobs.constants';
import { AvaSyncService } from '../../ava-sync/ava-sync.service';

interface AvaSyncJobData {
  institution?: string;
  type?: 'grades' | 'progress';
}

@Processor(QUEUE_AVA_SYNC, {
  concurrency: 2,
})
export class AvaSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AvaSyncProcessor.name);

  constructor(private readonly avaSyncService: AvaSyncService) {
    super();
  }

  async process(job: Job<AvaSyncJobData, any, string>): Promise<any> {
    const { institution, type } = job.data || {};
    this.logger.log(`Starting AVA Sync job (ID: ${job.id}, inst: ${institution || 'all'}, type: ${type || 'all'})`);

    await job.updateProgress({ progress: 5, step: 'Iniciando tarefas de sincronização do AVA...' });

    const allTasks = [
      { name: 'ead', type: 'grades', get: process.env.MOODLE_EAD_GRADES_GET_URL, att: process.env.MOODLE_EAD_GRADES_ATT_URL },
      { name: 'ead', type: 'progress', get: process.env.MOODLE_EAD_PROGRESS_GET_URL, att: process.env.MOODLE_EAD_PROGRESS_ATT_URL },
      { name: 'uni', type: 'grades', get: process.env.MOODLE_UNI_GRADES_GET_URL, att: process.env.MOODLE_UNI_GRADES_ATT_URL },
      { name: 'uni', type: 'progress', get: process.env.MOODLE_UNI_PROGRESS_GET_URL, att: process.env.MOODLE_UNI_PROGRESS_ATT_URL },
      { name: 'uniego', type: 'grades', get: process.env.MOODLE_UNIEGO_GRADES_GET_URL, att: process.env.MOODLE_UNIEGO_GRADES_ATT_URL },
      { name: 'uniego', type: 'progress', get: process.env.MOODLE_UNIEGO_PROGRESS_GET_URL, att: process.env.MOODLE_UNIEGO_PROGRESS_ATT_URL },
      { name: 'raizes', type: 'grades', get: process.env.MOODLE_RAIZES_GRADES_GET_URL, att: process.env.MOODLE_RAIZES_GRADES_ATT_URL },
      { name: 'raizes', type: 'progress', get: process.env.MOODLE_RAIZES_PROGRESS_GET_URL, att: process.env.MOODLE_RAIZES_PROGRESS_ATT_URL },
      { name: 'eefn', type: 'grades', get: process.env.MOODLE_EEFN_GRADES_GET_URL, att: process.env.MOODLE_EEFN_GRADES_ATT_URL },
      { name: 'eefn', type: 'progress', get: process.env.MOODLE_EEFN_PROGRESS_GET_URL, att: process.env.MOODLE_EEFN_PROGRESS_ATT_URL },
      { name: 'pos', type: 'grades', get: process.env.MOODLE_POS_GRADES_GET_URL, att: process.env.MOODLE_POS_GRADES_ATT_URL },
    ];

    let tasksToProcess = allTasks;
    if (institution) tasksToProcess = tasksToProcess.filter(t => t.name === institution.toLowerCase());
    if (type) tasksToProcess = tasksToProcess.filter(t => t.type === type.toLowerCase());

    if (tasksToProcess.length === 0) {
      throw new Error('Nenhuma tarefa de sincronização correspondente configurada.');
    }

    const results: any[] = [];
    const total = tasksToProcess.length;

    for (let i = 0; i < total; i++) {
      const task = tasksToProcess[i];
      const taskBaseProgress = Math.round((i / total) * 95);
      const taskWeight = Math.round(95 / total);

      const onProgress = async (subPercent: number, subStep: string) => {
        const overallProgress = Math.min(Math.round(taskBaseProgress + (subPercent / 100) * taskWeight), 98);
        await job.updateProgress({ progress: overallProgress, step: subStep });
        this.logger.log(`[Job ${job.id}] ${overallProgress}% - ${subStep}`);
      };

      const res = task.type === 'grades'
        ? await this.avaSyncService.syncGrades(task.name, task.get, task.att, onProgress)
        : await this.avaSyncService.syncProgress(task.name, task.get, task.att, onProgress);
      results.push(res);
    }

    const onlyErrors = results.filter(r => r.status === 'error');
    if (onlyErrors.length === results.length && results.length > 0) {
      const reasons = results.map(r => `${r.source}: ${r.reason || r.status}`).join('; ');
      throw new Error(`Falha na sincronização: ${reasons}`);
    }

    const hasQueued = results.some(r => r.status === 'queued');
    await job.updateProgress({ progress: 100, step: hasQueued ? 'Sincronização solicitada / em fila no Moodle' : 'Sincronização concluída com sucesso' });
    this.logger.log(`Completed AVA Sync job (ID: ${job.id})`);

    return {
      success: true,
      queued: hasQueued,
      results,
    };
  }
}
