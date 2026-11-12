import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { TutoriaService } from './tutoria.service';
import { EngagementFilterDto } from './dto/engagement-filter.dto';
import { KanbanFilterDto } from './dto/kanban-filter.dto';
import { CreateKanbanCardDto } from './dto/create-kanban-card.dto';
import { UpdateKanbanCardDto } from './dto/update-kanban-card.dto';
import { CreateIntervencaoDto } from './dto/create-intervencao.dto';
import { TransferirTutorDto } from './dto/transferir-tutor.dto';
import { SendTutoriaEmailDto } from './dto/send-tutoria-email.dto';
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

  @Get('aluno/:matricula/lookup')
  async lookupStudent(
    @Param('matricula') matricula: string,
    @Query('periodo') periodo?: string,
    @Query('institution') institution?: string,
  ) {
    return this.tutoriaService.lookupStudentByMatricula(
      matricula,
      periodo || '2026-2',
      institution || 'ead',
    );
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

  // F7: Lista de Tutores Ativos
  @Get('tutores')
  async getActiveTutors(): Promise<any> {
    return this.tutoriaService.getTutoresAtivos();
  }

  // F6: Linha do Tempo Consolidada do Discente
  @Get('aluno/:matricula/timeline')
  async getStudentTimeline(
    @Param('matricula') matricula: string,
    @Query('atendimentoId') atendimentoId?: string,
  ): Promise<any> {
    return this.tutoriaService.getTimelineAluno(matricula, atendimentoId);
  }

  // F1, F2, F4: Registro de Intervenção Manual ou Multicanal
  @Post('intervencoes')
  @HttpCode(HttpStatus.CREATED)
  async createIntervencao(
    @Body() dto: CreateIntervencaoDto,
    @Req() req: any,
  ): Promise<any> {
    const autorId = req.user?.id;
    const autorNomeFallback = req.user?.name;
    return this.tutoriaService.registrarIntervencao(
      dto,
      autorId,
      autorNomeFallback,
    );
  }

  // F5: Passagem de Bastão (Transferência de Tutor Titular)
  @Post('kanban/:id/transferir')
  @HttpCode(HttpStatus.OK)
  async transferirTutor(
    @Param('id') id: string,
    @Body() dto: TransferirTutorDto,
    @Req() req: any,
  ): Promise<any> {
    const autorId = req.user?.id;
    const autorNomeFallback = req.user?.name;
    return this.tutoriaService.transferirTutor(
      id,
      dto,
      autorId,
      autorNomeFallback,
    );
  }

  // Kanban de Atendimentos
  @Get('kanban')
  async getKanbanCards(@Query() query: KanbanFilterDto): Promise<any> {
    return this.tutoriaService.getKanbanCards(query);
  }

  @Post('kanban')
  async createKanbanCard(
    @Body() dto: CreateKanbanCardDto,
    @Req() req: any,
  ): Promise<any> {
    const tutorId = req.user?.id;
    return this.tutoriaService.createKanbanCard(dto, tutorId);
  }

  @Patch('kanban/:id')
  async updateKanbanCard(
    @Param('id') id: string,
    @Body() dto: UpdateKanbanCardDto,
    @Req() req: any,
  ): Promise<any> {
    const autorId = req.user?.id;
    const autorNomeFallback = req.user?.name;
    return this.tutoriaService.updateKanbanCard(
      id,
      dto,
      autorId,
      autorNomeFallback,
    );
  }

  @Delete('kanban/:id')
  async deleteKanbanCard(@Param('id') id: string): Promise<any> {
    return this.tutoriaService.deleteKanbanCard(id);
  }

  @Post('enviar-email')
  async enviarEmailPedagogico(
    @Body() dto: SendTutoriaEmailDto,
    @Req() req: any,
  ): Promise<any> {
    return this.tutoriaService.enviarEmailPedagogico(dto, req.user);
  }
}
