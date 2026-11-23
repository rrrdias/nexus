import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequireModule } from '../auth/rbac.decorators';
import { TutoriaTeologiaService } from './tutoria-teologia.service';
import { TeologiaEngagementFilterDto } from './dto/teologia-engagement-filter.dto';

@RequireModule('tutoria-teologia')
@Controller('api/tutoria/teologia')
export class TutoriaTeologiaController {
  constructor(private readonly teologiaService: TutoriaTeologiaService) {}

  @Get('summary')
  async getDashboardSummary(
    @Query('periodo') periodo?: string,
    @Query('institution') institution?: string,
  ) {
    return this.teologiaService.getTeologiaDashboardSummary(
      periodo || '2026-2',
      institution || 'ead',
    );
  }

  @Get('engajamento')
  async getEngagementList(@Query() query: TeologiaEngagementFilterDto) {
    return this.teologiaService.getTeologiaEngagementList(query);
  }

  @Get('disciplinas')
  async getDisciplinas(
    @Query('periodo') periodo?: string,
    @Query('institution') institution?: string,
  ) {
    return this.teologiaService.getTeologiaDisciplinas(
      periodo || '2026-2',
      institution || 'ead',
    );
  }

  @Get('exportar')
  async getExportData(@Query() query: TeologiaEngagementFilterDto) {
    return this.teologiaService.getTeologiaExportData(query);
  }

  @Get('aluno/:matricula/logs')
  async getStudentLogs(
    @Param('matricula') matricula: string,
    @Query('disciplinaId') disciplinaId?: string,
    @Query('institution') institution?: string,
  ) {
    return this.teologiaService.getTeologiaStudentActivityLogs(
      matricula,
      disciplinaId,
      institution || 'ead',
    );
  }
}
