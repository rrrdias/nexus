# Handoff Report — Milestone 3: Frontend UI Components & TutoriaDashboard Integration

**Agent**: `m3_explorer_3` (teamwork_explorer)  
**Date**: 2026-11-10  
**Status**: COMPLETE  
**Target Milestone**: Milestone 3 (Frontend Timeline & Interventions UI)  
**State Folder**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_explorer_3`

---

## 1. Observation

Direct inspection of `apps/frontend` and `apps/backend` established the exact baseline, structures, and integration points:

### 1.1 Modal Structure and Current Tab 3 in `TutoriaDashboard.tsx`
- **File**: `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx` (lines 1290–1898)
- When a student is selected (`selectedStudent !== null`), a fixed-overlay modal (`max-w-5xl max-h-[92vh] overflow-hidden`) renders.
- The modal contains a fixed header (`lines 1296–1345`), a tab bar (`lines 1348–1387`), a scrollable content area, and a fixed footer (`lines 1882–1895`).
- The tab bar provides three views controlled by state `detailTab`:
  1. `acolhimento`: "Acolhimento & WhatsApp" (lines 1390–1635) — Kanban stepper, messaging templates, WhatsApp/E-mail actions.
  2. `diagnostico`: "Diagnóstico AVA & Materiais" (lines 1638–1780) — Navigation metrics and activity log items.
  3. `historico`: "Histórico & Tutoria" (lines 1782–1879) — Currently contains only a static 2-column grid:
     - **Card 1 ("Status Atual da Intervenção")**: displays Kanban stage badge, responsible tutor name (`selectedStudent.kanban_tutor_nome`), last contact date, communication channel, and resolution date.
     - **Card 2 ("Gestão de Carteira")**: button to mark as Evadido/Não Localizado (`handleUpdateStudentKanbanStatus("evadido")`) or Reativar (`handleUpdateStudentKanbanStatus("pendente")`), plus an external link to `/tutoria/kanban`.
- **Observed Gap**: In Tab 3, there is **no chronological timeline of events**, **no history of collaborative actions from other tutors**, and **no form to record new interventions or contacts directly from the modal**.

### 1.2 State Management in `TutoriaDashboard.tsx`
- **`sessionUser` Prop** (`lines 60-64`):
  ```typescript
  interface TutoriaDashboardProps {
    sessionUser: any // Serialized from NextAuth { id: string, name: string, email: string, isSuperAdmin: boolean }
  }
  ```
  `sessionUser.id` represents the currently authenticated tutor.
- **`selectedStudent` State** (`lines 100, 304–345`):
  Populated when clicking on a student row via `handleOpenStudentLogs(student)`.
  It invokes `getTutoriaStudentLogs(student.matricula, student.disciplina_id)` which returns `{ logs, discente, kanban }`.
  In `tutoria.service.ts:535-546`, `kanban` query includes:
  `k.id`, `k.status_kanban`, `k.tutor_responsavel_id`, `u.name AS tutor_nome`, `k.observacoes`, `k.canal_contato_utilizado`, `k.ultimo_contato_em`, `k.data_resolucao`.
  Currently, `TutoriaDashboard.tsx:325-334` maps these to `selectedStudent` as `kanban_card_id`, `status_kanban`, `kanban_canal`, `kanban_ultimo_contato`, `kanban_observacoes`, `kanban_tutor_nome`, and `kanban_data_resolucao`.
  *(Note: Adding `kanban_tutor_id: res.kanban.tutor_responsavel_id` directly equips the UI to detect whether the active user is the lead primary tutor).*
- **`detailTab` State** (`line 109`):
  `const [detailTab, setDetailTab] = useState<"acolhimento" | "diagnostico" | "historico">("acolhimento")`.
  Switches between the three sub-views.

### 1.3 Server Actions and Backend Contracts
- **Server Actions** (`apps/frontend/src/app/actions/tutoria.ts:263–493`):
  Already fully implemented and typed:
  - `getTutoriaTimeline(matricula: string, atendimentoId?: string): Promise<{ success: boolean; events: TimelineEvent[]; error?: string }>`
  - `createTutoriaIntervencao(data: CreateTutoriaIntervencaoInput): Promise<{ success: boolean; data?: any; id?: string; error?: string }>`
  - `transferirTutoriaBastao(id: string, data: TransferirTutoriaBastaoInput): Promise<{ success: boolean; card?: any; evento?: any; error?: string }>`
  - `getTutoresAtivos(): Promise<{ success: boolean; tutores: ActiveTutor[]; error?: string }>`
- **Backend Endpoints** (`apps/backend/src/tutoria/tutoria.controller.ts:94–140`):
  - `GET /api/tutoria/aluno/:matricula/timeline`
  - `POST /api/tutoria/intervencoes`
  - `POST /api/tutoria/kanban/:id/transferir`
  - `GET /api/tutoria/tutores`
- **Backend Event Schema** (`tutoria_atendimentos_historico`):
  Event types: `abertura`, `mudanca_status`, `contato_enviado`, `intervencao_manual`, `passagem_bastao`, `finalizacao`, `reabertura`.
  Fields: `id`, `atendimentoId`, `matricula`, `periodo`, `tipoEvento`, `autorId`, `autorNome`, `tutorResponsavelAnteriorId`, `tutorResponsavelNovoId`, `estadoAnterior`, `estadoNovo`, `canalContato`, `observacoes`, `metadata`, `createdAt`.

### 1.4 Frontend Primitives and UI Tooling
- Directory `apps/frontend/src/components/tutoria` does not exist yet. It will be created for the new components.
- Primitives available in `apps/frontend/src/components/ui`:
  `badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `table.tsx`, `textarea.tsx`.
- Icons available: `lucide-react` v1.16.0 (e.g. `PlusCircle`, `ArrowRight`, `Send`, `MessageCircle`, `Mail`, `Phone`, `FileText`, `Users`, `CheckCircle2`, `RefreshCw`, `Clock`, `Sparkles`, `AlertTriangle`).
- Baseline typecheck: `npx tsc --noEmit --project apps/frontend/tsconfig.json` runs cleanly with **0 errors**.

---

## 2. Logic Chain

1. **Hybrid Multi-Tutor Principle (R1 & Acceptance Criteria)**:
   Any authorized tutor viewing an enrolled student must be able to log pedagogical actions or direct contacts, but collaborative actions must never overwrite primary ownership (`tutor_responsavel_id`). All actions must be visibly audited in chronological order.
2. **Tab 3 as the Single Source of Truth for Student History**:
   Tab 3 ("Histórico & Tutoria") is the natural place in the details modal for tutors to see what other tutors have done (who called, what was discussed, what column shifts happened) and to register their own new interventions.
3. **Preserving Existing Actions**:
   The current Tab 3 contains essential actions: viewing current Kanban status and tutor, changing status to "evadido" (Não Localizado / Abandono), re-activating to "pendente", and navigating to the full Kanban board. Replacing Tab 3 completely would regress these features. Therefore, the optimal layout retains the status overview and carteira management at the top, inserts `TutoriaInterventionForm` in the middle, and renders `TutoriaTimeline` at the bottom.
4. **Lazy Loading for Performance**:
   Loading timeline events for every student on modal open would introduce unnecessary network traffic when tutors only intend to send a quick WhatsApp from Tab 1 or check AVA grades in Tab 2. Fetching `getTutoriaTimeline` lazily when `detailTab === "historico"` (or on student change while in Tab 3) optimizes latency.
5. **Component Decoupling**:
   - `TutoriaTimeline.tsx` should be purely presentational + state-aware (receiving `events`, `sessionUser`, `currentTutorId`, `isLoading`, `onRefresh`).
   - `TutoriaInterventionForm.tsx` handles form input, validation, submission via `createTutoriaIntervencao`, and fires `onSuccess(newEvent)`.
   - `TutoriaDashboard.tsx` coordinates state: when `onSuccess` fires, it updates `selectedStudent` (e.g. `kanban_ultimo_contato`, `status_kanban`, `kanban_canal`), updates the student list row in table, and triggers a timeline reload.

---

## 3. UI/UX Component Specifications

### 3.1 Component Specification: `TutoriaTimeline.tsx`

- **File Path**: `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`
- **Purpose**: Render a vertical chronological timeline illustrating all attendance lifecycle events, collaborative interventions, column changes, communications, and baton passes.

#### Props Interface
```typescript
import { TimelineEvent } from "@/app/actions/tutoria"

export interface TutoriaTimelineProps {
  events: TimelineEvent[]
  sessionUser?: {
    id?: string
    name?: string
    email?: string
    isSuperAdmin?: boolean
  }
  currentTutorId?: string | null
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
  emptyMessage?: string
  className?: string
}
```

#### Event Badges, Icons, and Visual Styling
Each `tipoEvento` maps to a distinct Lucide icon, badge color, and accent border:

| `tipoEvento` | Lucide Icon | Badge Styling | Accent Ring & Node | Description Display |
|---|---|---|---|---|
| `abertura` | `PlusCircle` | `bg-blue-50 text-blue-800 border-blue-200` | `bg-blue-100 text-blue-600 ring-white` | "Atendimento Aberto no Kanban" (initial stage) |
| `mudanca_status` | `ArrowRight` | `bg-purple-50 text-purple-800 border-purple-200` | `bg-purple-100 text-purple-600 ring-white` | "Transição de Etapa": `[Anterior] → [Novo]` |
| `contato_enviado` | `MessageCircle` / `Mail` / `Phone` / `Send` | `bg-emerald-50 text-emerald-800 border-emerald-200` | `bg-emerald-100 text-emerald-600 ring-white` | "Contato Realizado" + Canal badge (`WhatsApp`, `E-mail`, etc.) |
| `intervencao_manual`| `FileText` | `bg-indigo-50 text-indigo-800 border-indigo-200` | `bg-indigo-100 text-indigo-600 ring-white` | "Intervenção Pedagógica" |
| `passagem_bastao` | `Users` | `bg-amber-50 text-amber-800 border-amber-200` | `bg-amber-100 text-amber-600 ring-white` | "Passagem de Bastão" (Transferência de Titularidade) |
| `finalizacao` | `CheckCircle2` | `bg-teal-50 text-teal-800 border-teal-200` | `bg-teal-100 text-teal-600 ring-white` | "Atendimento Regularizado / Concluído" |
| `reabertura` | `RefreshCw` | `bg-slate-100 text-slate-800 border-slate-300` | `bg-slate-200 text-slate-700 ring-white` | "Atendimento Reaberto" |

#### Author Attribution Tags
The author of each event is tagged dynamically based on the current session user and the current primary tutor:
1. `event.autorId === sessionUser?.id`:
   `<span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">Você</span>`
2. `event.autorId === currentTutorId`:
   `<span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">Tutor Titular</span>`
3. Any other author:
   `<span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">Tutor Colaborador</span>`
- Followed by the author's full name (`event.autorNome || "Tutor"`).

#### Date/Time Formatting
- **Formatted Absolute Date**: `dd/MM/yyyy às HH:mm` via `Intl.DateTimeFormat("pt-BR")`.
- **Relative Time**: Pure, dependency-free calculation:
  - `< 60s` → `"agora há pouco"`
  - `< 60m` → `"há X min"`
  - `< 24h` → `"há X h"`
  - `== 1 dia` → `"ontem"`
  - `< 7 dias` → `"há X dias"`
  - `>= 7 dias` → `"dd/MM/yyyy"`
- Display relative time prominently in a pill badge (`text-[10px] text-gray-500 font-mono`) and absolute timestamp as `title` tooltip and secondary text.

#### State Handling
1. **Loading Skeletons**:
   When `isLoading === true`, display 3 pulsing skeleton items (`animate-pulse`) with placeholder circular nodes and grey text bars (`h-4 bg-gray-200 rounded`).
2. **Empty State**:
   When `!isLoading && events.length === 0`:
   Clean card with a `Clock` icon, title "Nenhum histórico registrado", and helper text "Este estudante ainda não possui eventos de auditoria ou intervenções registradas."
3. **Error State**:
   When `error` is present:
   Red alert box with message and a "Tentar novamente" button that triggers `onRefresh`.
4. **Header Bar**:
   Displays "Linha do Tempo de Atendimentos" with a counter badge (`events.length`) and a `RefreshCw` button (`onClick={onRefresh}`).

#### Complete Implementation Blueprint (`TutoriaTimeline.tsx`)
```tsx
"use client"

import React from "react"
import {
  Clock,
  PlusCircle,
  ArrowRight,
  Send,
  MessageCircle,
  Phone,
  Mail,
  FileText,
  Users,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  BookOpen,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TimelineEvent } from "@/app/actions/tutoria"

export interface TutoriaTimelineProps {
  events: TimelineEvent[]
  sessionUser?: {
    id?: string
    name?: string
    email?: string
    isSuperAdmin?: boolean
  }
  currentTutorId?: string | null
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
  emptyMessage?: string
  className?: string
}

const formatAbsoluteDateTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(",", " às")
  } catch {
    return dateStr
  }
}

const formatRelativeTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr)
    const diffMs = Date.now() - d.getTime()
    if (diffMs < 0) return "agora há pouco"
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return "agora há pouco"
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `há ${diffMin} min`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `há ${diffHours} h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return "ontem"
    if (diffDays < 7) return `há ${diffDays} dias`
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  } catch {
    return ""
  }
}

const getEventConfig = (tipoEvento: string, canalContato?: string | null) => {
  switch (tipoEvento) {
    case "abertura":
      return {
        label: "Abertura de Atendimento",
        icon: PlusCircle,
        nodeClass: "bg-blue-100 text-blue-700 ring-white",
        badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
      }
    case "mudanca_status":
      return {
        label: "Mudança de Etapa",
        icon: ArrowRight,
        nodeClass: "bg-purple-100 text-purple-700 ring-white",
        badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
      }
    case "contato_enviado": {
      let icon = Send
      if (canalContato === "whatsapp") icon = MessageCircle
      else if (canalContato === "email") icon = Mail
      else if (canalContato === "telefone") icon = Phone
      else if (canalContato === "ava") icon = BookOpen
      return {
        label: "Contato Enviado",
        icon,
        nodeClass: "bg-emerald-100 text-emerald-700 ring-white",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      }
    }
    case "intervencao_manual":
      return {
        label: "Intervenção Pedagógica",
        icon: FileText,
        nodeClass: "bg-indigo-100 text-indigo-700 ring-white",
        badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
      }
    case "passagem_bastao":
      return {
        label: "Passagem de Bastão",
        icon: Users,
        nodeClass: "bg-amber-100 text-amber-700 ring-white",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      }
    case "finalizacao":
      return {
        label: "Atendimento Regularizado",
        icon: CheckCircle2,
        nodeClass: "bg-teal-100 text-teal-700 ring-white",
        badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
      }
    case "reabertura":
      return {
        label: "Atendimento Reaberto",
        icon: RefreshCw,
        nodeClass: "bg-slate-200 text-slate-700 ring-white",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
      }
    default:
      return {
        label: tipoEvento || "Evento",
        icon: Clock,
        nodeClass: "bg-gray-100 text-gray-700 ring-white",
        badgeClass: "bg-gray-50 text-gray-700 border-gray-200",
      }
  }
}

export function TutoriaTimeline({
  events,
  sessionUser,
  currentTutorId,
  isLoading = false,
  error = null,
  onRefresh,
  emptyMessage = "Nenhum histórico registrado para este estudante.",
  className = "",
}: TutoriaTimelineProps) {
  // Ordenação cronológica garantida (mais recente primeiro na UI ou cronológica direta)
  // A UI de timeline exibe cronologia natural com eventos mais recentes facilmente identificáveis
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header da Timeline */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
            Linha do Tempo de Atendimentos & Auditoria
          </h4>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {events.length}
          </span>
        </div>

        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 px-2.5 text-xs text-gray-600 hover:text-indigo-600 cursor-pointer gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      </div>

      {/* Estado de Erro */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs font-semibold text-red-800 underline hover:no-underline cursor-pointer"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Estado Carregando (Skeletons) */}
      {isLoading && events.length === 0 && (
        <div className="space-y-4 py-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-start gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0 mt-1" />
              <div className="flex-1 space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado Vazio */}
      {!isLoading && !error && sortedEvents.length === 0 && (
        <div className="py-10 text-center bg-gray-50/70 rounded-xl border border-dashed border-gray-200 p-6 space-y-2">
          <Clock className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-xs font-semibold text-gray-600">{emptyMessage}</p>
          <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
            Utilize o formulário acima para registrar uma anotação pedagógica ou registrar um contato realizado.
          </p>
        </div>
      )}

      {/* Lista da Timeline Vertical com linha conectora */}
      {!isLoading && sortedEvents.length > 0 && (
        <div className="relative pl-6 sm:pl-8 space-y-5 pt-1">
          {/* Linha vertical conectora */}
          <div className="absolute top-3 bottom-3 left-3 sm:left-4 -ml-px w-0.5 bg-indigo-100" />

          {sortedEvents.map((event) => {
            const config = getEventConfig(event.tipoEvento, event.canalContato)
            const Icon = config.icon

            const isAuthorMe = sessionUser?.id && event.autorId === sessionUser.id
            const isAuthorPrimary = currentTutorId && event.autorId === currentTutorId

            return (
              <div key={event.id} className="relative group flex items-start gap-3">
                {/* Nó/Ícone da timeline posicionado sobre a linha */}
                <span
                  className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ring-4 shadow-2xs shrink-0 transition-transform group-hover:scale-105 ${config.nodeClass}`}
                  title={config.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>

                {/* Conteúdo do Card de Evento */}
                <div className="flex-1 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200/90 shadow-2xs hover:border-indigo-200 transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${config.badgeClass}`}>
                        {config.label}
                      </span>

                      {/* Tag do Autor */}
                      {isAuthorMe ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Você
                        </span>
                      ) : isAuthorPrimary ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          Tutor Titular
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          Tutor Colaborador
                        </span>
                      )}

                      <span className="text-xs font-semibold text-gray-800">
                        {event.autorNome || "Tutor"}
                      </span>
                    </div>

                    {/* Data/Hora: Relativo + Absoluto */}
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono" title={formatAbsoluteDateTime(event.createdAt)}>
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="font-semibold text-gray-600">{formatRelativeTime(event.createdAt)}</span>
                      <span className="hidden sm:inline text-gray-400">({formatAbsoluteDateTime(event.createdAt)})</span>
                    </div>
                  </div>

                  {/* Informação contextual de transição ou canal */}
                  {event.tipoEvento === "mudanca_status" && (event.estadoAnterior || event.estadoNovo) && (
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-purple-50/60 p-2 rounded-lg border border-purple-100">
                      <span className="capitalize">{event.estadoAnterior || "Sem status"}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                      <strong className="capitalize text-purple-900">{event.estadoNovo}</strong>
                    </div>
                  )}

                  {event.tipoEvento === "contato_enviado" && event.canalContato && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800">
                      <span className="font-medium text-gray-500">Canal:</span>
                      <strong className="capitalize bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {event.canalContato}
                      </strong>
                    </div>
                  )}

                  {/* Observações / Notas do Evento */}
                  {event.observacoes && (
                    <div className="text-xs text-gray-700 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 leading-relaxed whitespace-pre-wrap font-sans">
                      {event.observacoes}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

---

### 3.2 Component Specification: `TutoriaInterventionForm.tsx`

- **File Path**: `apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx`
- **Purpose**: Interactive form for registering collaborative pedagogical interventions, contacts, or internal notes directly to the audit timeline, with optional Kanban status advancement.

#### Props Interface
```typescript
export interface TutoriaInterventionFormProps {
  matricula: string
  atendimentoId?: string | null
  periodo?: string | null
  currentStatus?: string | null
  onSuccess?: (newEvent?: any) => void
  onCancel?: () => void
  className?: string
}
```

#### Form Controls and Interactions
1. **Tipo de Ação (Action Type Selector)**:
   Toggle between:
   - `intervencao_manual`: "Anotação Pedagógica / Diagnóstico" (Icon: `FileText`)
   - `contato_enviado`: "Contato Realizado" (Icon: `Send`)
2. **Canal de Contato (Channel Selector)**:
   Pills for channel selection:
   - `whatsapp` (Icon: `Phone` / `MessageCircle`)
   - `email` (Icon: `Mail`)
   - `telefone` (Icon: `Phone`)
   - `ava` (Icon: `BookOpen`)
   - `outro` (Icon: `Sparkles`)
3. **Observações (Textarea)**:
   - Minimum 5 characters required.
   - Dynamic placeholder according to selected `tipoEvento`.
   - Character count indicator.
4. **Atualizar Etapa Kanban (Checkbox & Stage Selection)**:
   - Checkbox: "Atualizar etapa no fluxo Kanban"
   - When checked, reveals options: `pendente` (A Contatar), `em_contato` (Em Contato), `em_recuperacao` (Em Acompanhamento), `revertido` (Regularizado).
5. **Feedback & States**:
   - `isSubmitting`: buttons disabled, spinner icon on submit button.
   - `formError`: displayed in a red banner.
   - On success: resets input, shows green check confirmation, and invokes `onSuccess(res.data)`.

#### Complete Implementation Blueprint (`TutoriaInterventionForm.tsx`)
```tsx
"use client"

import React, { useState } from "react"
import {
  FileText,
  Send,
  MessageCircle,
  Mail,
  Phone,
  BookOpen,
  Sparkles,
  RefreshCw,
  Check,
  AlertTriangle,
  Kanban,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createTutoriaIntervencao } from "@/app/actions/tutoria"

export interface TutoriaInterventionFormProps {
  matricula: string
  atendimentoId?: string | null
  periodo?: string | null
  currentStatus?: string | null
  onSuccess?: (newEvent?: any) => void
  onCancel?: () => void
  className?: string
}

export function TutoriaInterventionForm({
  matricula,
  atendimentoId,
  periodo = "2026-2",
  currentStatus = "pendente",
  onSuccess,
  onCancel,
  className = "",
}: TutoriaInterventionFormProps) {
  const [tipoEvento, setTipoEvento] = useState<"intervencao_manual" | "contato_enviado">("intervencao_manual")
  const [canalContato, setCanalContato] = useState<"whatsapp" | "email" | "telefone" | "ava" | "outro">("whatsapp")
  const [observacoes, setObservacoes] = useState("")
  const [updateKanban, setUpdateKanban] = useState(false)
  const [statusKanban, setStatusKanban] = useState(currentStatus || "em_contato")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmed = observacoes.trim()
    if (trimmed.length < 5) {
      setFormError("Informe as observações da intervenção (mínimo de 5 caracteres).")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await createTutoriaIntervencao({
        matricula,
        atendimentoId: atendimentoId || undefined,
        periodo: periodo || undefined,
        tipoEvento,
        canalContato: tipoEvento === "contato_enviado" ? canalContato : undefined,
        observacoes: trimmed,
        statusKanban: updateKanban ? statusKanban : undefined,
      })

      if (!res.success) {
        setFormError(res.error || "Erro ao registrar intervenção.")
        return
      }

      setObservacoes("")
      setFormSuccess(true)
      setTimeout(() => setFormSuccess(false), 3000)

      if (onSuccess) {
        onSuccess(res.data)
      }
    } catch (err: any) {
      setFormError(err?.message || "Falha na comunicação ao registrar intervenção.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          Registrar Intervenção Pedagógica
        </h4>
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setTipoEvento("intervencao_manual")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              tipoEvento === "intervencao_manual"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Anotação Interna
          </button>
          <button
            type="button"
            onClick={() => setTipoEvento("contato_enviado")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              tipoEvento === "contato_enviado"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Contato Realizado
          </button>
        </div>
      </div>

      {/* Seletor de Canal (exibido quando contato_enviado) */}
      {tipoEvento === "contato_enviado" && (
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-semibold text-gray-600 block">Canal utilizado para contato:</label>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-700 bg-emerald-50 border-emerald-300" },
              { id: "email", label: "E-mail", icon: Mail, color: "text-blue-700 bg-blue-50 border-blue-300" },
              { id: "telefone", label: "Telefone", icon: Phone, color: "text-amber-700 bg-amber-50 border-amber-300" },
              { id: "ava", label: "AVA / Mensagem", icon: BookOpen, color: "text-purple-700 bg-purple-50 border-purple-300" },
              { id: "outro", label: "Outro", icon: Sparkles, color: "text-gray-700 bg-gray-50 border-gray-300" },
            ].map((c) => {
              const Icon = c.icon
              const isSelected = canalContato === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCanalContato(c.id as any)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected ? `${c.color} ring-2 ring-indigo-400 font-semibold shadow-2xs` : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Textarea de Observações */}
      <div className="space-y-1">
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder={
            tipoEvento === "intervencao_manual"
              ? "Descreva o diagnóstico pedagógico, dificuldades reportadas pelo aluno ou alinhamentos realizados..."
              : "Descreva a abordagem de contato realizada, retorno do estudante ou próximos passos acordados..."
          }
          className="text-xs bg-white resize-none"
        />
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Mínimo 5 caracteres</span>
          <span>{observacoes.trim().length} caracteres</span>
        </div>
      </div>

      {/* Atualização Opcional do Kanban */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-gray-200 text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
          <input
            type="checkbox"
            checked={updateKanban}
            onChange={(e) => setUpdateKanban(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
          <span>Atualizar etapa do discente no Kanban</span>
        </label>

        {updateKanban && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-[11px]">Nova etapa:</span>
            <select
              value={statusKanban}
              onChange={(e) => setStatusKanban(e.target.value)}
              className="text-xs font-semibold py-1 px-2 rounded-md border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="pendente">A Contatar (Pendente)</option>
              <option value="em_contato">Em Contato</option>
              <option value="em_recuperacao">Em Acompanhamento</option>
              <option value="revertido">Regularizado</option>
            </select>
          </div>
        )}
      </div>

      {/* Alerta de Erro */}
      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Alerta de Sucesso */}
      {formSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Intervenção registrada com sucesso na linha do tempo!</span>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || observacoes.trim().length < 5}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 cursor-pointer shadow-xs"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Gravando...
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Salvar na Linha do Tempo
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
```

---

### 3.3 Integration Architecture in `TutoriaDashboard.tsx`

#### 1. Import Updates
In `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx`:
```typescript
// Add to actions import:
import {
  // ... existing imports ...
  getTutoriaTimeline,
  type TimelineEvent,
} from "@/app/actions/tutoria"

// Add new tutoria components:
import { TutoriaTimeline } from "@/components/tutoria/TutoriaTimeline"
import { TutoriaInterventionForm } from "@/components/tutoria/TutoriaInterventionForm"
```

#### 2. State Hooks for Timeline
Add to `TutoriaDashboard`:
```typescript
  // Timeline State
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  // Carregar Linha do Tempo Consolidada
  const loadTimeline = useCallback(async (matricula: string, cardId?: string) => {
    if (!matricula) return
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const res = await getTutoriaTimeline(matricula, cardId)
      if (res.success) {
        setTimelineEvents(res.events || [])
      } else {
        setTimelineError(res.error || "Erro ao carregar histórico de atendimentos.")
      }
    } catch (err: any) {
      setTimelineError(err?.message || "Falha na comunicação ao buscar linha do tempo.")
    } finally {
      setTimelineLoading(false)
    }
  }, [])
```

#### 3. Automatic Hydration on Tab Switch
Trigger timeline fetch when opening Tab 3:
```typescript
  // Carrega a timeline quando a aba 'historico' estiver ativa
  useEffect(() => {
    if (detailTab === "historico" && selectedStudent?.matricula) {
      loadTimeline(selectedStudent.matricula, selectedStudent.kanban_card_id)
    }
  }, [detailTab, selectedStudent?.matricula, selectedStudent?.kanban_card_id, loadTimeline])
```

#### 4. Handling `kanban_tutor_id` Preservation
In `handleOpenStudentLogs` (around line 325):
```typescript
        if (res.kanban) {
          setSelectedStudent((prev: any) => ({
            ...prev,
            kanban_card_id: res.kanban.id || prev?.kanban_card_id,
            kanban_tutor_id: res.kanban.tutor_responsavel_id || prev?.kanban_tutor_id,
            status_kanban: res.kanban.status_kanban || prev?.status_kanban,
            kanban_canal: res.kanban.canal_contato_utilizado || prev?.kanban_canal,
            kanban_ultimo_contato: res.kanban.ultimo_contato_em || prev?.kanban_ultimo_contato,
            kanban_observacoes: res.kanban.observacoes || prev?.kanban_observacoes,
            kanban_tutor_nome: res.kanban.tutor_nome || prev?.kanban_tutor_nome,
            kanban_data_resolucao: res.kanban.data_resolucao || prev?.kanban_data_resolucao,
          }))
          setKanbanSent(true)
        }
```

#### 5. Intervention Success Callback
```typescript
  const handleInterventionSuccess = (newEvent?: any) => {
    if (selectedStudent?.matricula) {
      loadTimeline(selectedStudent.matricula, selectedStudent.kanban_card_id)
    }
    if (newEvent) {
      setSelectedStudent((prev: any) => ({
        ...prev,
        kanban_ultimo_contato: newEvent.createdAt || new Date().toISOString(),
        kanban_canal: newEvent.canalContato || prev?.kanban_canal,
        status_kanban: newEvent.metadata?.statusKanban || prev?.status_kanban,
      }))
      if (newEvent.metadata?.statusKanban) {
        setStudents((prev) =>
          prev.map((s) =>
            s.matricula === selectedStudent?.matricula ? { ...s, status_kanban: newEvent.metadata.statusKanban } : s
          )
        )
      }
    }
    showToast("Intervenção pedagógica registrada com sucesso!", "success")
  }
```

#### 6. Replacement of Lines 1782–1879 in `TutoriaDashboard.tsx`
```tsx
            {/* Conteúdo da Aba 3: Histórico & Tutoria */}
            {detailTab === "historico" && (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {/* 1. Status Atual & Gestão de Carteira */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ficha do Atendimento */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Kanban className="w-4 h-4 text-purple-600" />
                        Status Atual da Intervenção
                      </span>
                      {renderKanbanStatusBadge(selectedStudent.status_kanban)}
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-gray-100">
                        <span className="text-gray-500">Tutor Responsável:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-gray-900">
                            {selectedStudent.kanban_tutor_nome || (selectedStudent.status_kanban ? (sessionUser?.name || "Você") : "Não atribuído")}
                          </strong>
                          {selectedStudent.kanban_tutor_id === sessionUser?.id && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Você
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-gray-100">
                        <span className="text-gray-500">Último Contato Realizado:</span>
                        <strong className="text-gray-900 font-mono">
                          {selectedStudent.kanban_ultimo_contato ? formatDateTime(selectedStudent.kanban_ultimo_contato) : "Nenhum registrado"}
                        </strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-gray-100">
                        <span className="text-gray-500">Canal de Comunicação:</span>
                        <span className="capitalize font-semibold text-gray-900">
                          {selectedStudent.kanban_canal || "WhatsApp"}
                        </span>
                      </div>
                      {selectedStudent.kanban_data_resolucao && (
                        <div className="flex justify-between py-1.5 border-b border-gray-100">
                          <span className="text-gray-500">Data de Regularização:</span>
                          <strong className="text-emerald-700 font-mono">
                            {formatDateTime(selectedStudent.kanban_data_resolucao)}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações de Gestão de Carteira */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Gestão de Carteira
                    </h4>
                    <p className="text-xs text-gray-500">
                      Caso o aluno não responda às tentativas de acolhimento ou tenha abandonado, marque como não localizado.
                    </p>

                    <div className="pt-2 flex flex-col gap-2">
                      {selectedStudent.status_kanban !== "evadido" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStudentKanbanStatus("evadido")}
                          disabled={sendingToKanban}
                          className="h-9 text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer justify-start gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Marcar como Não Localizado (Abandono)
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStudentKanbanStatus("pendente")}
                          disabled={sendingToKanban}
                          className="h-9 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 cursor-pointer justify-start gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reativar Atendimento no Kanban
                        </Button>
                      )}

                      <Link href="/tutoria/kanban" target="_blank">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-9 text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 cursor-pointer justify-start gap-2"
                        >
                          <Kanban className="w-4 h-4" />
                          Ver Quadro Kanban Completo
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* 2. Formulário Interativo de Nova Intervenção / Contato */}
                <div className="bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-blue-50/40 p-4 sm:p-5 rounded-xl border border-indigo-100 shadow-2xs">
                  <TutoriaInterventionForm
                    matricula={selectedStudent.matricula}
                    atendimentoId={selectedStudent.kanban_card_id}
                    periodo={periodo}
                    currentStatus={selectedStudent.status_kanban}
                    onSuccess={handleInterventionSuccess}
                  />
                </div>

                {/* 3. Linha do Tempo Cronológica Completa */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200/80 shadow-2xs">
                  <TutoriaTimeline
                    events={timelineEvents}
                    sessionUser={sessionUser}
                    currentTutorId={selectedStudent.kanban_tutor_id || null}
                    isLoading={timelineLoading}
                    error={timelineError}
                    onRefresh={() => loadTimeline(selectedStudent.matricula, selectedStudent.kanban_card_id)}
                  />
                </div>
              </div>
            )}
```

---

## 4. Caveats

1. **New Component Directory**: `apps/frontend/src/components/tutoria/` does not currently exist. The implementer must create this directory when adding `TutoriaTimeline.tsx` and `TutoriaInterventionForm.tsx`.
2. **Backend Timeline Table and Fallback**: The backend `getTimelineAluno` method already includes automatic legacy fallback to `tutoria_atendimentos_kanban` if no historical records exist yet. Hence, the timeline will render gracefully even for older students who only have legacy Kanban entries.
3. **Scrollable Modal Height**: Because the modal has `max-h-[92vh]` and the body has `overflow-y-auto`, nesting both the form and the timeline vertically inside Tab 3 maintains comfortable scrolling without breaking the fixed modal header or footer.
4. **No External Date Library Needed**: All date formatting is performed using native `Intl` and pure JavaScript calculations, avoiding any extra bundle overhead or missing dependency risks.

---

## 5. Conclusion

1. The frontend design and integration plan is completely defined, self-contained, and ready for immediate implementation by the Worker agent.
2. The design satisfies all requirements:
   - Preserves 100% of existing Tab 3 actions (status summary, evadido/reativar actions, link to Kanban).
   - Provides a comprehensive, beautiful `TutoriaTimeline` component with vertical connecting track, Lucide icons, status transitions, author badge logic ("Você" vs "Tutor Titular" vs "Tutor Colaborador"), dual date formatting, skeletons, empty states, and refresh callback.
   - Provides an ergonomic `TutoriaInterventionForm` supporting pedagogical notes, multi-channel contact logging (`whatsapp`, `email`, `telefone`, `ava`, `outro`), optional Kanban stage progression, and optimistic state synchronization.
3. Type safety is guaranteed by the contracts already existing in `apps/frontend/src/app/actions/tutoria.ts`.

---

## 6. Verification Method

To verify the implementation independently once applied:

1. **Frontend Typecheck**:
   ```pwsh
   npx tsc --noEmit --project apps/frontend/tsconfig.json
   ```
   *Expected outcome*: 0 errors.

2. **Frontend Build Verification**:
   ```pwsh
   npm run build --filter=@nexus-core/frontend
   ```
   *Expected outcome*: Build succeeds without TypeScript or Next.js build errors.

3. **Code & Layout Inspection**:
   - Check that `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx` exists and implements all props and event types.
   - Check that `apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx` exists and properly calls `createTutoriaIntervencao`.
   - Check that `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx` cleanly imports and mounts both components inside Tab 3 without deleting existing actions.
