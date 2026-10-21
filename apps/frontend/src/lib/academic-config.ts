export const DEFAULT_PERIOD = process.env.NEXT_PUBLIC_NEXUS_DEFAULT_PERIOD || "2026-2";

function parseDate(value: string | undefined, fallback: string) {
  const source = value || fallback;
  const date = new Date(`${source}T00:00:00`);
  return isNaN(date.getTime()) ? new Date(`${fallback}T00:00:00`) : date;
}

export function getAcademicPhaseDates() {
  return {
    fase1: {
      inicio: parseDate(process.env.NEXT_PUBLIC_NEXUS_FASE1_START, "2026-08-01"),
      fim: parseDate(process.env.NEXT_PUBLIC_NEXUS_FASE1_END, "2026-09-23"),
    },
    fase2: {
      inicio: parseDate(process.env.NEXT_PUBLIC_NEXUS_FASE2_START, "2026-09-24"),
      fim: parseDate(process.env.NEXT_PUBLIC_NEXUS_FASE2_END, "2026-11-01"),
    },
    fase3: {
      inicio: parseDate(process.env.NEXT_PUBLIC_NEXUS_FASE3_START, "2026-11-02"),
      fim: parseDate(process.env.NEXT_PUBLIC_NEXUS_FASE3_END, "2026-12-19"),
    },
  };
}
