import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
import { AvaReportsService } from './ava-reports.service';
import { Request } from 'express';

@Controller('api/ava-reports')
export class AvaReportsController {
  constructor(private readonly avaReportsService: AvaReportsService) {}

  @Post('progress')
  async getProgressData(
    @Req() req: any,
    @Body('page') page: number,
    @Body('size') size: number,
    @Body('filters') filters: any
  ) {
    return this.avaReportsService.getProgressData(req.user, page, size, filters || {});
  }

  @Post('progress/export')
  async getProgressExportData(
    @Req() req: any,
    @Body('filters') filters: any
  ) {
    return this.avaReportsService.getProgressExportData(req.user, filters || {});
  }

  @Post('sync')
  async syncMoodleData(
    @Req() req: any,
    @Body('institution') institution?: string,
    @Body('type') type?: 'grades' | 'progress'
  ) {
    return this.avaReportsService.syncMoodleData(req.user, institution, type);
  }

  @Post('grades')
  async getGradesData(
    @Req() req: any,
    @Body('page') page: number,
    @Body('size') size: number,
    @Body('filters') filters: any
  ) {
    return this.avaReportsService.getGradesData(req.user, page, size, filters || {});
  }

  @Post('grades/export')
  async exportGradesData(
    @Req() req: any,
    @Body('filters') filters: any
  ) {
    return this.avaReportsService.exportGradesData(req.user, filters || {});
  }

  @Post('consolidated')
  async getConsolidatedData(
    @Req() req: any,
    @Body('page') page: number,
    @Body('size') size: number,
    @Body('filters') filters: any
  ) {
    return this.avaReportsService.getConsolidatedData(req.user, page, size, filters || {});
  }

  @Post('consolidated/export')
  async exportConsolidatedData(
    @Req() req: any,
    @Body('filters') filters: any
  ) {
    return this.avaReportsService.getConsolidatedExportData(req.user, filters || {});
  }

  @Get('dashboard-stats')
  async getDashboardStats(@Req() req: any) {
    return this.avaReportsService.getAvaDashboardStats(req.user);
  }
}

