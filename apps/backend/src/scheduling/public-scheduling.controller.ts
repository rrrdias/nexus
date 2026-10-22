import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SchedulingService } from './scheduling.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Public()
@Controller('api/public/scheduling')
export class PublicSchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  /**
   * Endpoint público para o fluxo do estudante:
   * Retorna dados do aluno, elegibilidade, agendamento ativo e lista de polos.
   */
  @Get('student-flow')
  async getStudentFlow(
    @Query('matricula') matricula?: string,
    @Query('periodo') periodo?: string,
  ) {
    if (!matricula || !matricula.trim()) {
      throw new BadRequestException('O parâmetro matricula é obrigatório.');
    }
    return this.schedulingService.getStudentFlow(matricula.trim(), periodo);
  }

  /**
   * Endpoint público para listar horários com vagas disponíveis para um polo.
   */
  @Get('available-slots')
  async getAvailableSlots(
    @Query('localId') localId?: string,
    @Query('periodo') periodo?: string,
  ) {
    if (!localId || !localId.trim()) {
      throw new BadRequestException('O parâmetro localId é obrigatório.');
    }
    return this.schedulingService.getAvailableSlots(localId.trim(), periodo);
  }

  /**
   * Endpoint público para realizar a reserva de horário de prova.
   */
  @Post('book')
  async createStudentBooking(@Body() dto: CreateBookingDto) {
    return this.schedulingService.createBooking(dto);
  }

  /**
   * Endpoint público para o aluno cancelar seu próprio agendamento ativo.
   */
  @Post('cancel')
  async cancelStudentBooking(
    @Body() body: { bookingId: string; matricula: string },
  ) {
    if (!body?.bookingId || !body?.matricula) {
      throw new BadRequestException('bookingId e matricula são obrigatórios.');
    }
    return this.schedulingService.cancelStudentBooking(
      body.bookingId,
      body.matricula,
    );
  }

  /**
   * Endpoint público para o aluno remarcar (alterar) seu agendamento.
   */
  @Post('reschedule')
  async rescheduleStudentBooking(
    @Body()
    body: {
      bookingId: string;
      matricula: string;
      newOpcaoId: string;
      periodo: string;
    },
  ) {
    if (
      !body?.bookingId ||
      !body?.matricula ||
      !body?.newOpcaoId ||
      !body?.periodo
    ) {
      throw new BadRequestException(
        'bookingId, matricula, newOpcaoId e periodo são obrigatórios.',
      );
    }
    return this.schedulingService.rescheduleStudentBooking(
      body.bookingId,
      body.matricula,
      body.newOpcaoId,
      body.periodo,
    );
  }
}
