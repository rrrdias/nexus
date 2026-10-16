import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SchedulingService } from './scheduling.service';

describe('SchedulingService (createOption stability test, RBAC, Periods & Profile)', () => {
  let service: SchedulingService;
  let db: any;
  let queryResult: any;

  beforeEach(() => {
    queryResult = [];

    const queryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      selectDistinct: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation(() => queryBuilder),
      groupBy: jest.fn().mockReturnThis(),
      as: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation(() => Promise.resolve(queryResult)),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      transaction: jest.fn().mockImplementation((cb) => cb(queryBuilder)),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      then: (resolve: any) => resolve(queryResult),
    };

    db = queryBuilder;
    service = new SchedulingService(db);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should split slots into exact 30-min intervals when duration is divisible by 30', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);
    db.returning.mockResolvedValue([
      {
        id: 'opt-1',
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:00:00',
        horaFim: '08:30:00',
        vagas: 20,
      },
      {
        id: 'opt-2',
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:30:00',
        horaFim: '09:00:00',
        vagas: 20,
      },
      {
        id: 'opt-3',
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '09:00:00',
        horaFim: '09:30:00',
        vagas: 20,
      },
      {
        id: 'opt-4',
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '09:30:00',
        horaFim: '10:00:00',
        vagas: 20,
      },
    ]);

    const result = await service.createOption({
      localId: 'local-1',
      data: '2026-09-01',
      horaInicio: '08:00',
      horaFim: '10:00',
      vagas: 20,
    });

    expect(result).toHaveLength(4);
    expect(db.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ hora: '08:00:00' }),
        expect.objectContaining({ hora: '08:30:00' }),
        expect.objectContaining({ hora: '09:00:00' }),
        expect.objectContaining({ hora: '09:30:00' }),
      ]),
    );
  });

  it('should REJECT invalid time formats immediately without hanging (Anti-DoS)', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);

    await expect(
      service.createOption({
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: 'invalid_time',
        horaFim: '10:00',
        vagas: 25,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should REJECT when horaFim is earlier than horaInicio without hanging', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);

    await expect(
      service.createOption({
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '10:00',
        horaFim: '08:00',
        vagas: 25,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should REJECT when interval is less than 30 minutes', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);

    await expect(
      service.createOption({
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:00',
        horaFim: '08:15',
        vagas: 25,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should REJECT when minutes are not multiples of 30 minutes', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);

    await expect(
      service.createOption({
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:15',
        horaFim: '09:00',
        vagas: 25,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should REJECT intervals that are NOT exact multiples of 30 minutes', async () => {
    db.limit.mockResolvedValue([{ id: 'local-1', nome: 'Campus Anápolis' }]);

    await expect(
      service.createOption({
        localId: 'local-1',
        data: '2026-09-01',
        horaInicio: '08:00',
        horaFim: '08:45',
        vagas: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should ALLOW admin action for Super Admin', async () => {
    await expect(
      service.assertSchedulingAdminAccess({ id: 'u1', isSuperAdmin: true }),
    ).resolves.not.toThrow();
  });

  it('should REJECT admin action for unauthorized user', async () => {
    db.limit.mockResolvedValue([]);
    await expect(
      service.assertSchedulingAdminAccess({ id: 'u2', isSuperAdmin: false }),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('Fase 3: getPeriods()', () => {
    it('should aggregate distinct periods from academic, ava and bookings tables and sort descending', async () => {
      queryResult = [
        { periodo: '2025-1' },
        { periodo: '2026-2' },
        { periodo: '2026-1' },
      ];

      const periods = await service.getPeriods();
      expect(periods).toEqual(['2026-2', '2026-1', '2025-1']);
    });
  });

  describe('Fase 2: getStudentProfile()', () => {
    it('should return profile from AVA progress report when student has records', async () => {
      queryResult = [
        {
          aluno: 'Maria Silva',
          usuario: 'maria.silva@nexus.edu.br',
          userPhone1: '62999998888',
          curso: 'Direito Civil I',
        },
        {
          aluno: 'Maria Silva',
          usuario: 'maria.silva@nexus.edu.br',
          userPhone1: '62999998888',
          curso: 'Direito Penal I',
        },
      ];

      const profile = await service.getStudentProfile('2026001', '2026-1');
      expect(profile.nome).toBe('Maria Silva');
      expect(profile.email).toBe('maria.silva@nexus.edu.br');
      expect(profile.disciplinas).toHaveLength(2);
      expect(profile.totalDisciplinas).toBe(2);
    });

    it('should fallback to Lyceum academic tables when AVA report has no records', async () => {
      // First query (AVA) returns empty array
      let callCount = 0;
      db.then = (resolve: any) => {
        callCount++;
        if (callCount === 1) {
          // AVA query
          return resolve([]);
        } else {
          // academicMatricula join academicTurma
          return resolve([
            { nomeDisciplina: 'Cálculo I', disciplina: 'MAT101', turma: 'T1' },
            {
              nomeDisciplina: 'Álgebra Linear',
              disciplina: 'MAT102',
              turma: 'T2',
            },
          ]);
        }
      };

      db.limit.mockResolvedValue([
        {
          id: 'discente-uuid-1',
          matricula: '2026002',
          nome: 'Carlos',
          sobrenome: 'Souza',
          nomeSocial: null,
          email: 'carlos.souza@nexus.edu.br',
          telefone: '62988887777',
        },
      ]);

      const profile = await service.getStudentProfile('2026002', '2026-1');
      expect(profile.nome).toBe('Carlos Souza');
      expect(profile.matricula).toBe('2026002');
      expect(profile.disciplinas).toEqual(['Cálculo I', 'Álgebra Linear']);
      expect(profile.totalDisciplinas).toBe(2);
    });

    it('should throw NotFoundException when student is not found in AVA or Lyceum', async () => {
      queryResult = [];
      db.limit.mockResolvedValue([]);

      await expect(
        service.getStudentProfile('9999999', '2026-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should REJECT students from non-EaD AVA institutions (uni, uniego, raizes, eefn)', async () => {
      queryResult = [
        {
          sourceInstitution: 'uniego',
          aluno: 'Adriel Miranda',
          usuario: 'adriel@nexus.edu.br',
          userPhone1: '62999991111',
          curso: 'Anatomia Humana',
          subcategoria: 'REGULARES',
        },
      ];

      await expect(
        service.getStudentProfile('G2610162', '2026-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should filter only REGULARES disciplines when subcategoria is populated', async () => {
      queryResult = [
        {
          sourceInstitution: 'ead',
          aluno: 'Maria Silva',
          usuario: 'maria.silva@nexus.edu.br',
          userPhone1: '62999998888',
          curso: 'Direito Civil I',
          subcategoria: 'REGULARES',
        },
        {
          sourceInstitution: 'ead',
          aluno: 'Maria Silva',
          usuario: 'maria.silva@nexus.edu.br',
          userPhone1: '62999998888',
          curso: 'Projeto de Extensão I',
          subcategoria: 'EXTENSÃO',
        },
        {
          sourceInstitution: 'ead',
          aluno: 'Maria Silva',
          usuario: 'maria.silva@nexus.edu.br',
          userPhone1: '62999998888',
          curso: 'Ambientação EaD',
          subcategoria: 'AMBIENTAÇÃO',
        },
      ];

      const profile = await service.getStudentProfile('2026001', '2026-1');
      expect(profile.disciplinas).toEqual(['Direito Civil I']);
      expect(profile.totalDisciplinas).toBe(1);
      expect(profile.modalidade).toBe('Graduação EaD');
      expect(profile.categoria).toBe('REGULARES');
    });

    it('should REJECT when EaD student only has non-REGULARES disciplines', async () => {
      queryResult = [
        {
          sourceInstitution: 'ead',
          aluno: 'João Silva',
          usuario: 'joao@nexus.edu.br',
          userPhone1: '62999990000',
          curso: 'Estágio Supervisionado I',
          subcategoria: 'ESTÁGIO',
        },
      ];

      await expect(
        service.getStudentProfile('2026009', '2026-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should REJECT Lyceum students with non-EaD short turno codes (NOT, MAT, VES, SEMI, POS) or non-EaD cursoInstituicao', async () => {
      queryResult = [];
      db.limit.mockResolvedValue([
        {
          id: 'discente-presencial-1',
          matricula: '2310154',
          nome: 'Lucas',
          sobrenome: 'Almeida',
          turno: 'NOT',
          cursoInstituicao: 'UniEVANGÉLICA',
        },
      ]);

      await expect(
        service.getStudentProfile('2310154', '2026-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should REJECT Semipresencial (-SEMI) courses in AVA ead institution', async () => {
      queryResult = [
        {
          sourceInstitution: 'ead',
          aluno: 'Aluno Semi',
          usuario: 'semi@nexus.edu.br',
          userPhone1: '62999990000',
          curso: 'BROMATOLOGIA E TECNOLOGIA DE ALIMENTOS – M128T01-SEMI20262',
          cursoPerfil: 'Farmácia - SEMI',
          subcategoria: null,
        },
      ];

      await expect(
        service.getStudentProfile('D2520144', '2026-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Fase 4: getAttendanceList()', () => {
    it('should return formatted attendance list with start/end time and student names', async () => {
      queryResult = [
        {
          id: 'b-1',
          matricula: '2026001',
          descricao: 'Direito Penal;Direito Civil',
          status: 'ativo',
          periodo: '2026-1',
          data: '2026-09-01',
          hora: '08:00:00',
          localId: 'local-1',
          localNome: 'Campus Central',
          localEndereco: 'Rua 1, 100',
          studentName: 'Ana Silva',
          studentEmail: 'ana@nexus.edu.br',
          acNomeSocial: null,
          acNome: null,
          acSobrenome: null,
          acEmail: null,
          acUsuario: null,
        },
      ];

      const list = await service.getAttendanceList({
        localId: 'local-1',
        data: '2026-09-01',
        periodo: '2026-1',
      });

      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        id: 'b-1',
        matricula: '2026001',
        studentName: 'Ana Silva',
        studentEmail: 'ana@nexus.edu.br',
        localNome: 'Campus Central',
        localEndereco: 'Rua 1, 100',
        data: '2026-09-01',
        horaInicio: '08:00',
        horaFim: '09:00',
        disciplinas: ['Direito Penal', 'Direito Civil'],
        totalDisciplinas: 2,
        status: 'ativo',
        periodo: '2026-1',
      });
    });
  });
});
