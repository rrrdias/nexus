# Explorer 1 Investigation Report: Kanban Multi-Tutor Lead Badge (F10) & Recent Intervention Pulse (F11)

**Subagent**: `explorer_m4_1` (explorer)  
**Parent Orchestrator**: `bbdce847-0504-4650-953c-f8176a495fb1`  
**Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core`  
**State Folder**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m4_1`  
**Date**: 2026-11-11T01:06:00Z  
**Scope**: Milestone 4 — Features F10 & F11 in `TutoriaKanbanClient.tsx`

---

## 1. Observation

### 1.1 Current Structure of `TutoriaKanbanClient.tsx`
- **File**: `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx` (1,635 lines).
- **Component Entry**:
  `export function TutoriaKanbanClient({ sessionUser }: TutoriaKanbanClientProps)` (line 101) receives `sessionUser: { id: string; name: string; email: string; isSuperAdmin: boolean }` from `page.tsx` (lines 34-39).
- **Kanban Columns**: 5 columns defined in `KANBAN_COLUMNS` (lines 53-99):
  1. `pendente`: "A Contatar"
  2. `em_contato`: "Em Contato"
  3. `em_recuperacao`: "Em Acompanhamento"
  4. `revertido`: "Regularizado"
  5. `evadido`: "Não Localizado"
- **Card Query & Ingestion**:
  `fetchKanban()` invokes `getTutoriaKanbanCards({ periodo, institution: "ead", search })` (lines 180-216), storing the array in state `cards`.
- **Card Rendering Loop**:
  Lines 1075-1203 map `colCards` into cards with draggable containers:
  - Top header (lines 1101-1114): `card.aluno_nome`, `card.matricula`, risk badge (`Crítico`, `Atenção`, `Em Dia`).
  - Middle body (lines 1116-1146): `card.disciplina_nome`, course & polo, `Tempo AVA` (`formatFriendlyDuration`), and quick italic observations `card.observacoes`.
  - Footer actions (lines 1148-1199): WhatsApp direct button (`handleOpenWhatsApp`) and chevron column mover (`ChevronLeft` / `ChevronRight`).
- **Deficiency Observed**:
  There is currently **NO tutor badge** or tutor identification rendered on the card (lines 1075-1203), nor in the edit modal (lines 1211-1358). Furthermore, there is **NO visual pulse or recent activity indicator** for cards with interventions within the last 48 hours.

### 1.2 Data Fields Available on Card Objects
- **Backend Schema** (`apps/backend/src/db/schema.ts`, lines 18-35):
  Table `tutoria_atendimentos_kanban`:
  - `tutorResponsavelId`: text (references `users.id`)
  - `tutorIniciadorId`: text (references `users.id`)
  - `ultimoContatoEm`: timestamp
  - `dataResolucao`: timestamp
  - `ultimaIntervencaoEm`: timestamp (`ultima_intervencao_em`)
  - `qtdIntervencoes`: integer (`qtd_intervencoes`, default 0)
- **Backend Query** (`apps/backend/src/tutoria/tutoria.service.ts`, lines 673-718):
  `SELECT DISTINCT ON (k.id)`:
  - `k.tutor_responsavel_id`
  - `u.name AS tutor_nome` (from `LEFT JOIN "user" u ON u.id = k.tutor_responsavel_id`)
  - `k.ultimo_contato_em`
  - `k.data_resolucao`
  - `k."createdAt"`
  - `k."updatedAt"`
  - *Note*: `k.ultima_intervencao_em` and `k.qtd_intervencoes` were added to the schema in M1 and updated in M2, but were not yet explicitly listed in the SELECT list of `getKanbanCards`.
- **Frontend Server Action Envelope** (`apps/frontend/src/app/actions/tutoria.ts`, lines 184-211):
  Returns raw objects from backend `/api/tutoria/kanban`, meaning fields arrive in snake_case (`tutor_nome`, `tutor_responsavel_id`, `ultimo_contato_em`, `updatedAt`, `createdAt`).

### 1.3 Baseline Verification Status
1. `npm test --prefix apps/backend`: 29/29 test suites passed, 137/137 tests passed cleanly.
2. `npx tsc --noEmit -p apps/frontend/tsconfig.json`: Passed with 0 errors.
3. `npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts`: 16/16 tests passed.
4. `npx tsx apps/frontend/src/lib/tutoria-adversarial.test.ts`: 47/47 tests passed.
5. `npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-empirical-challenge.test.ts`: 23/23 tests passed.

---

## 2. Logic Chain

### 2.1 Feature F10: Badge de Tutor Responsável no Kanban
1. **Multi-Tutor Hybrid Model Invariant**:
   Under the hybrid paradigm (R1/PROJECT.md), every student card has a single designated primary tutor (`tutor_responsavel_id`). Any collaborator tutor can log notes or move the card, but primary ownership never changes unless an explicit "Passagem de Bastão" is executed.
2. **Visual Hierarchy for the Tutor Badge**:
   - Every card must display who holds primary responsibility so tutors instantly know whose portfolio the student belongs to.
   - When `card.tutor_responsavel_id === sessionUser?.id` (or case-insensitive name match):
     The card belongs to the authenticated tutor! Display `"Você (Titular)"` with indigo styling (`bg-indigo-50 text-indigo-700 border-indigo-200/80`) and `<UserCheck className="w-3 h-3 text-indigo-600" />` to give the tutor instant visual feedback on their own caseload.
   - When assigned to a peer tutor (`card.tutor_nome` is present):
     Display `<Users className="w-3 h-3 text-slate-400" />` and the peer tutor's name with neutral styling (`bg-slate-50 text-slate-700 border-slate-200/80`) with `truncate max-w-[110px]` to prevent wrapping on narrow Kanban columns.
   - When unassigned / null:
     Display `<AlertTriangle className="w-3 h-3 text-amber-500" />` and `"Sem tutor"` with amber dashed styling (`bg-amber-50/60 text-amber-700 border-amber-200/60 border-dashed`).

### 2.2 Feature F11: Indicador de Intervenção Recente (48 Horas)
1. **Activity Timestamp Resolution**:
   - Primary timestamp: `card.ultima_intervencao_em || card.ultimaIntervencaoEm`.
   - Contact fallback: `card.ultimo_contato_em || card.ultimoContatoEm`.
   - Mutation fallback: `(card.qtd_intervencoes > 0 ? card.updatedAt : null)`.
2. **Recency Formula**:
   - `elapsedMs = Date.now() - new Date(rawTimestamp).getTime()`
   - Condition: `elapsedMs >= -300000 && elapsedMs <= 48 * 60 * 60 * 1000` (allowing 5m future clock skew).
   - If `card.qtd_intervencoes === 0` and `card.ultima_intervencao_em === null`: Card has zero interventions. Creation in Kanban is NOT an intervention, so it must not show the recent pulse badge.
3. **Pulse Animation Design**:
   - Uses Tailwind's standard `animate-ping` alongside a solid core dot:
     ```tsx
     <span className="relative flex h-1.5 w-1.5 shrink-0">
       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
       <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
     </span>
     ```
   - Badge styling: `inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs`.
   - Badge label: `<span>< 48h</span>` (or `<span>Recente</span>`) plus intervention count chip if `qtd_intervencoes > 0`.
   - Cards with activity older than 48 hours do NOT pulse, preventing clutter and visual fatigue.

---

## 3. Caveats

1. **Backend Query Column Ingestion**:
   In `apps/backend/src/tutoria/tutoria.service.ts` line 695, `k.ultima_intervencao_em` and `k.qtd_intervencoes` were missing from the explicit SELECT in `getKanbanCards`.
   - While frontend defensive fallback handles `card.ultimo_contato_em` and `card.updatedAt`, adding `k.ultima_intervencao_em` and `k.qtd_intervencoes` to that query will make data 100% faithful to the Drizzle schema.
2. **Kanban Card Width Constraints**:
   On standard 1920x1080 screens, a 5-column Kanban layout allocates ~200px-240px per column. Badges must be compact (`text-[10px]`, `px-1.5 py-0.5`, truncated text) so they do not cause card vertical explosion.
3. **Optimistic Local Updates**:
   When moving a card or transferring a tutor, local React state in `TutoriaKanbanClient` must update both `status_kanban`, `tutor_nome`, and reset `ultima_intervencao_em = new Date().toISOString()` optimistically before the background `fetchKanban()` reconciles with PostgreSQL.

---

## 4. Conclusion & Concrete Specifications for Worker

### 4.1 Utility Helpers to Embed in `TutoriaKanbanClient.tsx`
The Worker should place these pure helper functions at the top of `TutoriaKanbanClient.tsx` (or imported from a helper file):

```tsx
/**
 * Determina os dados e visual do Tutor Titular do card (F10)
 */
export function getLeadTutorInfo(card: any, sessionUser: any) {
  const tutorId = card.tutor_responsavel_id || card.tutorResponsavelId || null
  const tutorName =
    card.tutor_nome ||
    card.tutorResponsavelNome ||
    card.tutor_responsavel_nome ||
    card.tutorNome ||
    null

  const isMe = Boolean(
    (tutorId && sessionUser?.id && tutorId === sessionUser.id) ||
    (tutorName && sessionUser?.name && tutorName.trim().toLowerCase() === sessionUser.name.trim().toLowerCase())
  )

  return {
    tutorId,
    tutorName,
    isMe,
    hasTutor: Boolean(tutorId || tutorName),
  }
}

/**
 * Avalia se o atendimento teve intervenção/contato nas últimas 48 horas (F11)
 */
export function checkRecentIntervention(card: any, nowMs = Date.now()) {
  if (!card) {
    return { isRecent: false, elapsedHours: null, formattedRelative: "", interventionCount: 0 }
  }

  const count = Number(card.qtd_intervencoes || card.qtdIntervencoes || 0)
  const rawDate =
    card.ultima_intervencao_em ||
    card.ultimaIntervencaoEm ||
    card.ultimo_contato_em ||
    card.ultimoContatoEm ||
    (count > 0 ? card.updatedAt : null)

  if (!rawDate) {
    return { isRecent: false, elapsedHours: null, formattedRelative: "", interventionCount: count }
  }

  const dateObj = new Date(rawDate)
  const timeMs = dateObj.getTime()

  // Data inválida ou epoch 1970
  if (isNaN(timeMs) || timeMs <= 86400000) {
    return { isRecent: false, elapsedHours: null, formattedRelative: "", interventionCount: count }
  }

  const diffMs = nowMs - timeMs

  // Ignora anomalias no futuro distante (> 1 hora)
  if (diffMs < -3600000) {
    return { isRecent: false, elapsedHours: null, formattedRelative: "", interventionCount: count }
  }

  const MAX_48H_MS = 48 * 60 * 60 * 1000
  const isRecent = diffMs >= -300000 && diffMs <= MAX_48H_MS

  if (!isRecent) {
    return {
      isRecent: false,
      elapsedHours: Math.round(diffMs / 3600000),
      formattedRelative: "",
      interventionCount: count,
    }
  }

  const elapsedMinutes = Math.max(0, Math.floor(diffMs / 60000))
  const elapsedHours = Math.floor(elapsedMinutes / 60)

  let formattedRelative = "agora há pouco"
  if (elapsedMinutes >= 60) {
    formattedRelative = `há ${elapsedHours}h`
  } else if (elapsedMinutes >= 1) {
    formattedRelative = `há ${elapsedMinutes}min`
  }

  return {
    isRecent: true,
    elapsedHours,
    formattedRelative,
    interventionCount: count,
  }
}
```

### 4.2 JSX Snippet for the Kanban Card
Insert directly between the student header (line 1114) and the discipline block (line 1116) in `TutoriaKanbanClient.tsx`:

```tsx
{/* BADGES DE GOVERNANÇA: TUTOR RESPONSÁVEL (F10) & INTERVENÇÃO RECENTE (F11) */}
{(() => {
  const tutorInfo = getLeadTutorInfo(card, sessionUser)
  const recency = checkRecentIntervention(card)

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      {/* F10: Lead Tutor Badge */}
      {tutorInfo.isMe ? (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs"
          title="Você é o tutor responsável titular deste estudante"
        >
          <UserCheck className="w-3 h-3 text-indigo-600 shrink-0" />
          <span>Você (Titular)</span>
        </span>
      ) : tutorInfo.hasTutor ? (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs"
          title={`Tutor Titular: ${tutorInfo.tutorName}`}
        >
          <Users className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate max-w-[110px]">{tutorInfo.tutorName}</span>
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] italic text-amber-700 bg-amber-50/60 border border-amber-200/60 border-dashed"
          title="Nenhum tutor responsável atribuído"
        >
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
          <span>Sem tutor</span>
        </span>
      )}

      {/* F11: Recent Intervention Pulse Badge */}
      {recency.isRecent && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs"
          title={`Atividade recente registrada ${recency.formattedRelative}`}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span>&lt;48h</span>
          {recency.interventionCount > 0 && (
            <span
              className="text-[9px] px-1 py-0.2 rounded-full bg-emerald-200/70 text-emerald-800 font-mono font-bold"
              title={`${recency.interventionCount} intervenções`}
            >
              {recency.interventionCount}
            </span>
          )}
        </span>
      )}
    </div>
  )
})()}
```

### 4.3 Modal Enhancement for Lead Tutor & Baton Pass
In the Card Edit Modal (`selectedCard` modal, lines 1237-1250), add a dedicated section:
- Show current Tutor Responsável with appropriate badge (`Você (Titular)`, `Tutor: [Nome]`, or `Sem tutor atribuído`).
- Add a button `Passar Bastão` with `<ArrowRightLeft className="w-3.5 h-3.5" />` triggering `isBatonPassOpen`.

### 4.4 Proposed Backend SELECT Patch (Optional / Recommended)
In `apps/backend/src/tutoria/tutoria.service.ts` around line 695:
```diff
--- a/apps/backend/src/tutoria/tutoria.service.ts
+++ b/apps/backend/src/tutoria/tutoria.service.ts
@@ -694,6 +694,8 @@ export class TutoriaService {
           k.canal_contato_utilizado,
           k.ultimo_contato_em,
           k.data_resolucao,
+          k.ultima_intervencao_em,
+          k.qtd_intervencoes,
           k."createdAt",
           k."updatedAt",
```

---

## 5. Verification Method

To verify these implementations independently:
1. **TypeScript Typecheck**:
   ```powershell
   npx tsc --noEmit -p apps/frontend/tsconfig.json
   ```
2. **Component Challenge & Unit Suite**:
   ```powershell
   npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-empirical-challenge.test.ts
   ```
3. **Edge Case Verification Criteria**:
   - Ensure a card with `card.tutor_responsavel_id = sessionUser.id` renders `Você (Titular)` with `bg-indigo-50 text-indigo-700`.
   - Ensure a card with peer tutor renders peer's name with `bg-slate-50 text-slate-700`.
   - Ensure a card with null/undefined tutor renders `Sem tutor` with amber dashed border.
   - Ensure a card with `ultima_intervencao_em` <= 48h renders pulsing green dot with `<48h`.
   - Ensure a card with `ultima_intervencao_em` > 48h does NOT render pulse dot.
   - Ensure a card with 0 interventions does NOT render pulse dot.
