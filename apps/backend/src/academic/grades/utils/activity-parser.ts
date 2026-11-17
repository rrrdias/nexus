import { ParsedGradeActivity } from '../interfaces/academic-grades.types';

export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/ª/g, 'a')
    .replace(/º/g, 'o')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015\u2212\u002d]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isDateString(val: string | null | undefined): boolean {
  if (!val) return false;
  const clean = val.trim();
  return (
    /^\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/.test(clean) ||
    /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?$/.test(clean)
  );
}

export function isValidGrade(val: string | null | undefined): boolean {
  if (!val) return false;
  const clean = val.trim();
  if (isDateString(clean)) return false;
  if (/^(concl|pend|feito|realiz|avaliad|nunca|sem|none|-|null)/i.test(clean)) {
    return false;
  }
  return /^\d+(?:[.,]\d+)?$/.test(clean);
}

/**
 * Detecta se a string lista_notas sofreu truncamento pelo limite do buffer GROUP_CONCAT (1024 caracteres).
 */
export function detectListaNotasTruncated(
  raw: string | null | undefined,
): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  if (trimmed.length >= 1024) {
    return true;
  }

  const items = trimmed.split('|');
  if (items.length > 1) {
    const firstPartsCount = items[0] ? items[0].split(':').length : 0;
    const lastItem = items[items.length - 1];
    if (!lastItem) return false;
    const lastParts = lastItem.split(':');
    if (lastParts.length < 2) return true;
    if (firstPartsCount >= 3 && lastParts.length < 3) return true;
    if (
      firstPartsCount >= 4 &&
      lastParts.length === 3 &&
      !isDateString(lastParts[2]?.trim())
    ) {
      return true;
    }
  }

  return false;
}

export function parseActivities(
  raw: string | null | undefined,
): ParsedGradeActivity[] {
  if (!raw) return [];
  const rawItems = raw.split('|');
  const firstPartsCount = rawItems[0] ? rawItems[0].split(':').length : 0;

  return rawItems
    .map((item, idx): ParsedGradeActivity | null => {
      const parts = item.split(':');
      if (parts.length < 2) {
        return null;
      }

      const isLastItem = rawItems.length > 1 && idx === rawItems.length - 1;
      const nome = parts[0]?.trim() || '';
      const rawSecond = parts[1]?.trim() || '';
      const second = rawSecond || '-';
      const third = parts[2]?.trim() || '-';
      const fourth = parts[3]?.trim() || '-';

      if (
        parts.length === 2 &&
        (!rawSecond || (isLastItem && firstPartsCount >= 3))
      ) {
        return null;
      }

      if (parts.length >= 4) {
        const hasGrade = isValidGrade(second);
        const dataStr = isDateString(fourth)
          ? fourth
          : isDateString(third)
            ? third
            : '-';
        const maxGrade = isValidGrade(third)
          ? third
          : isValidGrade(fourth)
            ? fourth
            : '100';

        return {
          nome,
          status: hasGrade ? 'Avaliado' : second === '-' ? 'Pendente' : second,
          nota: hasGrade ? second : null,
          notaMax: maxGrade,
          data: dataStr,
        };
      }

      if (parts.length === 3) {
        if (isLastItem && firstPartsCount >= 4 && !isDateString(third)) {
          return null;
        }
        const hasGrade = isValidGrade(second);
        if (isDateString(third)) {
          return {
            nome,
            status: hasGrade
              ? 'Avaliado'
              : second === '-'
                ? 'Pendente'
                : second,
            nota: hasGrade ? second : null,
            notaMax: null,
            data: third,
          };
        }

        return {
          nome,
          status: hasGrade ? 'Avaliado' : second === '-' ? 'Pendente' : second,
          nota: hasGrade ? second : null,
          notaMax: !isLastItem && isValidGrade(third) ? third : null,
          data: '-',
        };
      }

      if (isDateString(second)) {
        return {
          nome,
          status: 'Concluído',
          nota: null,
          notaMax: null,
          data: second,
        };
      }

      if (isValidGrade(second)) {
        return {
          nome,
          status: 'Avaliado',
          nota: second,
          notaMax: null,
          data: '-',
        };
      }

      return {
        nome,
        status: second === '-' ? 'Pendente' : second,
        nota: null,
        notaMax: null,
        data: '-',
      };
    })
    .filter((a): a is ParsedGradeActivity => Boolean(a && a.nome));
}

export function classifyActivityPhase(
  name: string,
  fallbackPhase: 1 | 2 | 3 = 1,
): 1 | 2 | 3 {
  const norm = normalizeName(name);

  if (
    norm.includes('1a verificacao') ||
    norm.includes('1a va') ||
    norm.includes('va 1') ||
    norm.includes('va1') ||
    norm.includes('fase 1') ||
    norm.includes('entrega 1') ||
    norm.includes('revisando conteudo - fase 1') ||
    norm.includes('revisando conteudo - fase1')
  ) {
    return 1;
  }
  if (
    norm.includes('2a verificacao') ||
    norm.includes('2a va') ||
    norm.includes('va 2') ||
    norm.includes('va2') ||
    norm.includes('fase 2') ||
    norm.includes('entrega 2') ||
    norm.includes('entrega 3') ||
    norm.includes('revisando conteudo - fase 2') ||
    norm.includes('revisando conteudo - fase2')
  ) {
    return 2;
  }
  if (
    norm.includes('3a verificacao') ||
    norm.includes('3a va') ||
    norm.includes('va 3') ||
    norm.includes('va3') ||
    norm.includes('fase 3') ||
    norm.includes('exame') ||
    norm.includes('final') ||
    norm.includes('entrega 4') ||
    norm.includes('entrega 5') ||
    norm.includes('entrega 6') ||
    norm.includes('entrega 7') ||
    norm.includes('revisando conteudo - fase 3') ||
    norm.includes('revisando conteudo - fase3')
  ) {
    return 3;
  }

  const matchAps = norm.match(
    /(?:aps\s*|atividade\s+pratica\s+supervisionada\s*)(\d+)/i,
  );
  if (matchAps && matchAps[1]) {
    const apsNum = parseInt(matchAps[1], 10);
    if (apsNum >= 13) return 3;
    if (apsNum >= 7) return 2;
    return 1;
  }

  const matchUnit = norm.match(
    /(?:unidade\s+tematica|unidade|ut|fixacao\s*-\s*unidade\s+tematica|daily\s*-\s*semana(?:\s*-)?)\s*(\d+)/i,
  );
  if (matchUnit && matchUnit[1]) {
    const unitNum = parseInt(matchUnit[1], 10);
    if (unitNum >= 9) return 3;
    if (unitNum >= 5) return 2;
    return 1;
  }

  const matchEntrega = norm.match(/(?:entrega)\s*(\d+)/i);
  if (matchEntrega && matchEntrega[1]) {
    const entNum = parseInt(matchEntrega[1], 10);
    if (entNum >= 4) return 3;
    if (entNum >= 2) return 2;
    return 1;
  }

  return fallbackPhase;
}

export function isEvaluativeActivity(name: string): boolean {
  const norm = normalizeName(name);

  if (
    (norm.startsWith('unidade tematica') ||
      norm.startsWith('unidade ') ||
      norm.startsWith('ut ')) &&
    !norm.includes('fixacao') &&
    !norm.includes('atividade')
  ) {
    return false;
  }
  if (
    norm.includes('guia de estudo') ||
    norm.includes('apresentacao da disciplina') ||
    norm.includes('plano de ensino') ||
    norm.includes('instrucoes para atividade') ||
    norm.includes('normas para producao') ||
    norm.includes('material')
  ) {
    return false;
  }

  return (
    norm.includes('verificacao') ||
    norm.includes('avaliacao') ||
    norm.includes('prova') ||
    norm.includes('va') ||
    norm.includes('fase') ||
    norm.includes('exame') ||
    norm.includes('entrega') ||
    norm.includes('aps') ||
    norm.includes('fixacao') ||
    norm.includes('revisando') ||
    norm.includes('arp') ||
    norm.includes('aprendi hoje') ||
    norm.includes('questionario') ||
    norm.includes('quiz') ||
    norm.includes('trabalho') ||
    norm.includes('aulas ao vivo') ||
    norm.includes('daily') ||
    norm.includes('tarefa') ||
    norm.includes('atividade') ||
    norm.includes('relatorio') ||
    norm.includes('depoimento') ||
    norm.includes('poster') ||
    norm.includes('anexo') ||
    norm.includes('caso') ||
    norm.includes('envio') ||
    norm.includes('poste aqui') ||
    norm.includes('envie aqui')
  );
}
