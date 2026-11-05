## 2026-10-23T12:10:37Z

Read ORIGINAL_REQUEST.md at c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\ORIGINAL_REQUEST.md.
Read PROJECT.md at c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\PROJECT.md.
Working Directory: c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_worker_resilience_1
Parent Conversation ID: 27e91390-bd43-444c-a451-05eaa934d0b8

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission:
Conduct deep technical audit and resilience optimization of External Integrations & Data Pipelines (R3):
1. `AvaSyncService` (Moodle AVA HTTP Deferred SQL) & BullMQ:
   - Trace HTTP timeout handling: examine why network errors and 120s timeouts are caught and converted to `status: 'queued'` (`ava-sync.service.ts:340`), tricking BullMQ into marking the job completed and bypassing exponential retry backoff.
   - Detail the absence of Dead-Letter Queue (DLQ) and lack of job deduplication (`jobId` based on institution + date).
2. `AcademicService` (Lyceum MSSQL via `tedious`):
   - Trace connection pool creation at boot (`academic.service.ts:168`).
   - Identify missing `pool.on('error', ...)` handlers and lack of automatic reconnect logic when SQL Server resets connection.
   - Detail the cold start timeout issue in E2E tests where `LYCEUM_DB_HOST` is unset.
3. Snapshot Consolidation (`refreshConsolidatedSnapshot`):
   - Analyze the `LEFT JOIN` on `regexp_replace(a.matricula, ...)` = `regexp_replace(b.matricula, ...)`.
   - Explain why this causes full table scans and 100% CPU spikes on PostgreSQL.
   - Detail the risk of `ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time` due to missing `DISTINCT ON`.
   - Explain why withdrawn/deleted students in Moodle remain as ghost records in `ava_consolidated_report`.
   - Show why snapshot consolidation is redundantly triggered up to 11 times during a global sync.
4. Event Loop & Memory:
   - Identify synchronous `JSON.parse` blocking event loop on large sync payloads.
   - Identify unbounded memory leak in `CacheService.memoryCache` when Redis is disconnected.
5. Provide optimized SQL queries with indexes, BullMQ queue configuration, and pool resilience code blocks.
6. Document in `integrations_audit.md` in your working directory:
   c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_worker_resilience_1\integrations_audit.md.
7. Write your handoff.md and send a completion message to parent (27e91390-bd43-444c-a451-05eaa934d0b8).
