import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
import { AvaReportsService } from './ava-reports.service';
import { JobsService } from '../jobs/jobs.service';
import { RequireAdmin, RequireModule } from '../auth/rbac.decorators';
import { ReportQueryDto, ExportReportDto } from './dto/report-query.dto';
import { SyncMoodleDto } from './dto/sync-moodle.dto';

@RequireModule('ava')
@Controller('api/ava-reports')
export class AvaReportsController {
  constructor(
    private readonly avaReportsService: AvaReportsService,
    private readonly jobsService: JobsService,
  ) {}

  @Post('progress')
  async getProgressData(@Req() req: any, @Body() dto: ReportQueryDto) {
    return this.avaReportsService.getProgressData(
      req.user,
      dto.page ?? 1,
      dto.size ?? 15,
      dto.filters || {},
    );
  }

  @Post('progress/export')
  async getProgressExportData(@Req() req: any, @Body() dto: ExportReportDto) {
    return this.avaReportsService.getProgressExportData(
      req.user,
      dto.filters || {},
    );
  }

  @RequireAdmin()
  @Post('sync')
  async syncMoodleData(
    @Req() req: any,
    @Body() dto: SyncMoodleDto,
    @Query('async') isAsync?: string,
  ) {
    if (isAsync === 'false') {
      return this.avaReportsService.syncMoodleData(
        req.user,
        dto.institution,
        dto.type,
      );
    }
    const { jobId, queue } = await this.jobsService.addAvaSyncJob({
      institution: dto.institution,
      type: dto.type,
    });
    return {
      success: true,
      queued: true,
      jobId,
      queue,
      message: 'Sincronização AVA enfileirada com sucesso.',
    };
  }

  @Post('grades')
  async getGradesData(@Req() req: any, @Body() dto: ReportQueryDto) {
    return this.avaReportsService.getGradesData(
      req.user,
      dto.page ?? 1,
      dto.size ?? 15,
      dto.filters || {},
    );
  }

  @Post('grades/export')
  async exportGradesData(@Req() req: any, @Body() dto: ExportReportDto) {
    return this.avaReportsService.exportGradesData(req.user, dto.filters || {});
  }

  @Post('consolidated')
  async getConsolidatedData(@Req() req: any, @Body() dto: ReportQueryDto) {
    return this.avaReportsService.getConsolidatedData(
      req.user,
      dto.page ?? 1,
      dto.size ?? 15,
      dto.filters || {},
    );
  }

  @Post('consolidated/export')
  async exportConsolidatedData(@Req() req: any, @Body() dto: ExportReportDto) {
    return this.avaReportsService.getConsolidatedExportData(
      req.user,
      dto.filters || {},
    );
  }

  @Get('dashboard-stats')
  async getDashboardStats(@Req() req: any) {
    return this.avaReportsService.getAvaDashboardStats(req.user);
  }
}
