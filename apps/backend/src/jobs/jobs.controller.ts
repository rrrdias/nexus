import { Controller, Get, Param } from '@nestjs/common';
import { JobsService, JobStatusResponse } from './jobs.service';
import { RequireModule } from '../auth/rbac.decorators';

@RequireModule('academic', 'ava')
@Controller('api/jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get(':queue/:id/status')
  async getStatus(
    @Param('queue') queue: string,
    @Param('id') id: string,
  ): Promise<JobStatusResponse> {
    return this.jobsService.getJobStatus(queue, id);
  }
}
