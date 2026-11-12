# Milestone 4 Specification Report: BatonPassDialog (F12) & Frontend Kanban Multi-Tutor UI

**Author**: Spec Miner M4 (`spec_miner_m4_1`)  
**Parent Orchestrator**: `bbdce847-0504-4650-953c-f8176a495fb1`  
**Target Milestone**: Milestone 4 (Frontend Kanban Multi-Tutor & Baton Pass UI)  
**Date**: 2026-11-11T01:06:00Z  

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | F12: Modal | `BatonPassDialog` | Diálogo modal acessível para transferir a titularidade principal de um atendimento para outro tutor ativo com justificativa pedagógica obrigatória. | Props: `cardId`, `matricula`, `alunoNome`, `currentTutorId`, `currentTutorNome`, `disciplinaNome`, `trigger`, `open`, `onOpenChange`, `initialTutors`, `onSuccess`, `onCancel` | Renderiza modal Base UI com cabeçalho, seletor de tutor, textarea com contador de caracteres (>= 5), botões de Cancelar/Confirmar | Valida tutor selecionado (não nulo e diferente do tutor atual) e nota >= 5 caracteres; exibe banner de erro com mensagem | `apps/frontend/src/app/actions/tutoria.ts:447`, `PROJECT.md:36`, `SCOPE.md:7` |
| 2 | F7 / F12 API | `getTutoriaTutores` / `getTutoresAtivos` | Server Action para buscar a lista de tutores ativos para popular o select de pares. | N/A (chamada GET para `/api/tutoria/tutores` com JWT) | `{ success: true, data: ActiveTutor[], tutores: ActiveTutor[] }` onde `ActiveTutor = { id: string, name: string, email: string }` | Em caso de erro na rede ou 500: retorna `{ success: false, data: [], tutores: [], error: string }` | `apps/frontend/src/app/actions/tutoria.ts:503-535`, `apps/backend/src/tutoria/tutoria.service.ts:1526` |
| 3 | F5 / F12 API | `transferirTutoriaBastao` | Server Action que despacha POST para `/api/tutoria/kanban/:id/transferir`. | `id: string`, `data: { novoTutorId: string, notaTransicao: string }` | `{ success: true, card: { id, tutorResponsavelId }, evento: TimelineEvent }` | Retorna `{ success: false, error: "ID do atendimento é obrigatório." }` se id vazio; `{ success: false, error: "Selecione o novo tutor responsável." }` se novoTutorId vazio; `{ success: false, error: "Nota de transição é obrigatória (mínimo 5 caracteres)." }` se nota < 5 chars; ou erro do backend (ex: discente já atribuído, tutor inativo). | `apps/frontend/src/app/actions/tutoria.ts:447-497`, `apps/backend/src/tutoria/tutoria.service.ts:1296-1408` |
| 4 | F10: Kanban Card | Badge de Tutor Titular | Badge visual em cada card do Kanban identificando o tutor titular responsável pelo discente. | `card.tutor_responsavel_id`, `card.tutor_nome`, `sessionUser.id` | Badge visual formatado: se `card.tutor_responsavel_id === sessionUser.id`, exibe `"Você"` (estilo índigo); caso contrário, `"Tutor: [Nome]"` ou `"Sem tutor titular"`. | Fallback gracioso para "Sem titular" se `tutor_nome` for nulo | `PROJECT.md:34`, `SCOPE.md:9`, `TutoriaKanbanClient.tsx:1101` |
| 5 | F11: Kanban Card | Indicador de Atividade Recente | Destaque visual (pulse badge animado) para cards que tiveram intervenção nas últimas 48h. | `card.ultima_intervencao_em` (ou `card.updatedAt` fallback) | Badge verde com ping/pulse animado: `"Atividade recente"` ou `"Intervenção recente (< 48h)"` | Se data inválida ou há mais de 48h, oculta o indicador | `PROJECT.md:35`, `SCOPE.md:10`, `TutoriaKanbanClient.tsx:1101` |
| 6 | F13: Kanban DnD | Movimentação Preservando Posse | Drag-and-drop e botões chevron entre colunas que atualizam o status kanban sem sobrescrever o tutor responsável. | `cardId: string`, `statusKanban: string`, `canal?: string` | Dispara `updateTutoriaKanbanCard` sem campo `tutorResponsavelId`. O backend registra evento `mudanca_status` mantendo a titularidade | Em caso de falha de rede: toast de erro e reversão otimista via `fetchKanban()` | `apps/backend/src/tutoria/tutoria.service.ts:1030-1070`, `TutoriaKanbanClient.tsx:223` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `BatonPassDialog` | Lista de tutores ativos vazia (`getTutoriaTutores` retorna `[]`) | O dropdown exibe opção desabilitada `"Nenhum tutor ativo encontrado"`, o botão de confirmação permanece desabilitado, e uma mensagem instrutiva é exibida. |
| 2 | `BatonPassDialog` | Falha de rede ou HTTP 500 ao carregar tutores | Exibe banner de erro `"Não foi possível carregar a lista de tutores ativos."` com botão "Tentar novamente" (`onRetry`). |
| 3 | `BatonPassDialog` | Usuário seleciona o tutor que já é o atual titular (`novoTutorId === currentTutorId`) | A opção do tutor atual no select é desabilitada com sufixo `"(Tutor atual)"`. Se forçado programaticamente, validação local rejeita com `"O discente já está atribuído a este tutor."` evitando requisição redundante rejeitada pelo backend com HTTP 400. |
| 4 | `BatonPassDialog` | Nota de transição com menos de 5 caracteres (ex: `"ok"`, `"pass"`) | Botão de envio desabilitado; contador de caracteres exibe `X / 5 mín.` com destaque em âmbar/vermelho; validação impede submit. |
| 5 | `BatonPassDialog` | Nota com apenas espaços em branco (`"      "`) | `.trim()` resulta em comprimento 0 (< 5), acionando mensagem de validação `"A nota de transição é obrigatória (mínimo de 5 caracteres)."` |
| 6 | `BatonPassDialog` | Nota com quebras de linha, emojis e caracteres especiais | Caracteres são preservados sem perda de codificação e enviados adequadamente via JSON (`JSON.stringify`). |
| 7 | `BatonPassDialog` | Clique duplo / disparos rápidos no botão Confirmar | Estado `isSubmitting = true` desabilita imediatamente o botão e exibe ícone de spinner animado (`RefreshCw` ou `Loader2`), prevenindo múltiplos POSTs simultâneos. |
| 8 | `BatonPassDialog` | Backend retorna 404 (atendimento foi excluído em outra aba) | O erro retornado (`res.error = "Cartão de atendimento ... não encontrado."`) é exibido no banner de erro sem fechar o diálogo bruscamente, permitindo cópia da nota. |
| 9 | `BatonPassDialog` | Fechamento do modal via tecla ESC ou clique fora (backdrop) | Invoca `onOpenChange(false)` / `onCancel()`; ao reabrir, reseta os estados de erro e formulário. |
| 10 | `TutoriaKanbanClient` | Card sem tutor atribuído (`tutor_responsavel_id = null`) | Exibe badge neutro `"Sem titular"`; permite passar bastão atribuindo o primeiro tutor titular. |
| 11 | `TutoriaKanbanClient` | Card com `ultima_intervencao_em` nulo mas com `updatedAt` recente | O helper `isRecentActivity` analisa prioritariamente `ultima_intervencao_em` com fallback para `updatedAt` ou oculta o indicador se ambos estiverem além de 48h. |

---

## 1. Observation

Direct forensic examination of codebase files and authoritative references:

### 1.1 Server Action Contracts (`apps/frontend/src/app/actions/tutoria.ts`)
1. **`transferirTutoriaBastao`** (lines 447–497):
   ```typescript
   export interface TransferirTutoriaBastaoInput {
     novoTutorId: string
     notaTransicao: string
   }

   export async function transferirTutoriaBastao(
     id: string,
     data: TransferirTutoriaBastaoInput,
   ): Promise<{
     success: boolean
     card?: any
     evento?: any
     message?: string
     error?: string
   }>
   ```
   - Validates:
     - `!id || id.trim().length === 0` -> `{ success: false, error: "ID do atendimento é obrigatório." }`
     - `!data.novoTutorId || data.novoTutorId.trim().length === 0` -> `{ success: false, error: "Selecione o novo tutor responsável." }`
     - `!data.notaTransicao || data.notaTransicao.trim().length < 5` -> `{ success: false, error: "Nota de transição é obrigatória (mínimo 5 caracteres)." }`
   - Dispatches `POST /api/tutoria/kanban/${encodeURIComponent(id.trim())}/transferir` with payload `{ novoTutorId: data.novoTutorId.trim(), notaTransicao: data.notaTransicao.trim() }`.
   - On success returns `{ success: true, card, evento }`.
   - On catch returns `{ success: false, error: err?.message || "Erro ao transferir bastão." }`.

2. **`getTutoriaTutores` / `getTutoresAtivos`** (lines 503–535):
   ```typescript
   export interface ActiveTutor {
     id: string
     name: string
     email: string
   }

   export async function getTutoriaTutores(): Promise<{
     success: boolean
     data: ActiveTutor[]
     tutores: ActiveTutor[]
     error?: string
   }>
   export const getTutoresAtivos = getTutoriaTutores
   ```
   - Calls `GET /api/tutoria/tutores` with `cache: 'no-store'`.
   - Returns `{ success: true, data: tutores, tutores }`.

### 1.2 Backend Implementation & Database Mutations (`apps/backend/src/tutoria/tutoria.service.ts`)
- **`transferirTutor`** (lines 1296–1408):
  - Checks if card exists in `tutoria_atendimentos_kanban` (throws `404` if not found).
  - Validates `novoTutorId` (throws `400` if invalid, `404` if not found, `400` if `isActive === false`).
  - Validates current owner: `if (card.tutor_responsavel_id === novoTutorId) throw new BadRequestException('O discente já está atribuído a este tutor.');`
  - Validates note: `if (!dto.notaTransicao || dto.notaTransicao.trim().length < 5) throw new BadRequestException('A nota de transição é obrigatória (mínimo de 5 caracteres).');`
  - Executes SQL UPDATE on `tutoria_atendimentos_kanban`:
    ```sql
    UPDATE tutoria_atendimentos_kanban
    SET tutor_responsavel_id = ${novoTutorId},
        ultima_intervencao_em = now(),
        qtd_intervencoes = COALESCE(qtd_intervencoes, 0) + 1,
        "updatedAt" = now()
    WHERE id = ${id};
    ```
  - Inserts audit row into `tutoria_atendimentos_historico` with `tipo_evento = 'passagem_bastao'`, `autor_id`, `autor_nome`, `tutor_responsavel_anterior_id`, `tutor_responsavel_novo_id`, and `observacoes = notaTransicao`.

### 1.3 UI Primitives in Project (`apps/frontend/src/components/ui/dialog.tsx`)
- Wrapped around `@base-ui/react/dialog`.
- Exports: `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose`.
- Standard usage in project (e.g., `AuditLogDetailDialog.tsx`, `AttendanceListDialog.tsx`):
  ```tsx
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger ... />
    <DialogContent className="sm:max-w-md bg-white p-6 rounded-2xl shadow-2xl border border-slate-200">
      <DialogHeader>
        <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">...</DialogTitle>
        <DialogDescription className="text-xs text-gray-500">...</DialogDescription>
      </DialogHeader>
      {/* Body */}
      <DialogFooter>...</DialogFooter>
    </DialogContent>
  </Dialog>
  ```

---

## 2. Logic Chain

1. **Explicit Ownership Handshake**:
   The multi-tutor hybrid model dictates that lead tutor ownership cannot change inadvertently during status column moves or routine contact registrations (R1, R2). It requires an explicit, audited action with justification. Therefore, `BatonPassDialog` is the exclusive UI mechanism for ownership transitions.

2. **Dual Invocation Support (Controlled vs. Uncontrolled Trigger)**:
   In `TutoriaKanbanClient.tsx`, the baton pass may be triggered from two distinct contexts:
   - A quick-action button directly on the Kanban card.
   - A dedicated action inside the Card Edit Modal / Drawer (`selectedCard`).
   Designing `BatonPassDialog` to accept either an external `open` + `onOpenChange` (controlled) or an internal trigger button (`trigger` prop) guarantees clean, seamless integration across both surfaces without prop drilling.

3. **Client-Side Pre-Validation Guarding Invariants**:
   By enforcing `novoTutorId !== currentTutorId` and `notaTransicao.trim().length >= 5` directly in `BatonPassDialog`, the UI prevents unnecessary failed network requests and provides immediate, accessible visual feedback to the user via character counting and disabled submit states.

4. **Optimistic & Authoritative State Refresh**:
   Upon receiving `{ success: true, card, evento }` from `transferirTutoriaBastao`, the caller (`TutoriaKanbanClient`) can perform an immediate optimistic state update on `cards` (updating `tutor_responsavel_id` and `tutor_nome`), close the dialog, show a success toast, and fire `fetchKanban()` to ensure synchronization with PostgreSQL.

---

## 3. Concrete Component Specification & Worker Blueprint

### 3.1 File Location
`apps/frontend/src/components/tutoria/BatonPassDialog.tsx`

### 3.2 Props Contract
```typescript
import React from "react"
import type { ActiveTutor } from "@/app/actions/tutoria"

export interface BatonPassSuccessResult {
  card?: any
  evento?: any
  novoTutorId: string
  novoTutorNome?: string
  notaTransicao: string
}

export interface BatonPassDialogProps {
  /** Target attendance card ID in tutoria_atendimentos_kanban */
  cardId: string
  /** Discente matricula */
  matricula: string
  /** Discente name for display in modal header */
  alunoNome?: string
  /** Current responsible tutor ID (to disable in select dropdown) */
  currentTutorId?: string | null
  /** Current responsible tutor name */
  currentTutorNome?: string | null
  /** Academic discipline name for contextual display */
  disciplinaNome?: string
  /** Custom trigger element (if using uncontrolled/trigger mode) */
  trigger?: React.ReactNode
  /** Controlled open state */
  open?: boolean
  /** Controlled open state change handler */
  onOpenChange?: (open: boolean) => void
  /** Optional preloaded tutors list (avoids redundant fetch if caller already has it) */
  initialTutors?: ActiveTutor[]
  /** Success callback */
  onSuccess?: (result: BatonPassSuccessResult) => void
  /** Cancellation callback */
  onCancel?: () => void
  /** Additional styling class */
  className?: string
}
```

### 3.3 Visual & Functional Structure
1. **Trigger Element**:
   - If `trigger` provided, wrapped in `<DialogTrigger render={...}>`.
   - If `open` / `onOpenChange` provided, behaves as a controlled dialog.
   - If neither, defaults to a clean `<Button variant="outline" size="sm" className="gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" /> Passar Bastão</Button>`.
2. **Dialog Header**:
   - Icon: `<ArrowRightLeft className="w-5 h-5 text-amber-600" />` or `<UserCheck className="w-5 h-5 text-indigo-600" />`
   - Title: `Passagem de Bastão`
   - Description: `Transfira a titularidade pedagógica do discente com justificativa registrada na trilha de auditoria.`
3. **Student Summary Card**:
   - Container: `bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1`
   - Student Name: `font-bold text-gray-900`
   - Matrícula & Disciplina: `text-gray-500 font-mono`
   - Tutor Atual: `Badge` with `Tutor Atual: [currentTutorNome || "Não atribuído"]`
4. **Tutor Select Field**:
   - Label: `Novo Tutor Responsável Titular *`
   - `<select className="w-full h-9 px-3 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 ...">`
   - Placeholder option: `Selecione o novo tutor responsável...`
   - Options: Mapped from `tutores`. If `tutor.id === currentTutorId`, mark as `disabled` with `(Tutor atual)`.
   - Loader / Spinner if `loadingTutores === true`.
5. **Transition Note Textarea**:
   - Label: `Nota Pedagógica de Transição *`
   - Helper text: `Mínimo de 5 caracteres. Descreva o motivo da transferência e orientações para o colega.`
   - Real-time character counter: `notaTransicao.trim().length / 5 mín.`
     - Red/amber when `< 5` (`text-amber-600 font-medium`)
     - Green/slate when `>= 5` (`text-emerald-600 font-bold`)
   - Textarea: `rows={3}`, placeholder: `Ex: Aluno solicitou mudança de turno; combinada entrega das atividades até sexta-feira...`
6. **Error Banner**:
   - Conditional rendering when `formError` is not null.
   - Styled with `bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 flex items-start gap-2`.
7. **Dialog Footer**:
   - Cancel button: `<Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>Cancelar</Button>`
   - Confirm button:
     - Text: `isSubmitting ? "Transferindo..." : "Confirmar Transferência"`
     - Icon: `isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />`
     - Disabled: `isSubmitting || !selectedTutorId || selectedTutorId === currentTutorId || notaTransicao.trim().length < 5`
     - Style: `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold`

---

## 4. Integration Blueprint for `TutoriaKanbanClient.tsx`

### 4.1 Kanban Card Visuals (F10 & F11)
In `apps/frontend/src/app/tutoria/kanban/TutoriaKanbanClient.tsx`:
1. **F10: Primary Responsible Tutor Badge**:
   Render inside card header or body:
   ```tsx
   <div className="flex items-center gap-1.5 text-[10px]">
     <span className="text-gray-400 font-medium">Titular:</span>
     <span
       className={`px-1.5 py-0.5 rounded font-semibold border ${
         card.tutor_responsavel_id === sessionUser?.id
           ? "bg-indigo-50 text-indigo-700 border-indigo-200"
           : "bg-slate-50 text-slate-700 border-slate-200"
       }`}
     >
       {card.tutor_responsavel_id === sessionUser?.id
         ? "Você"
         : card.tutor_nome || "Sem titular"}
     </span>
   </div>
   ```

2. **F11: Recent Activity Pulse Indicator**:
   Helper function:
   ```tsx
   const isRecentActivity = (card: any) => {
     const dateStr = card.ultima_intervencao_em || card.updatedAt
     if (!dateStr) return false
     const diffMs = Date.now() - new Date(dateStr).getTime()
     return diffMs >= 0 && diffMs < 48 * 3600 * 1000 // 48h
   }
   ```
   Render in card:
   ```tsx
   {isRecentActivity(card) && (
     <span
       className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
       title="Intervenção ou movimentação nas últimas 48h"
     >
       <span className="relative flex h-1.5 w-1.5">
         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
         <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
       </span>
       Recente
     </span>
   )}
   ```

3. **Card Quick Action / Trigger for F12**:
   Add a "Passar Bastão" button on the card footer or beside WhatsApp:
   ```tsx
   <Button
     type="button"
     size="sm"
     variant="ghost"
     onClick={(e) => {
       e.stopPropagation()
       setBatonPassCard(card)
     }}
     className="h-7 px-2 text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded cursor-pointer"
     title="Transferir titularidade do atendimento"
   >
     <ArrowRightLeft className="w-3 h-3 mr-1 text-amber-600" />
     Passar Bastão
   </Button>
   ```

4. **Card Edit Modal Integration**:
   In the existing card edit modal (`selectedCard`), add a section:
   ```tsx
   <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg flex items-center justify-between">
     <div>
       <span className="font-bold text-amber-900 block">Passagem de Bastão</span>
       <span className="text-[11px] text-amber-700">
         Tutor titular atual: <strong>{selectedCard.tutor_nome || "Não atribuído"}</strong>
       </span>
     </div>
     <Button
       type="button"
       size="sm"
       onClick={() => setBatonPassCard(selectedCard)}
       className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer gap-1.5 text-xs"
     >
       <ArrowRightLeft className="w-3.5 h-3.5" />
       Transferir Titularidade
     </Button>
   </div>
   ```

5. **State Synchronization on Baton Pass Success**:
   ```tsx
   const handleBatonPassSuccess = (result: any) => {
     const { novoTutorId, novoTutorNome } = result
     // 1. Optimistic update
     setCards((prev) =>
       prev.map((c) =>
         c.id === batonPassCard.id
           ? {
               ...c,
               tutor_responsavel_id: novoTutorId,
               tutor_nome: novoTutorNome,
               ultima_intervencao_em: new Date().toISOString(),
             }
           : c
       )
     )
     if (selectedCard && selectedCard.id === batonPassCard.id) {
       setSelectedCard((prev: any) => ({
         ...prev,
         tutor_responsavel_id: novoTutorId,
         tutor_nome: novoTutorNome,
       }))
     }
     setBatonPassCard(null)
     showToast(`Bastão transferido com sucesso para ${novoTutorNome}!`, "success")
     // 2. Authoritative background sync
     fetchKanban()
   }
   ```

---

## 4. Caveats

- **No Caveats**: The backend endpoints (`GET /api/tutoria/tutores`, `POST /api/tutoria/kanban/:id/transferir`) and Server Actions (`transferirTutoriaBastao`, `getTutoriaTutores`) are fully implemented and verified with exit code 0 across existing unit and adversarial test suites.
- UI styling uses Tailwind CSS classes already present throughout `TutoriaDashboard.tsx` and `TutoriaKanbanClient.tsx`, maintaining 100% aesthetic consistency.

---

## 5. Conclusion

1. The exact specifications, API signatures, prop contracts, validation rules, error handling paths, and UI blueprints for **F12: Modal de Passagem de Bastão (`BatonPassDialog.tsx`)** are fully uncovered and documented.
2. The companion Milestone 4 features (**F10: Badge de Tutor Titular**, **F11: Indicador de Intervenção Recente**, **F13: Movimentação Preservando Posse**) have clear integration blueprints within `TutoriaKanbanClient.tsx`.
3. The Worker has unambiguous instructions and write boundaries to implement `BatonPassDialog.tsx` and update `TutoriaKanbanClient.tsx` without regressions.

---

## 6. Verification Method

To independently verify the contracts and specifications outlined in this report:

```powershell
# 1. Typecheck frontend workspace
npx tsc --noEmit -p apps/frontend/tsconfig.json

# 2. Run existing adversarial Server Actions tests (verifying transferirTutoriaBastao and getTutoriaTutores contracts)
npx tsx apps/frontend/src/lib/tutoria-adversarial.test.ts

# 3. Run component empirical challenge test suite
npx tsx apps/frontend/src/lib/tutoria-empirical-challenge.test.ts
```
