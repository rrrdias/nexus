import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TutoriaService } from './tutoria.service';
import { EngagementFilterDto } from './dto/engagement-filter.dto';
import { RequireModule, RequireAdmin } from '../auth/rbac.decorators';

@RequireModule('tutoria')
@Controller('api/tutoria')
export class TutoriaController {
  constructor(private readonly tutoriaService: TutoriaService) {}

  @Get('summary')
  async getDashboardSummary(
    @Query('periodo') periodo?: string,
    @Query('institution') institution?: string,
  ) {
    return this.tutoriaService.getDashboardSummary(
      periodo || '2026-2',
      institution || 'ead',
    );
  }

  @Get('engajamento')
  async getEngagementList(@Query() query: EngagementFilterDto) {
    return this.tutoriaService.getEngagementList(query);
  }

  @Get('disciplinas')
  async getDisciplinas(
    @Query('periodo') periodo?: string,
    @Query('institution') institution?: string,
  ) {
    return this.tutoriaService.getDisciplinas(
      periodo || '2026-2',
      institution || 'ead',
    );
  }

  @Get('exportar')
  async getExportData(@Query() query: EngagementFilterDto) {
    return this.tutoriaService.getExportData(query);
  }

  @Get('aluno/:matricula/logs')
  async getStudentLogs(
    @Param('matricula') matricula: string,
    @Query('disciplinaId') disciplinaId?: string,
  ) {
    return this.tutoriaService.getStudentActivityLogs(matricula, disciplinaId);
  }

  @Get('sync/status')
  async getSyncStatus() {
    return this.tutoriaService.getSyncStatus();
  }

  @RequireAdmin()
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async triggerSync(@Body('institution') institution?: string) {
    return this.tutoriaService.triggerManualSync(institution || 'ead');
  }
}
