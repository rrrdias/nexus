import {
  computeAdditivePhaseSumGrade,
  detectCohortPhaseScale,
  normalizeGrade,
} from './utils/grade-normalizer';
import {
  classifyActivityPhase,
  detectListaNotasTruncated,
  parseActivities,
  reconcileStudentPhaseActivities,
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

    it('should convert grades monotonically to 0-100 scale and apply Math.ceil for any fraction above ,0', () => {
      const cohortGrades = [
        '85.0',
        '93.8',
        '80.1',
        '10.0',
        '9.0',
        '10.5',
        '0',
        '',
      ];
      const scale = detectCohortPhaseScale(cohortGrades);
      expect(scale).toBe('0-100');

      expect(normalizeGrade('85.0', scale)).toEqual({
        numericGrade: 85,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      // Arredondamento para cima (teto) para qualquer decimal > ,0
      expect(normalizeGrade('93.8', scale)).toEqual({
        numericGrade: 94,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      expect(normalizeGrade('80.1', scale)).toEqual({
        numericGrade: 81,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      expect(normalizeGrade('93.0', scale)).toEqual({
        numericGrade: 93,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      // Escala 0-10 é convertida para 0-100 (9,3 -> 93; 8,01 -> 81)
      expect(normalizeGrade('9.3', '0-10')).toEqual({
        numericGrade: 93,
        status: 'Lançada',
        scaleApplied: '0-10',
      });
      expect(normalizeGrade('8.01', '0-10')).toEqual({
        numericGrade: 81,
        status: 'Lançada',
        scaleApplied: '0-10',
      });
      // Sem inversão em cohort 0-100: 10.0 -> 10, 9.0 -> 9, 10.5 -> 11
      expect(normalizeGrade('10.0', scale)).toEqual({
        numericGrade: 10,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      expect(normalizeGrade('9.0', scale)).toEqual({
        numericGrade: 9,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
      expect(normalizeGrade('10.5', scale)).toEqual({
        numericGrade: 11,
        status: 'Lançada',
        scaleApplied: '0-100',
      });
    });

    it('should strictly distinguish null/empty (Pendente) from explicit zero 0 (Lançada)', () => {
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

    it('should cap converted grades safely within [0, 100] and compute additive phase sum ceiling', () => {
      expect(normalizeGrade('125', '0-100').numericGrade).toBe(100);
      expect(normalizeGrade('invalid-text', 'auto')).toEqual({
        numericGrade: null,
        status: 'Pendente',
        scaleApplied: '0-10',
      });

      expect(
        computeAdditivePhaseSumGrade([
          {
            nome: '1ª VA',
            status: 'Avaliado',
            nota: '58.0',
            notaMax: '60.0',
            data: '-',
          },
          {
            nome: 'Revisando',
            status: 'Avaliado',
            nota: '20.0',
            notaMax: '20.0',
            data: '-',
          },
          {
            nome: 'APS1',
            status: 'Avaliado',
            nota: '2.1',
            notaMax: '3.3',
            data: '-',
          },
        ]),
      ).toEqual({ rawSum: 80.1, roundedGrade: 81 });

      expect(
        computeAdditivePhaseSumGrade([
          {
            nome: '1ª VA',
            status: 'Avaliado',
            nota: '60.0',
            notaMax: '60.0',
            data: '-',
          },
          {
            nome: 'Revisando',
            status: 'Avaliado',
            nota: '20.0',
            notaMax: '20.0',
            data: '-',
          },
          {
            nome: 'APS1',
            status: 'Avaliado',
            nota: '13.8',
            notaMax: '20.0',
            data: '-',
          },
        ]),
      ).toEqual({ rawSum: 93.8, roundedGrade: 94 });

      // Modelo não-aditivo (notaMax > 100.5) retorna null para evitar soma indevida
      expect(
        computeAdditivePhaseSumGrade([
          {
            nome: 'Ativ 1',
            status: 'Avaliado',
            nota: '80',
            notaMax: '100',
            data: '-',
          },
          {
            nome: 'Ativ 2',
            status: 'Avaliado',
            nota: '90',
            notaMax: '100',
            data: '-',
          },
        ]),
      ).toBeNull();
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

    it('should reconcile truncated lista_notas using listaFase1..3 and progressoListaFase1..3 with chronological numeric order', () => {
      const truncatedLista =
        '1ª VA - VERIFICAÇÃO DE APRENDIZAGEM:54.0:60.0:13/06/2026|APS1 - Atividade:2.5:3.3:13/06/2026|APS10 - Atividade:3.3:3.3:14/06/2026|APS2 - Atividade:2.5:3.3:13/06/2026|Revisando Conteúdo - Fase 1:16.0:20.0:13/06/2026|R'.padEnd(
          1030,
          'x',
        );

      const result = reconcileStudentPhaseActivities({
        listaNotas: truncatedLista,
        listaFase1:
          '1ª VA - VERIFICAÇÃO DE APRENDIZAGEM:54.0:60.0:13/06/2026|APS1 - Atividade:2.5:3.3:13/06/2026|Revisando Conteúdo - Fase 1:16.0:20.0:13/06/2026',
        listaFase2:
          '2ª VA - VERIFICAÇÃO DE APRENDIZAGEM:60.0:60.0:14/06/2026|APS2 - Atividade:2.5:3.3:13/06/2026|Revisando Conteúdo - Fase 2:20.0:20.0:14/06/2026',
        listaFase3:
          '3ª VA - VERIFICAÇÃO DE APRENDIZAGEM:54.0:60.0:14/06/2026|Revisando Conteúdo - Fase 3:12.0:20.0:14/06/2026',
        progressoListaFase1:
          'APS1 - Atividade:Concluído:13/06/2026|APS2 - Atividade:Concluído:13/06/2026|APS6 - Atividade:Concluído:13/06/2026|Revisando Conteúdo - Fase 1:Concluído:13/06/2026|1ª VA - VERIFICAÇÃO DE APRENDIZAGEM:Concluído:13/06/2026',
        progressoListaFase2:
          'APS10 - Atividade:Concluído:14/06/2026|Revisando Conteúdo - Fase 2:Concluído:14/06/2026|2ª VA - VERIFICAÇÃO DE APRENDIZAGEM:Concluído:14/06/2026',
        progressoListaFase3:
          'Revisando Conteúdo - Fase 3:Pendente:-|3ª VA - VERIFICAÇÃO DE APRENDIZAGEM:Concluído:14/06/2026',
      });

      expect(result.isTruncatedUncompensated).toBe(false);
      // Ordem cronológica/numérica: APS1, APS2, APS6, Revisando Conteúdo, 1ª VA
      expect(result.f1Activities.map((a) => a.nome)).toEqual([
        'APS1 - Atividade',
        'APS2 - Atividade',
        'APS6 - Atividade',
        'Revisando Conteúdo - Fase 1',
        '1ª VA - VERIFICAÇÃO DE APRENDIZAGEM',
      ]);
      // APS2 tem nota recuperada mesmo Moodle colocando em listaFase2
      expect(result.f1Activities[1].nota).toBe('2.5');
      // Revisando Conteúdo Fase 2 e Fase 3 recuperados integralmente
      expect(result.f2Activities.map((a) => a.nome)).toEqual([
        'APS10 - Atividade',
        'Revisando Conteúdo - Fase 2',
        '2ª VA - VERIFICAÇÃO DE APRENDIZAGEM',
      ]);
      expect(result.f2Activities[1].nota).toBe('20.0');
      expect(result.f3Activities.map((a) => a.nome)).toEqual([
        'Revisando Conteúdo - Fase 3',
        '3ª VA - VERIFICAÇÃO DE APRENDIZAGEM',
      ]);
      expect(result.f3Activities[0].nota).toBe('12.0');
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
        va1Nota: '85',
        va1Status: 'Lançada',
        va2Nota: '9',
        va2Status: 'Lançada',
        va3Nota: '0',
        va3Status: 'Lançada',
        mediaFinalNota: '60',
        statusConsolidacao: 'sincronizado',
      });
      expect(JSON.parse(notasUpserted[0].itensVa1)).toHaveLength(1);
      expect(JSON.parse(notasUpserted[0].itensVa2)).toHaveLength(1);
      expect(JSON.parse(notasUpserted[0].itensVa3)).toHaveLength(1);

      // Aluno 2026002
      expect(notasUpserted[1]).toMatchObject({
        matricula: '2026002',
        va1Nota: '9',
        va1Status: 'Lançada',
        va2Nota: '80',
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
        va1Nota: '9',
        va2Nota: '80',
        va3Nota: '75',
        mediaFinalNota: '55',
        statusConsolidacao: 'divergente',
        divergenciaMotivo: 'lista_notas_truncada',
      });
      expect(rows[1]).toMatchObject({
        matricula: '2026902',
        va1Nota: '90',
        va2Nota: '95',
        va3Status: 'Pendente',
        mediaFinalNota: '92',
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
              va1Nota: '85.00',
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
              va1Nota: '85.00',
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
            va1Nota: '85.00',
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
      expect(studentsRes.alunos[0].notas.va1).toBe(85);
      expect(studentsRes.alunos[0].notas.itensVa1).toHaveLength(1);

      const histRes = await searchService.getStudentGradesHistory(
        '2026001',
        '2026-2',
      );
      expect(histRes).toHaveLength(1);
      expect(histRes[0].va1).toBe(85);

      const exportRes = await searchService.exportGradesData({
        periodo: '2026-2',
      });
      expect(exportRes).toHaveLength(1);
      expect(exportRes[0].matricula).toBe('2026001');
    });
  });
});
