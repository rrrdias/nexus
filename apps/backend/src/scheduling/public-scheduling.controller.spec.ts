import { Test, TestingModule } from '@nestjs/testing';
import { PublicSchedulingController } from './public-scheduling.controller';
import { SchedulingService } from './scheduling.service';

describe('PublicSchedulingController', () => {
  let controller: PublicSchedulingController;
  let mockSchedulingService: any;

  beforeEach(async () => {
    mockSchedulingService = {
      getStudentFlow: jest.fn().mockResolvedValue({
        student: { matricula: 'G2610162', nome: 'Aluno Teste', disciplinas: ['DISCIPLINA 1'] },
        activeBooking: null,
        locals: [{ id: 'loc-1', nome: 'Anápolis' }],
        periodo: '2026-2',
      }),
      getAvailableSlots: jest.fn().mockResolvedValue([
        { id: 'opt-1', localId: 'loc-1', data: '2026-11-10', hora: '08:00:00', vagas: 10 },
      ]),
      createBooking: jest.fn().mockResolvedValue({
        id: 'book-1',
        matricula: 'G2610162',
        status: 'ativo',
      }),
      cancelStudentBooking: jest.fn().mockResolvedValue({
        id: 'book-1',
        status: 'cancelado',
      }),
      rescheduleStudentBooking: jest.fn().mockResolvedValue({
        id: 'book-2',
        status: 'ativo',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicSchedulingController],
      providers: [
        {
          provide: SchedulingService,
          useValue: mockSchedulingService,
        },
      ],
    }).compile();

    controller = module.get<PublicSchedulingController>(PublicSchedulingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get student flow for given matricula', async () => {
    const res = await controller.getStudentFlow('G2610162', '2026-2');
    expect(mockSchedulingService.getStudentFlow).toHaveBeenCalledWith('G2610162', '2026-2');
    expect(res.student.matricula).toBe('G2610162');
  });

  it('should throw BadRequestException if matricula is missing', async () => {
    await expect(controller.getStudentFlow('')).rejects.toThrow();
  });

  it('should get available slots for a local', async () => {
    const res = await controller.getAvailableSlots('loc-1', '2026-2');
    expect(mockSchedulingService.getAvailableSlots).toHaveBeenCalledWith('loc-1', '2026-2');
    expect(res.length).toBe(1);
  });

  it('should book an exam slot', async () => {
    const res = await controller.createStudentBooking({
      opcaoId: 'opt-1',
      matricula: 'G2610162',
      periodo: '2026-2',
    });
    expect(mockSchedulingService.createBooking).toHaveBeenCalled();
    expect(res.id).toBe('book-1');
  });

  it('should cancel student booking', async () => {
    const res = await controller.cancelStudentBooking({
      bookingId: 'book-1',
      matricula: 'G2610162',
    });
    expect(mockSchedulingService.cancelStudentBooking).toHaveBeenCalledWith('book-1', 'G2610162');
    expect(res.status).toBe('cancelado');
  });

  it('should reschedule student booking', async () => {
    const res = await controller.rescheduleStudentBooking({
      bookingId: 'book-1',
      matricula: 'G2610162',
      newOpcaoId: 'opt-2',
      periodo: '2026-2',
    });
    expect(mockSchedulingService.rescheduleStudentBooking).toHaveBeenCalledWith(
      'book-1',
      'G2610162',
      'opt-2',
      '2026-2',
    );
    expect(res.id).toBe('book-2');
  });
});
