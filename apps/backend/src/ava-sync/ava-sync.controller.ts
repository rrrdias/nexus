import { Controller, Get, Query, Req, Res, HttpStatus } from '@nestjs/common';
import { AvaSyncService } from './ava-sync.service';
import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';

@Controller('api/ava-sync')
export class AvaSyncController {
  constructor(private readonly avaSyncService: AvaSyncService) {}

  @Get()
  async handleSync(
    @Query('institution') institutionQuery: string,
    @Query('type') typeQuery: string,
    @Req() request: Request,
    @Res() response: Response
  ) {
    const institution = institutionQuery?.toLowerCase();
    const type = typeQuery?.toLowerCase();

    const authHeader = request.headers['authorization'];
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: "CRON_SECRET is not configured" });
    }

    if (!this.isAuthorized(authHeader, secret)) {
      return response.status(HttpStatus.UNAUTHORIZED).json({ error: "Unauthorized" });
    }

    try {
      const results: any[] = [];
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
      if (institution) tasksToProcess = tasksToProcess.filter(t => t.name === institution);
      if (type) tasksToProcess = tasksToProcess.filter(t => t.type === type);

      if (tasksToProcess.length === 0) {
        return response.status(HttpStatus.NOT_FOUND).json({ success: false, error: "Nenhuma tarefa de sincronização encontrada." });
      }

      for (const task of tasksToProcess) {
        const res = task.type === 'grades'
          ? await this.avaSyncService.syncGrades(task.name, task.get, task.att)
          : await this.avaSyncService.syncProgress(task.name, task.get, task.att);
        results.push(res);
      }

      return response.status(HttpStatus.OK).json({ success: true, results });
    } catch (error: any) {
      console.error("Erro no sync global do Moodle:", error);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
    }
  }

  private isAuthorized(authHeader: string | undefined, secret: string): boolean {
    const expected = `Bearer ${secret}`;
    if (!authHeader) return false;

    const actualBuffer = Buffer.from(authHeader);
    const expectedBuffer = Buffer.from(expected);

    if (actualBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(actualBuffer, expectedBuffer);
  }
}
