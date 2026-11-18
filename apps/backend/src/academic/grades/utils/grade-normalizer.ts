import {
  GradeScale,
  NormalizedGradeResult,
  ParsedGradeActivity,
} from '../interfaces/academic-grades.types';

/**
 * Detecta a escala predominante da turma/fase com base no universo de notas do cohort.
 * Se qualquer estudante ou nota máxima de atividade exceder 10.0, toda a fase
 * opera em escala 0-100, evitando descontinuidades em notas <= 10.0.
 */
export function detectCohortPhaseScale(
  grades: (string | null | undefined)[],
  maxActivitiesGrade?: number | null,
): '0-10' | '0-100' {
  if (
    maxActivitiesGrade !== null &&
    maxActivitiesGrade !== undefined &&
    maxActivitiesGrade > 10.0
  ) {
    return '0-100';
  }

  for (const raw of grades) {
    if (!raw) continue;
    const clean = raw.trim().replace(',', '.').replace('%', '').trim();
    if (!/^[0-9]+(\.[0-9]+)?$/.test(clean)) continue;
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 10.0) {
      return '0-100';
    }
  }

  return '0-10';
}

/**
 * Normaliza nota individual na escala 0 a 100 com arredondamento para cima (teto)
 * para qualquer fração acima de ,0 (ex.: 93,8 -> 94, 80,1 -> 81, 9,3 em 0-10 -> 93).
 * Preserva estritamente a diferença entre ausente/pendente (null) e zero explícito (0 Lançada).
 */
export function normalizeGrade(
  rawGrade: string | null | undefined,
  courseScale: GradeScale = 'auto',
): NormalizedGradeResult {
  if (rawGrade === null || rawGrade === undefined) {
    return { numericGrade: null, status: 'Pendente', scaleApplied: '0-10' };
  }

  const trimmed = rawGrade.trim();
  if (
    trimmed === '' ||
    trimmed === '-' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined'
  ) {
    return { numericGrade: null, status: 'Pendente', scaleApplied: '0-10' };
  }

  const clean = trimmed.replace(',', '.').replace('%', '').trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(clean)) {
    return { numericGrade: null, status: 'Pendente', scaleApplied: '0-10' };
  }

  const val = parseFloat(clean);
  if (isNaN(val)) {
    return { numericGrade: null, status: 'Pendente', scaleApplied: '0-10' };
  }

  let effectiveScale: '0-10' | '0-100';
  let converted: number;

  if (courseScale === '0-100') {
    effectiveScale = '0-100';
    converted = val;
  } else if (courseScale === '0-10') {
    effectiveScale = '0-10';
    converted = val * 10.0;
  } else {
    if (val > 10.0) {
      effectiveScale = '0-100';
      converted = val;
    } else {
      effectiveScale = '0-10';
      converted = val * 10.0;
    }
  }

  const clean100 = Number(converted.toFixed(2));
  const bounded = Math.max(0, Math.min(100, clean100));
  const rounded = Math.ceil(bounded);

  return {
    numericGrade: rounded,
    status: 'Lançada',
    scaleApplied: effectiveScale,
  };
}

/**
 * Calcula a somatória de notas das atividades de uma fase em modelos aditivos
 * (soma dos notaMax <= 100.5) aplicando arredondamento para cima (Math.ceil).
 */
export function computeAdditivePhaseSumGrade(
  activities: ParsedGradeActivity[],
): { rawSum: number; roundedGrade: number } | null {
  if (!activities || activities.length === 0) return null;

  let sumNotas = 0;
  let sumMax = 0;
  let hasAnyNumericGrade = false;

  for (const act of activities) {
    if (act.notaMax !== null && act.notaMax !== undefined) {
      const cleanMax = String(act.notaMax).trim().replace(',', '.');
      if (/^[0-9]+(\.[0-9]+)?$/.test(cleanMax)) {
        const parsedMax = parseFloat(cleanMax);
        if (!isNaN(parsedMax) && parsedMax > 0) {
          sumMax += parsedMax;
        }
      }
    }

    if (act.nota !== null && act.nota !== undefined) {
      const cleanNota = String(act.nota).trim().replace(',', '.');
      if (/^[0-9]+(\.[0-9]+)?$/.test(cleanNota)) {
        const parsedNota = parseFloat(cleanNota);
        if (!isNaN(parsedNota)) {
          sumNotas += parsedNota;
          hasAnyNumericGrade = true;
        }
      }
    }
  }

  if (!hasAnyNumericGrade || sumMax <= 0 || sumMax > 100.5) {
    return null;
  }

  const rawSum = Number(sumNotas.toFixed(2));
  const roundedGrade = Math.min(100, Math.ceil(Math.max(0, rawSum)));
  return { rawSum, roundedGrade };
}
