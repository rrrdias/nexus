import {
  detectCohortPhaseScale,
  normalizeGrade,
} from './utils/grade-normalizer';
import {
  classifyActivityPhase,
  detectListaNotasTruncated,
  parseActivities,
} from './utils/activity-parser';
import {
  getPeriodVariants,
  isStrictOnlineModelagem,
  resolveEnrolmentStatus,
  resolveSourceInstitution,
} from './utils/enrolment-resolver';
import { AcademicGradesMirrorService } from './academic-grades-mirror.service';
import { AcademicGradesSearchService } from './academic-grades-search.service';

describe('AcademicGrades Submodule (Phase 2: Normalization, Status, Parsing & Services)', () => {
  describe('1. Grade Normalizer (0-10 vs 0-100 Cohort Resolution & Null vs Zero)', () => {
    it('should detect 0-100 cohort scale whenever any grade or max activity exceeds 10.0', () => {
      expect(detectCohortPhaseScale(['8.5', '10.0', '9.0', '0'])).toBe('0-10');
      expect(detectCohortPhaseScale(['85.0', '10.0', '9.0', '0'])).toBe(
        '0-100',
      );
      expect(detectCohortPhaseScale(['8.0', '7.0'], 20)).toBe('0-100');
    });

    it('should convert 0-100 cohort grades monotonically without inverting <= 10.0 scores', () => {
      const cohortGrades = ['85.0', '10.0', '9.0', '10.5', '0', ''];
      const scale = detectCohortPhaseScale(cohortGrades);
      expect(scale).toBe('0-100');

      expect(normalizeGrade('85.0', scale)).toEqual({
        numericGrade: 8.5,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      // Sem inversão: 10.0/100 vira 1.00 (não 10.00!) e 10.5/100 vira 1.05
      expect(normalizeGrade('10.0', scale)).toEqual({
        numericGrade: 1.0,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      expect(normalizeGrade('9.0', scale)).toEqual({
        numericGrade: 0.9,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      expect(normalizeGrade('10.5', scale)).toEqual({
        numericGrade: 1.05,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
    });

    it('should strictly distinguish null/empty (Pendente) from explicit zero 0.00 (Lançada)', () => {
      expect(normalizeGrade(null, '0-10')).toEqual({
        numericGrade: null,
        status: 'Pendente',
        scaleApplied: '0-10',
      });
      expect(normalizeGrade('', '0-10')).toEqual({
        numericGrade: null,
        status: 'Pendente',
        scaleApplied: '0-10',
      });
      expect(normalizeGrade('-', '0-10')).toEqual({
        numericGrade: null,
        status: 'Pendente',
        scaleApplied: '0-10',
      });
      expect(normalizeGrade('0', '0-10')).toEqual({
        numericGrade: 0,
        status: 'Lançada',
        scaleApplied: '0-10',
      });
      expect(normalizeGrade('0,0', '0-100')).toEqual({
        numericGrade: 0,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
    });

    it('should cap converted grades safely within [0.00, 10.00]', () => {
      expect(normalizeGrade('125', '0-100').numericGrade).toBe(10);
      expect(normalizeGrade('invalid-text', 'auto')).toEqual({
        numericGrade: null,
        status: 'Pendente',
        scaleApplied: '0-10',
      });
    });
  });

  describe('2. Enrolment Resolver & Strict 100% Online Filter', () => {
    it('should strictly accept 100% online modelagem and reject presencial/semipresencial classes', () => {
      expect(isStrictOnlineModelagem('DISCIPLINA 100% ONLINE')).toBe(true);
      expect(isStrictOnlineModelagem('DISCIPLINA100')).toBe(true);
      expect(isStrictOnlineModelagem('100% On-line')).toBe(true);

      expect(isStrictOnlineModelagem('PRESENCIAL')).toBe(false);
      expect(isStrictOnlineModelagem('SEMIPRESENCIAL')).toBe(false);
      expect(isStrictOnlineModelagem('PRATICA 100% ONLINE')).toBe(false);
      expect(isStrictOnlineModelagem('')).toBe(false);
      expect(isStrictOnlineModelagem(null)).toBe(false);
    });

    it('should resolve enrolment status prioritizing Lyceum with defensive blocking', () => {
      expect(resolveEnrolmentStatus('Matriculado', 'S', 'Ativo')).toMatchObject(
        {
          statusMatricula: 'matriculado',
          bloqueioLancamento: false,
        },
      );

      // Lyceum Matriculado prevalece sobre AVA transitoriamente Suspenso
      expect(
        resolveEnrolmentStatus('Matriculado', 'S', 'Suspenso'),
      ).toMatchObject({
        statusMatricula: 'matriculado',
        bloqueioLancamento: false,
      });

      // Suspenso/Trancado bloqueia lançamento oficial mas mantém visibilidade
      expect(resolveEnrolmentStatus('Suspenso', 'S', 'Ativo')).toMatchObject({
        statusMatricula: 'suspenso',
        bloqueioLancamento: true,
      });
      expect(resolveEnrolmentStatus('Trancado', 'N', 'Ativo')).toMatchObject({
        statusMatricula: 'suspenso',
        bloqueioLancamento: true,
      });

      // Cancelado / Evadido
      expect(resolveEnrolmentStatus('Cancelado', 'N', 'Ativo')).toMatchObject({
        statusMatricula: 'cancelado',
        bloqueioLancamento: true,
      });

      // Fallback no AVA quando Lyceum vazio
      expect(resolveEnrolmentStatus(null, null, 'Suspenso')).toMatchObject({
        statusMatricula: 'suspenso',
        bloqueioLancamento: true,
      });
      expect(resolveEnrolmentStatus(null, null, 'Ativo')).toMatchObject({
        statusMatricula: 'matriculado',
        bloqueioLancamento: false,
      });

      // Ambos indefinidos -> postura defensiva (suspenso + bloqueio)
      expect(resolveEnrolmentStatus('', '', '')).toMatchObject({
        statusMatricula: 'suspenso',
        bloqueioLancamento: true,
      });
    });

    it('should normalize period variants and map sourceInstitution cleanly', () => {
      expect(getPeriodVariants('2026-2')).toEqual(['2026-2', '2026/2']);
      expect(getPeriodVariants('2026/2')).toEqual(['2026/2', '2026-2']);
      expect(resolveSourceInstitution('UniEVANGÉLICA')).toBe('uni');
      expect(resolveSourceInstitution('Ead_Unievangelica')).toBe('ead');
      expect(resolveSourceInstitution('FAEGO')).toBe('uniego');
      expect(resolveSourceInstitution('RAÍZES')).toBe('raizes');
    });
  });

  describe('3. Activity Parser & Truncation Detection', () => {
    it('should parse lista_notas and classify items into VA1, VA2, and VA3 phases', () => {
      const raw =
        'APS 1 - Fundamentos:10:10:10/08/2026|1ª Verificação de Aprendizagem (VA1):8.5:10:20/09/2026|APS 8 - Estudo:9:10:15/10/2026|2ª VA:7.5:10:30/10/2026|3ª Verificação (Exame Final):9.2:10:12/12/2026';
      const parsed = parseActivities(raw);
      expect(parsed).toHaveLength(5);

      expect(classifyActivityPhase(parsed[0].nome)).toBe(1);
      expect(classifyActivityPhase(parsed[1].nome)).toBe(1);
      expect(classifyActivityPhase(parsed[2].nome)).toBe(2);
      expect(classifyActivityPhase(parsed[3].nome)).toBe(2);
      expect(classifyActivityPhase(parsed[4].nome)).toBe(3);
      expect(detectListaNotasTruncated(raw)).toBe(false);
    });

    it('should detect truncated lista_notas (>= 1024 chars or cut-off tail)', () => {
      const longStr = 'A:10:10:01/01/2026|'.repeat(60);
      expect(longStr.length).toBeGreaterThanOrEqual(1024);
      expect(detectListaNotasTruncated(longStr)).toBe(true);

      const cutTail = 'APS1:8:10:10/08/2026|APS2:9:10';
      expect(detectListaNotasTruncated(cutTail)).toBe(true);
    });
  });

  describe('4. AcademicGradesMirrorService & AcademicGradesSearchService', () => {
    function createSequentialDbMock(selectResults: any[][]) {
      let selectIdx = 0;
      const insertedCalls: any[] = [];
      const updatedCalls: any[] = [];

      const builder: any = {
        select: jest.fn(() => builder),
        from: jest.fn(() => builder),
        innerJoin: jest.fn(() => builder),
        leftJoin: jest.fn(() => builder),
        where: jest.fn(() => builder),
        groupBy: jest.fn(() => builder),
        orderBy: jest.fn(() => builder),
        limit: jest.fn(() => builder),
        offset: jest.fn(() => builder),
        insert: jest.fn(() => builder),
        values: jest.fn((vals: any) => {
          insertedCalls.push(vals);
          return builder;
        }),
        onConflictDoUpdate: jest.fn().mockResolvedValue([]),
        update: jest.fn(() => builder),
        set: jest.fn((vals: any) => {
          updatedCalls.push(vals);
          return builder;
        }),
        transaction: jest.fn(async (cb: any) => cb(builder)),
        then: (resolve: any, reject: any) => {
          const res = selectResults[selectIdx] ?? [];
          selectIdx++;
          return Promise.resolve(res).then(resolve, reject);
        },
      };

      return { db: builder, insertedCalls, updatedCalls };
    }

    it('should mirror strictly 100% online turmas, filter presencial -INT-, and compute status counters', async () => {
      const turmasFromLyceum = [
        {
          id: 'turma-online-1',
          turma: 'DIR-ON-20262',
          codTurma: 'DIR-ON-20262',
          disciplina: 'DISC01',
          nomeDisciplina: 'Direito Digital',
          codDisciplina: 'DISC01',
          curso: 'DIR',
          cursoNome: 'Direito',
          cursoInstituicao: 'UniEVANGÉLICA',
          periodo: '2026-2',
          modelagem: 'DISCIPLINA 100% ONLINE',
        },
        {
          // Caso SQL não filtre ou registro contaminado: guard TypeScript descarta presencial com -INT-
          id: 'turma-presencial-int',
          turma: 'BIOET-INT-20262',
          disciplina: 'DISC02',
          nomeDisciplina: 'Bioética Presencial',
          periodo: '2026-2',
          modelagem: 'PRESENCIAL',
          cursoInstituicao: 'UniEVANGÉLICA',
        },
      ];

      const enrollmentsFromLyceum = [
        {
          turmaId: 'turma-online-1',
          usuarioId: 'u1',
          situacaoLyceum: 'Matriculado',
          ativoLyceum: 'S',
          matricula: '2026001',
          nome: 'Ana',
          sobrenome: 'Silva',
          nomeSocial: null,
          email: 'ana@nexus.edu.br',
          cpf: '111',
        },
        {
          turmaId: 'turma-online-1',
          usuarioId: 'u2',
          situacaoLyceum: 'Suspenso',
          ativoLyceum: 'S',
          matricula: '2026002',
          nome: 'Bruno',
          sobrenome: 'Costa',
          nomeSocial: null,
          email: 'bruno@nexus.edu.br',
          cpf: '222',
        },
        {
          turmaId: 'turma-online-1',
          usuarioId: 'u3',
          situacaoLyceum: 'Cancelado',
          ativoLyceum: 'N',
          matricula: '2026003',
          nome: 'Carlos',
          sobrenome: 'Lima',
          nomeSocial: null,
          email: 'carlos@nexus.edu.br',
          cpf: '333',
        },
      ];

      const avaStatusRows = [
        {
          userIdentification: '2026001',
          courseFullname: 'Direito Digital - DIR-ON-20262',
          courseShortname: 'DIR-ON-20262',
          enrolmentStatus: 'Ativo',
        },
      ];

      const { db, insertedCalls, updatedCalls } = createSequentialDbMock([
        turmasFromLyceum,
        enrollmentsFromLyceum,
        avaStatusRows,
      ]);

      const mirrorService = new AcademicGradesMirrorService(db);
      const summary = await mirrorService.syncMirror100Online('2026-2');

      expect(summary).toEqual({
        periodo: '2026-2',
        turmasEspelhadas: 1,
        matriculasSincronizadas: 3,
        totalMatriculados: 1,
        totalSuspensos: 1,
        totalCancelados: 1,
      });

      // Primeiro insert: somente a turma 100% online (presencial descartada)
      expect(insertedCalls[0]).toHaveLength(1);
      expect(insertedCalls[0][0].id).toBe('turma-online-1');
      expect(insertedCalls[0][0].sourceInstitution).toBe('uni');

      // Segundo insert: 3 matrículas espelhadas com bloqueio correto
      expect(insertedCalls[1]).toHaveLength(3);
      expect(insertedCalls[1][0]).toMatchObject({
        matricula: '2026001',
        statusMatricula: 'matriculado',
        bloqueioLancamento: false,
      });
      expect(insertedCalls[1][1]).toMatchObject({
        matricula: '2026002',
        statusMatricula: 'suspenso',
        bloqueioLancamento: true,
      });
      expect(insertedCalls[1][2]).toMatchObject({
        matricula: '2026003',
        statusMatricula: 'cancelado',
        bloqueioLancamento: true,
      });

      // Atualização dos contadores da turma
      expect(updatedCalls[0]).toMatchObject({
        totalAlunos: 3,
        totalMatriculados: 1,
        totalSuspensos: 1,
        totalCancelados: 1,
      });
    });

    it('should correlate local AVA grades with uniform cohort scaling and preserve null vs 0', async () => {
      const mirroredMatriculas = [
        {
          matriculaId: 'mat-id-1',
          turmaId: 'turma-online-1',
          matricula: '2026001',
          turmaCodigo: 'DIR-ON-20262',
          periodo: '2026-2',
          sourceInstitution: 'uni',
        },
        {
          matriculaId: 'mat-id-2',
          turmaId: 'turma-online-1',
          matricula: '2026002',
          turmaCodigo: 'DIR-ON-20262',
          periodo: '2026-2',
          sourceInstitution: 'uni',
        },
        {
          matriculaId: 'mat-id-3',
          turmaId: 'turma-online-1',
          matricula: '2026003',
          turmaCodigo: 'DIR-ON-20262',
          periodo: '2026-2',
          sourceInstitution: 'uni',
        },
      ];

      const avaGradesRows = [
        {
          id: 'g1',
          sourceInstitution: 'uni',
          courseId: '991',
          courseFullname: 'Direito Digital - DIR-ON-20262',
          userId: '501',
          userIdentification: '2026001',
          fase1: '85.0',
          fase2: '9.0', // Em coorte 0-100 deve virar 0.9, NUNCA 9.0
          fase3: '0', // Zero explícito deve ficar '0' Lançada
          media: '60.0',
          listaNotas:
            '1ª VA:85:100:10/09/2026|2ª VA:9:100:20/10/2026|3ª VA:0:100:10/12/2026',
          updatedAt: new Date('2026-11-16T10:00:00Z'),
        },
        {
          id: 'g2',
          sourceInstitution: 'uni',
          courseId: '991',
          courseFullname: 'Direito Digital - DIR-ON-20262',
          userId: '502',
          userIdentification: '2026002',
          fase1: '9.0', // Mesmo coorte 0-100 -> 0.9
          fase2: '80.0',
          fase3: '', // Pendente
          media: '',
          listaNotas: null,
          updatedAt: new Date('2026-11-16T10:00:00Z'),
        },
      ];

      // 3 selects: 1) matriculas, 2) ava_grades_report, 3) ava_consolidated_report (fallback p/ 2026003)
      const { db, insertedCalls, updatedCalls } = createSequentialDbMock([
        mirroredMatriculas,
        avaGradesRows,
        [], // sem registro no consolidado para 2026003
      ]);

      const searchService = new AcademicGradesSearchService(db);
      const result =
        await searchService.correlateGradesForTurma('turma-online-1');

      expect(result).toEqual({ turmaId: 'turma-online-1', updatedCount: 3 });

      const notasUpserted = insertedCalls[0];
      expect(notasUpserted).toHaveLength(3);

      // Aluno 2026001
      expect(notasUpserted[0]).toMatchObject({
        matricula: '2026001',
        va1Nota: '8.5',
        va1Status: 'Lançada',
        va2Nota: '0.9',
        va2Status: 'Lançada',
        va3Nota: '0',
        va3Status: 'Lançada',
        mediaFinalNota: '6',
        statusConsolidacao: 'sincronizado',
      });
      expect(JSON.parse(notasUpserted[0].itensVa1)).toHaveLength(1);
      expect(JSON.parse(notasUpserted[0].itensVa2)).toHaveLength(1);
      expect(JSON.parse(notasUpserted[0].itensVa3)).toHaveLength(1);

      // Aluno 2026002
      expect(notasUpserted[1]).toMatchObject({
        matricula: '2026002',
        va1Nota: '0.9',
        va1Status: 'Lançada',
        va2Nota: '8',
        va2Status: 'Lançada',
        va3Nota: null,
        va3Status: 'Pendente',
        statusConsolidacao: 'sincronizado',
      });

      // Aluno 2026003 (sem notas no AVA)
      expect(notasUpserted[2]).toMatchObject({
        matricula: '2026003',
        va1Nota: null,
        va1Status: 'Pendente',
        statusConsolidacao: 'pendente',
      });

      // Atualizou moodleCourseId na turma
      expect(updatedCalls[0]).toMatchObject({
        moodleCourseId: '991',
        moodleCourseFullname: 'Direito Digital - DIR-ON-20262',
      });
    });

    it('should handle mixed scales per phase, special characters in turma name, and truncated lista_notas', async () => {
      const mirroredMatriculas = [
        {
          matriculaId: 'mat-mix-1',
          turmaId: 'turma-esp-1',
          matricula: '2026901',
          turmaCodigo: 'S01020114-INT-B20262',
          periodo: '2026/2',
          sourceInstitution: 'ead',
        },
        {
          matriculaId: 'mat-mix-2',
          turmaId: 'turma-esp-1',
          matricula: '2026902',
          turmaCodigo: 'S01020114-INT-B20262',
          periodo: '2026/2',
          sourceInstitution: 'ead',
        },
      ];

      const truncatedLista = 'APS1:90:100:10/08/2026|'.repeat(50); // >= 1024 chars

      const avaGradesRows = [
        {
          id: 'gm1',
          sourceInstitution: 'ead',
          courseId: '777',
          courseFullname:
            'FORMAS CONSENSUAIS DE SOLUÇÃO DE CONFLITOS (100% ON-LINE) - S01020114-INT-B20262',
          userId: '801',
          userIdentification: '2026901',
          fase1: '9.0', // Escala 0-100 nesta fase por causa do colega abaixo -> 0.9
          fase2: '8.0', // Fase 2 opera em 0-10 nesta turma -> 8.0
          fase3: '7.5',
          media: '5.5',
          listaNotas: truncatedLista,
          updatedAt: new Date('2026-11-16T12:00:00Z'),
        },
        {
          id: 'gm2',
          sourceInstitution: 'ead',
          courseId: '777',
          courseFullname:
            'FORMAS CONSENSUAIS DE SOLUÇÃO DE CONFLITOS (100% ON-LINE) - S01020114-INT-B20262',
          userId: '802',
          userIdentification: '2026902',
          fase1: '90.0', // Sinaliza escala 0-100 na fase1
          fase2: '9.5', // Sinaliza escala 0-10 na fase2 (nenhum > 10.0)
          fase3: null,
          media: '9.2',
          listaNotas: null,
          updatedAt: new Date('2026-11-16T12:00:00Z'),
        },
      ];

      const { db, insertedCalls } = createSequentialDbMock([
        mirroredMatriculas,
        avaGradesRows,
      ]);

      const searchService = new AcademicGradesSearchService(db);
      const res = await searchService.correlateGradesForTurma('turma-esp-1');

      expect(res).toEqual({ turmaId: 'turma-esp-1', updatedCount: 2 });
      const rows = insertedCalls[0];
      expect(rows[0]).toMatchObject({
        matricula: '2026901',
        va1Nota: '0.9',
        va2Nota: '8',
        va3Nota: '7.5',
        statusConsolidacao: 'divergente',
        divergenciaMotivo: 'lista_notas_truncada',
      });
      expect(rows[1]).toMatchObject({
        matricula: '2026902',
        va1Nota: '9',
        va2Nota: '9.5',
        va3Status: 'Pendente',
        statusConsolidacao: 'sincronizado',
        divergenciaMotivo: null,
      });
    });

    it('should list turmas, fetch turma details with students, student history, and export rows', async () => {
      const turmaRow = {
        id: 't-100',
        turma: 'DIR-ON-20262',
        codTurma: 'DIR-ON-20262',
        disciplina: 'D001',
        nomeDisciplina: 'Direito Digital',
        codDisciplina: 'D001',
        curso: 'DIR',
        cursoNome: 'Direito',
        cursoInstituicao: 'UniEVANGÉLICA',
        periodo: '2026-2',
        modelagem: 'DISCIPLINA 100% ONLINE',
        sourceInstitution: 'uni',
        moodleCourseId: '991',
        moodleCourseFullname: 'Direito Digital - DIR-ON-20262',
        totalAlunos: 2,
        totalMatriculados: 1,
        totalSuspensos: 1,
        totalCancelados: 0,
        syncedAt: new Date('2026-11-16T10:00:00Z'),
      };

      const { db } = createSequentialDbMock([
        // listOnlineTurmas: count, rows, gradeCounts
        [{ count: 1 }],
        [turmaRow],
        [{ turmaId: 't-100', va1: 2, va2: 1, va3: 0 }],
        // getTurmaGradesWithStudents -> getTurmaDetails (turma, counts), then matCount, rows
        [turmaRow],
        [{ va1: 2, va2: 1, va3: 0 }],
        [{ count: 1 }],
        [
          {
            mat: {
              id: 'm1',
              turmaId: 't-100',
              matricula: '2026001',
              nomeAluno: 'Ana Clara',
              emailAluno: 'ana@nexus.edu.br',
              cpfAluno: '111',
              statusMatricula: 'suspenso',
              situacaoLyceum: 'Suspenso',
              ativoLyceum: 'S',
              enrolmentStatusAva: 'Ativo',
              bloqueioLancamento: true,
            },
            nota: {
              va1Nota: '8.50',
              va1Raw: '85.0',
              va1Status: 'Lançada',
              va2Nota: null,
              va2Raw: null,
              va2Status: 'Pendente',
              va3Nota: null,
              va3Raw: null,
              va3Status: 'Pendente',
              mediaFinalNota: null,
              mediaRaw: null,
              itensVa1: JSON.stringify([
                {
                  nome: '1ª VA',
                  status: 'Avaliado',
                  nota: '85',
                  data: '10/09/2026',
                  fase: 1,
                },
              ]),
              itensVa2: null,
              itensVa3: null,
              statusConsolidacao: 'sincronizado',
              divergenciaMotivo: null,
              lastAvaSyncAt: new Date('2026-11-16T10:00:00Z'),
            },
          },
        ],
        // getStudentGradesHistory
        [
          {
            mat: { statusMatricula: 'suspenso', bloqueioLancamento: true },
            turma: turmaRow,
            nota: {
              va1Nota: '8.50',
              va2Nota: null,
              va3Nota: null,
              mediaFinalNota: null,
              va1Status: 'Lançada',
              va2Status: 'Pendente',
              va3Status: 'Pendente',
              statusConsolidacao: 'sincronizado',
              divergenciaMotivo: null,
              itensVa1: '[]',
              itensVa2: null,
              itensVa3: null,
            },
          },
        ],
        // exportGradesData
        [
          {
            turma: 'DIR-ON-20262',
            disciplina: 'Direito Digital',
            periodo: '2026-2',
            matricula: '2026001',
            nomeAluno: 'Ana Clara',
            statusMatricula: 'suspenso',
            bloqueioLancamento: true,
            va1Nota: '8.50',
          },
        ],
      ]);

      const searchService = new AcademicGradesSearchService(db);

      const listRes = await searchService.listOnlineTurmas({
        periodo: '2026-2',
      });
      expect(listRes.meta.total).toBe(1);
      expect(listRes.data[0].totalNotasLancadasVa1).toBe(2);

      const studentsRes = await searchService.getTurmaGradesWithStudents(
        't-100',
        {
          statusMatricula: 'suspenso',
        },
      );
      expect(studentsRes.alunos).toHaveLength(1);
      expect(studentsRes.alunos[0]).toMatchObject({
        matricula: '2026001',
        statusMatricula: 'suspenso',
        bloqueioLancamento: true,
      });
      expect(studentsRes.alunos[0].notas.va1).toBe(8.5);
      expect(studentsRes.alunos[0].notas.itensVa1).toHaveLength(1);

      const histRes = await searchService.getStudentGradesHistory(
        '2026001',
        '2026-2',
      );
      expect(histRes).toHaveLength(1);
      expect(histRes[0].va1).toBe(8.5);

      const exportRes = await searchService.exportGradesData({
        periodo: '2026-2',
      });
      expect(exportRes).toHaveLength(1);
      expect(exportRes[0].matricula).toBe('2026001');
    });
  });
});
