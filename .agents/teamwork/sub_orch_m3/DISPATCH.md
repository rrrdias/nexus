# DISPATCH — Sub-Orchestrator Milestone 3 (Frontend Timeline & Interventions UI)

## Mission
Orchestrate and deliver Milestone 3: Frontend Timeline Component, Intervention Form, Server Actions in Next.js, and Integration into Tab 3 ("Histórico & Tutoria") of `TutoriaDashboard.tsx`.

## Scope & Inputs
- Project scope document: `c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md`
- Original user request: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md`
- State folder: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m3`
- Working directory: `c:\Users\ricardo.dias\develop\projetos\nexus-core`
- Milestone 2 handoff report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m2\handoff.md` (Backend API contracts, endpoints, DTOs)
- Frontend survey report: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_survey_2\handoff.md` (UI component specifications)

## Deliverables
1. **Server Actions** in `apps/frontend/src/app/actions/tutoria.ts`:
   - `getTutoriaTimeline(matricula: string, atendimentoId?: string)` calling `GET /api/tutoria/aluno/:matricula/timeline`.
   - `createTutoriaIntervention(data: CreateInterventionInput)` calling `POST /api/tutoria/intervencoes`.
   - `getTutoriaTutores()` calling `GET /api/tutoria/tutores`.
   - All server actions using `fetchFromApi` which injects session Bearer token.
2. **Timeline Presentation Component** in `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`:
   - Vertical chronological timeline with connecting line.
   - Distinct badges, icons, and colors per event type (`abertura`, `mudanca_status`, `contato_enviado`, `intervencao_manual`, `passagem_bastao`, `finalizacao`, `reabertura`).
   - Author snapshot indicator: highlight "Você" when `tutorId === sessionUser.id`, "Tutor Titular", or "Tutor Colaborador".
   - Formatted timestamps (`dd/MM/yyyy às HH:mm`) and relative time ("há X horas/dias").
   - Display previous -> new status transitions, contact channels, notes/observations, and transition quotes.
   - Clean empty state and loading skeletons.
3. **Intervention Registration Form** in `apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx`:
   - Textarea for observations / pedagogical notes.
   - Channel selector: WhatsApp, E-mail, Telefone, AVA, Reunião, Outro.
   - Event type selector or automated type determination.
   - Instant optimistic UI update / timeline refresh after successful creation.
4. **Integration into Student Details Modal (`TutoriaDashboard.tsx`)**:
   - Update Tab 3 ("Histórico & Tutoria", lines 1782-1879) to replace static-only cards with:
     - Header summary with current status, primary tutor, and quick action to log intervention.
     - `TutoriaInterventionForm` component.
     - `TutoriaTimeline` component rendering full chronological events for `selectedStudent.matricula`.
5. **Verification**:
   - TypeScript typecheck (`npx tsc --noEmit -p apps/frontend/tsconfig.json` -> 0 errors).
   - Ensure clean imports, React 19 compliance, and Tailwind CSS v4 styling.

## Iteration Loop
Run Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
Ensure forensic integrity audit passes before approving the milestone.
When complete, write `handoff.md` in your state folder and send a completion message to parent.
