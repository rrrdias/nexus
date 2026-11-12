# Explorer 2 Investigation Report: Kanban Card Interactions, Drag-and-Drop Mechanics, Ownership Preservation (F13) & Testing Strategy (F10–F13)

**Subagent**: `explorer_m4_2` (explorer)  
**Parent Orchestrator**: `bbdce847-0504-4650-953c-f8176a495fb1`  
**Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core`  
**State Folder**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_m4_2`  
**Date**: 2026-11-11T01:10:00Z  
**Scope**: Milestone 4 — Features F10, F11, F12, F13 in `TutoriaKanbanClient.tsx` and Frontend Test Harness

---

## 1. Observation

Direct forensic examination of codebase files, event handlers, server actions, backend controllers, and existing test suites:

### 1.1 Drag-and-Drop Mechanics in `TutoriaKanbanClient.tsx`
- **File**: `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`
- **DnD Implementation**:
  Lines 432–447:
  ```tsx
  // Suporte a HTML5 Drag & Drop
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData("text/plain", cardId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const cardId = e.dataTransfer.getData("text/plain")
    if (cardId) {
      handleMoveCard(cardId, targetStatus)
    }
  }
  ```
- **Column Event Wire-up**:
  Lines 1044–1050:
  ```tsx
  <div
    key={col.id}
    onDragOver={handleDragOver}
    onDrop={(e) => handleDrop(e, col.id)}
    className={`flex flex-col bg-gray-50/70 border border-gray-200 rounded-xl min-h-[580px] shadow-2xs border-t-4 ${col.color}`}
  >
  ```
- **Card Draggable Wire-up**:
  Lines 1094–1100:
  ```tsx
  <div
    key={card.id}
    draggable
    onDragStart={(e) => handleDragStart(e, card.id)}
    onClick={() => handleOpenEdit(card)}
    className="p-3 bg-white rounded-lg border border-gray-200 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer space-y-2 group"
  >
  ```
- **Alternative / Accessible Column Movement**:
  Lines 1171–1198 provide manual Chevron buttons (`ChevronLeft` and `ChevronRight`) in the card footer:
  ```tsx
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      handleMoveCard(card.id, KANBAN_COLUMNS[colIndex - 1].id)
    }}
    ...
  ```
- **Technology Choice**: Uses standard HTML5 native Drag and Drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`). No external library (`@hello-pangea/dnd`, `dnd-kit`, etc.) is used.

### 1.2 Column Move Dispatching & Ownership Preservation (F13)
- **Frontend Mutation Dispatch**:
  Lines 223–244 of `TutoriaKanbanClient.tsx`:
  ```tsx
  const handleMoveCard = async (cardId: string, newStatus: string, canal?: string) => {
    // Otimista
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, status_kanban: newStatus } : c))
    )

    try {
      const payload: any = { statusKanban: newStatus }
      if (canal) payload.canalContatoUtilizado = canal
      const res: any = await updateTutoriaKanbanCard(cardId, payload)
      if (res && res.success === false) {
        showToast(res.error || "Erro ao atualizar status do atendimento.", "error")
      } else {
        showToast(`Status atualizado com sucesso.`, "success")
      }
      fetchKanban()
    } catch (err: any) {
      console.error("Erro ao mover cartão:", err)
      showToast(err?.message || "Erro ao mover cartão de atendimento.", "error")
      fetchKanban()
    }
  }
  ```
  - Crucial observation: The optimistic update `setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status_kanban: newStatus } : c)))` preserves `c.tutor_responsavel_id` and `c.tutor_nome` verbatim.
  - The network payload `{ statusKanban: newStatus }` contains **zero** tutor ownership fields.
- **Server Action**:
  Lines 229–246 of `apps/frontend/src/app/actions/tutoria.ts`:
  ```typescript
  export async function updateTutoriaKanbanCard(
    id: string,
    data: UpdateKanbanCardInput,
  ) {
    try {
      const res = await fetchFromApi(`/api/tutoria/kanban/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      return { success: true, ...res }
    } ...
  ```
- **Backend Authentication & Audit Trail Logging**:
  Lines 157–171 of `apps/backend/src/tutoria/tutoria.controller.ts`:
  ```typescript
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
  ```
  Lines 1049–1078 of `apps/backend/src/tutoria/tutoria.service.ts`:
  ```typescript
  // MULTI-TUTOR HYBRID OWNERSHIP INVARIANT:
  // Never mutate tutor_responsavel_id here! Collaborators moving cards or notes do NOT steal ownership.

  if (statusMudou || observacoesMudou || canalMudou) {
    updates.push(sql`ultima_intervencao_em = now()`);
    updates.push(sql`qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1`);
  }

  const setClause = sql.join(updates, sql`, `);
  await this.db.execute(sql`
    UPDATE tutoria_atendimentos_kanban
    SET ${setClause}
    WHERE id = ${id};
  `);

  if (statusMudou) {
    const eventId: string = crypto.randomUUID();
    await this.db.execute(sql`
      INSERT INTO tutoria_atendimentos_historico (
        id, atendimento_id, matricula, periodo, "sourceInstitution",
        tipo_evento, autor_id, autor_nome, estado_anterior, estado_novo,
        observacoes, "createdAt"
      ) VALUES (
        ${eventId}, ${card.id}, ${card.matricula}, ${card.periodo || '2026-2'},
        ${card.sourceInstitution || 'ead'}, 'mudanca_status', ${autorId || null},
        ${autorNome}, ${estadoAnterior}, ${dto.statusKanban},
        ${cleanObs ? cleanObs : null}, now()
      );
    `);
  }
  ```

### 1.3 Session User Identification in Frontend
- **Page Prop Propagation**:
  Lines 34–43 of `apps/frontend/src/app/tutoria/kanban/page.tsx`:
  ```tsx
  const safeSessionUser = {
    id: String(session.user.id || ""),
    name: String(session.user.name || ""),
    email: String(session.user.email || ""),
    isSuperAdmin: !!(session.user as any)?.isSuperAdmin,
  }

  return (
    <div className="space-y-6">
      <TutoriaKanbanClient sessionUser={safeSessionUser} />
    </div>
  )
  ```
- **Component Access**:
  `TutoriaKanbanClient` receives `sessionUser` directly as a prop (`sessionUser.id`, `sessionUser.name`).
- **Server Action Bearer Token**:
  In `apps/frontend/src/app/actions/api.ts` (lines 8–14, 25), `fetchFromApi` extracts `session?.user?.accessToken` and sends `Authorization: Bearer ${token}`. The NestJS JWT guard (`JwtAuthGuard`) verifies the token and populates `req.user`.

### 1.4 Current Card Layout and Missing Features
Lines 1094–1199 of `TutoriaKanbanClient.tsx`:
- Top: Student name, matricula, risk badge.
- Middle: Course & polo, Tempo AVA (`formatFriendlyDuration`), italic observations.
- Footer: WhatsApp button, and left/right chevron mover buttons.
- Currently:
  - **No Lead Tutor Badge (F10)** is rendered on the card.
  - **No Pulse Indicator (F11)** is rendered for cards active within 48h.
  - **No Baton Pass trigger (F12)** exists on the card or in the card edit modal (`selectedCard`).

### 1.5 Existing Frontend Test Harnesses
1. `apps/frontend/src/lib/tutoria-e2e.test.ts`: 16/16 tests passing (`npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts`).
2. `apps/frontend/src/lib/tutoria-adversarial.test.ts`: 47/47 tests passing (`npx tsx apps/frontend/src/lib/tutoria-adversarial.test.ts`).
3. `apps/frontend/src/lib/tutoria-empirical-challenge.test.ts`: 23/23 tests passing (`npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-empirical-challenge.test.ts`).

---

## 2. Logic Chain

### 2.1 Drag-and-Drop Architecture & Event Lifecycle
1. **Lightweight HTML5 Native Implementation**:
   - The current implementation uses browser-native HTML5 Drag and Drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`).
   - Why this is superior here: No third-party drag-and-drop dependencies (such as `@hello-pangea/dnd` or `dnd-kit`) are required. This avoids React 19 / Next.js 16 hydration and SSR mismatches, avoids DOM reparenting glitches, and maintains lightning-fast bundle performance.
   - Dual accessibility: Keyboard and touch users are supported through the chevron mover buttons (`ChevronLeft` / `ChevronRight`) in the card footer, which invoke the exact same `handleMoveCard` logic.

2. **Card State Synchronization Flow**:
   - Step 1: User drags card or clicks chevron.
   - Step 2: Optimistic update sets `status_kanban` in React state immediately for zero perceived latency.
   - Step 3: `updateTutoriaKanbanCard(cardId, { statusKanban: newStatus })` executes Server Action.
   - Step 4: Server Action dispatches `PATCH /api/tutoria/kanban/:id` with bearer JWT.
   - Step 5: Backend updates column, increments intervention count, updates timestamp, and writes `mudanca_status` audit record.
   - Step 6: `fetchKanban()` reconciles authoritative data from PostgreSQL.
   - Step 7: In case of network failure, toast notifies user and `fetchKanban()` rolls back the optimistic state.

### 2.2 Preservation of `tutor_responsavel_id` (F13 Invariant)
1. **Frontend Non-Interference**:
   - `handleMoveCard` only constructs `{ statusKanban: newStatus }`. It never includes `tutorResponsavelId`.
   - `handleSaveEdit` (when editing notes and status inside the modal) only constructs `{ statusKanban, observacoes, canalContatoUtilizado }`.
2. **Backend Immutable Enforcement**:
   - In `apps/backend/src/tutoria/tutoria.service.ts:1049-1051`, `updateKanbanCard` contains an explicit structural invariant:
     `tutor_responsavel_id` is excluded from the SQL update fields.
   - Only `transferirTutor` (`POST /api/tutoria/kanban/:id/transferir`) can mutate `tutor_responsavel_id`, and it requires a mandatory pedagogical note (`notaTransicao >= 5 chars`).
3. **Audit Trail Attribution**:
   - The backend records the acting tutor (`req.user.id` and `req.user.name`) as `autor_id` and `autor_nome` in `tutoria_atendimentos_historico`.
   - Result: If Tutor B moves a card belonging to Tutor A, the card remains owned by Tutor A, but the timeline records: *"Tutor B moveu de 'A Contatar' para 'Em Contato'"*.

### 2.3 Baton Pass Trigger Placement Strategy (F12 Integration)
To provide the most intuitive and ergonomic UX, the Baton Pass action must reside in **two integration points**:
1. **Integration Point A — Quick Action on Kanban Card Footer**:
   - Place a compact action button directly next to the WhatsApp button in the card footer:
     `<Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setBatonPassCard(card); }} className="h-7 px-2 text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded cursor-pointer gap-1" title="Passar bastão / Transferir tutor">`
     `<ArrowRightLeft className="w-3 h-3 text-purple-600" /> Passar Bastão </Button>`
   - `e.stopPropagation()` is critical: It prevents triggering the card's `onClick={() => handleOpenEdit(card)}` handler.
2. **Integration Point B — Dedicated Section in Card Edit/Details Modal (`selectedCard`)**:
   - In `selectedCard` modal body (between "Telefone/Polo" and "Status no Kanban"):
     Render a distinct card highlighting the current lead tutor:
     - Avatar/User icon with current tutor name (`selectedCard.tutor_nome || "Nenhum tutor atribuído"`).
     - Action button: `<Button type="button" variant="outline" size="sm" onClick={() => setBatonPassCard(selectedCard)} className="gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"> <ArrowRightLeft className="w-3.5 h-3.5" /> Transferir Atendimento </Button>`.
3. **Modal Component Placement**:
   - At the bottom of `TutoriaKanbanClient.tsx`, mount `<BatonPassDialog>` controlled by `batonPassCard`:
     ```tsx
     {batonPassCard && (
       <BatonPassDialog
         open={Boolean(batonPassCard)}
         onOpenChange={(open) => !open && setBatonPassCard(null)}
         card={batonPassCard}
         sessionUser={sessionUser}
         onSuccess={(updatedCard) => {
           setBatonPassCard(null)
           if (selectedCard && selectedCard.id === updatedCard.id) {
             setSelectedCard((prev: any) => ({ ...prev, ...updatedCard }))
           }
           fetchKanban()
         }}
       />
     )}
     ```

### 2.4 Testing Strategy for Challenger & Reviewer Verification (F10–F13)
A standalone test suite `apps/frontend/src/lib/tutoria-kanban-m4.test.ts` should be provided, executing under:
`npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4.test.ts`

The test suite must cover four comprehensive tiers:
1. **Tier 1: F10 Lead Tutor Badge Logic**:
   - Evaluates `getLeadTutorInfo(card, sessionUser)`:
     - Case A: `card.tutor_responsavel_id === sessionUser.id` -> resolves `isMe: true`, label `"Você (Titular)"`.
     - Case B: `card.tutor_responsavel_id !== sessionUser.id` -> resolves `isMe: false`, label `card.tutor_nome`.
     - Case C: `card.tutor_responsavel_id == null` -> resolves `hasTutor: false`, label `"Sem titular"`.
     - Case D: Defensive resilience against null/undefined `sessionUser` or malformed card objects.
2. **Tier 2: F11 Recent Activity Indicator (< 48h Pulse Badge)**:
   - Evaluates `checkRecentIntervention(card, nowMs)`:
     - Case A: Activity within 48h (`ultima_intervencao_em` = now - 2h) -> `isRecent: true`.
     - Case B: Activity beyond 48h (`ultima_intervencao_em` = now - 50h) -> `isRecent: false`.
     - Case C: Fallback to `ultimo_contato_em` or `updatedAt` when `ultima_intervencao_em` is not present.
     - Case D: Future timestamps (within 5m clock skew allowance) -> `isRecent: true`.
     - Case E: Null, undefined, or invalid ISO string -> `isRecent: false` (no NaN, no throw).
3. **Tier 3: F12 BatonPassDialog Validation & Server Action Contracts**:
   - Evaluates `validateBatonPassInput(novoTutorId, currentTutorId, notaTransicao)`:
     - Rejects empty target tutor ID.
     - Rejects self-transfer (`novoTutorId === currentTutorId`).
     - Rejects note < 5 characters or whitespace only.
     - Accepts valid transfer payload with note >= 5 characters.
   - Evaluates `transferirTutoriaBastao(cardId, data)` Server Action:
     - Dispatches POST to `/api/tutoria/kanban/:id/transferir`.
     - Handles backend 200 OK, 400 Bad Request, and 404 Not Found cleanly.
   - Evaluates `getTutoresAtivos()` Server Action:
     - Returns `{ success: true, tutores: ActiveTutor[] }`.
4. **Tier 4: F13 Movimentação Kanban Preservando Posse**:
   - Invariant Check: Calling `handleMoveCard` generates payload with ONLY `statusKanban` (no `tutorResponsavelId`).
   - State Check: Optimistic update leaves `card.tutor_responsavel_id` and `card.tutor_nome` unchanged.
   - Audit Attribution: Simulates acting tutor (Tutor B) moving Tutor A's card; verifies audit record specifies `autor_id: Tutor B` while card remains assigned to `Tutor A`.
   - Error Recovery: Simulates network failure; verifies toast is triggered and state is refreshed.

---

## 3. Caveats

1. **Backend Query Projection for `ultima_intervencao_em`**:
   `apps/backend/src/tutoria/tutoria.service.ts` line 695: `k.ultima_intervencao_em` and `k.qtd_intervencoes` are in the database table, but were not explicitly listed in the SELECT list of `getKanbanCards`.
   - The frontend helper `checkRecentIntervention` must implement defensive fallbacks checking `card.ultima_intervencao_em || card.ultimaIntervencaoEm || card.ultimo_contato_em || card.updatedAt`.
   - Recommendation: Sub-orchestrator can also instruct Worker to add `k.ultima_intervencao_em, k.qtd_intervencoes` to the SELECT in `tutoria.service.ts` if within scope, or rely on the frontend fallback.
2. **Preventing Event Bubbling (`stopPropagation`)**:
   Because the entire card container has an `onClick={() => handleOpenEdit(card)}` handler, both the WhatsApp button and the new Baton Pass button must invoke `e.stopPropagation()` to prevent opening the general card edit modal concurrently.
3. **Card Width on 5-Column Grid**:
   On standard viewports, columns are narrow (~220px). The tutor badge, pulse indicator, and action buttons must use compact Tailwind styling (`text-[10px]`, `truncate`, `max-w-[120px]`) to maintain clean alignment and prevent vertical layout shifts.

---

## 4. Conclusion

1. **Drag-and-Drop**: Native HTML5 Drag and Drop in `TutoriaKanbanClient.tsx` is completely sound, lightweight, and works seamlessly with React 19. It should be retained as-is, alongside the existing accessible Chevron buttons.
2. **F13 Ownership Invariant**: Ownership preservation during card movement is fully guaranteed across both the frontend dispatch (`payload = { statusKanban: newStatus }`) and the backend `updateKanbanCard` service logic (which explicitly avoids modifying `tutor_responsavel_id` and writes audit trail records with `req.user` acting credentials).
3. **Baton Pass Dialog Integration**:
   - Button 1: On card footer next to WhatsApp (`ArrowRightLeft` icon with `e.stopPropagation()`).
   - Button 2: Inside the card edit modal in a dedicated "Tutor Responsável" panel.
   - Component: Mount `<BatonPassDialog>` controlled by `const [batonPassCard, setBatonPassCard] = useState<any | null>(null)`.
4. **Testing Suite Blueprint**:
   The test suite `tutoria-kanban-m4.test.ts` should be established with 18+ automated test cases covering F10, F11, F12, and F13, executable via `npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4.test.ts`.

---

## 5. Verification Method

### 5.1 Independent Verification Commands
```powershell
# 1. Typecheck the entire frontend workspace
npx tsc --noEmit -p apps/frontend/tsconfig.json

# 2. Run existing standalone test suites
npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts
npx tsx apps/frontend/src/lib/tutoria-adversarial.test.ts
npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-empirical-challenge.test.ts

# 3. Run backend unit & integration tests
npm test --prefix apps/backend -- src/tutoria/tutoria.service.spec.ts

# 4. Run the newly proposed Milestone 4 Kanban test suite (once created by Worker/Challenger)
npx tsx --tsconfig apps/frontend/tsconfig.json apps/frontend/src/lib/tutoria-kanban-m4.test.ts
```

### 5.2 Files to Inspect
1. `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx` — Verify drag-and-drop handlers, card badges, pulse indicator, and `BatonPassDialog` integration.
2. `apps/frontend/src/components/tutoria/BatonPassDialog.tsx` — Verify modal component, tutor selection, character counter, and server action dispatch.
3. `apps/frontend/src/lib/tutoria-utils.ts` — Verify `validateBatonPassInput` and `checkRecentIntervention` / `getLeadTutorInfo`.
4. `apps/frontend/src/app/actions/tutoria.ts` — Verify `transferirTutoriaBastao`, `updateTutoriaKanbanCard`, and `getTutoresAtivos`.
5. `apps/backend/src/tutoria/tutoria.service.ts` — Verify `updateKanbanCard` and `transferirTutor`.

### 5.3 Invalidation Conditions
- If dragging a card modifies `tutor_responsavel_id` on the card or in the database.
- If moving a card records the primary tutor instead of the acting collaborator in `tutoria_atendimentos_historico`.
- If clicking the baton pass button on a card triggers the parent card's edit modal due to missing `e.stopPropagation()`.
- If the recent activity pulse badge triggers on cards created over 48h ago without any logged interventions.
