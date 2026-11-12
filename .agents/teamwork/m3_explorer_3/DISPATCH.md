## 2026-11-10T21:45:22Z
Sender: 5e78f035-a206-421e-9e96-62fa21d6fe12
Priority: MESSAGE_PRIORITY_HIGH

You are m3_explorer_3 (teamwork_explorer) investigating UI components and integration for Milestone 3 of nexus-core.

MANDATORY INPUTS (read these first):
- Original request: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md
- Project scope: c:\Users\ricardo.dias\develop\projetos\nexus-core\PROJECT.md
- Milestone 3 scope: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\sub_orch_m3\SCOPE.md
- Frontend survey handoff: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\explorer_survey_2\handoff.md

Working directory: c:\Users\ricardo.dias\develop\projetos\nexus-core
Your state folder: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_explorer_3

MISSION:
Investigate frontend files:
1. `apps/frontend/src/app/tutoria/TutoriaDashboard.tsx`:
   - Inspect lines 1290-1890, specifically Tab 3 ("Histórico & Tutoria", lines 1782-1879).
   - Analyze state management (how `selectedStudent`, `sessionUser`, and tabs work).
   - How can Tab 3 be cleanly updated to include `TutoriaTimeline` and `TutoriaInterventionForm` while maintaining existing actions (status cards, link to kanban, reativar/evadir)?
2. Design component specifications for:
   - `apps/frontend/src/components/tutoria/TutoriaTimeline.tsx`:
     - Layout: vertical timeline with connecting line.
     - Event badges, icons (Lucide), color-coding for each `tipoEvento` (`abertura`, `mudanca_status`, `contato_enviado`, `intervencao_manual`, `passagem_bastao`, `finalizacao`, `reabertura`).
     - Tag for author: "Você" vs "Tutor Titular" vs "Tutor Colaborador".
     - Date/time formatting (both formatted date/time and relative time).
     - State handling: loading skeletons, empty state, error state, and refresh callback.
   - `apps/frontend/src/components/tutoria/TutoriaInterventionForm.tsx`:
     - Inputs: textarea for observations/notes, channel selector (`whatsapp`, `email`, `telefone`, `ava`, `outro`), action type.
     - Form state handling: submitting state, validation, error display, reset on success, and calling `onSuccess` callback.

DO NOT IMPLEMENT SOURCE CODE. Investigate and provide a comprehensive, actionable handoff report in:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\m3_explorer_3\handoff.md`

Update your `progress.md` and send a message back to the parent (conversation ID 5e78f035-a206-421e-9e96-62fa21d6fe12) when done.
