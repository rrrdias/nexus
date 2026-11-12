## 2026-11-11T00:37:35Z

You are m3_worker_1 (teamwork_worker) implementing Milestone 3: Frontend Timeline & Interventions UI.

Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
Your state folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_worker_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Context and Blueprints to Read:
1. ORIGINAL_REQUEST.md: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md
2. SCOPE.md: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m3_gen1\SCOPE.md
3. PROJECT.md: c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md
4. Explorer blueprints:
   - c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_explorer_1\handoff.md (Server Actions architecture and types)
   - c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_spec_miner_2\handoff.md (Backend API specifications and contracts)
   - c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_explorer_3\handoff.md (Full UI component code blueprints and Tab 3 integration)

YOUR EXCLUSIVE WRITE OWNERSHIP:
1. apps/frontend/src/app/actions/tutoria.ts:
   - Export types: `TutoriaTipoEvento`, `TutoriaCanalContato`, `TimelineEvent`, `ActiveTutor`, `TutorResponsavel`, `CreateInterventionInput`, `CreateTutoriaIntervencaoInput`, `TransferirTutoriaBastaoInput`.
   - Implement `getTutoriaTimeline(matricula, atendimentoId)` returning `{ success: boolean, data: TimelineEvent[], events: TimelineEvent[], error?: string }`.
   - Implement `createTutoriaIntervention(data)` returning `{ success: boolean, data?: TimelineEvent, id?: string, error?: string }` with alias `createTutoriaIntervencao`.
   - Implement `getTutoriaTutores()` returning `{ success: boolean, data: ActiveTutor[], tutores: ActiveTutor[], error?: string }` with alias `getTutoresAtivos`.
   - Maintain `transferirTutoriaBastao` for compatibility.
2. apps/frontend/src/components/tutoria/TutoriaTimeline.tsx:
   - Create directory `apps/frontend/src/components/tutoria/` if it does not exist.
   - Implement vertical timeline with line connecting nodes, Lucide icons, status changes, badges (`bg-*-50`, border, text), author badges ("Você" for sessionUser, "Tutor Titular" for lead tutor, "Tutor Colaborador" for others).
   - Show relative time (e.g. "há 5 min", "ontem") and absolute date (`dd/MM/yyyy às HH:mm`).
   - Implement loading skeletons, empty state card, error banner with retry button.
3. apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx:
   - Toggle between `intervencao_manual` and `contato_enviado`.
   - Channel selector pills (`whatsapp`, `email`, `telefone`, `ava`, `outro`) when contact is sent.
   - Textarea for notes (minimum 5 characters, character counter).
   - Checkbox for optional Kanban stage update (`pendente`, `em_contato`, `em_recuperacao`, `revertido`).
   - Feedback states (loading spinner on button, error message banner, success confirmation banner).
4. apps/frontend/src/app/tutoria/TutoriaDashboard.tsx:
   - Integrate `TutoriaTimeline` and `TutoriaInterventionForm` into Tab 3 ("Histórico & Tutoria") of student details modal.
   - Retain existing Status Overview ("Status Atual da Intervenção") and Carteira Management ("Gestão de Carteira") cards.
   - Insert `TutoriaInterventionForm` in middle and `TutoriaTimeline` below.
   - Add state and callback to load timeline lazily when Tab 3 is open, and reload timeline and update student state on successful intervention submit.

VERIFICATION COMMANDS:
You must run and document all commands in your handoff.md:
1. `npx tsc --noEmit -p apps/frontend/tsconfig.json` (Must pass with 0 errors)
2. `npx tsx apps/frontend/src/lib/tutoria-e2e.test.ts` (All 16 tests must pass)
3. `npm run build --filter=@nexus-core/frontend` (Build verification)

OUTPUT REQUIREMENTS:
Write your completion report in `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_worker_1\handoff.md`.
Then send a completion message back to me (the parent orchestrator).
