# Handoff Report: External Integrations, Background Queues, and Synchronization Resilience

**Agent**: `teamwork_preview_explorer_survey_integrations_1`  
**Parent**: `27e91390-bd43-444c-a451-05eaa934d0b8`  
**Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_explorer_survey_integrations_1`  
**Report Artifact**: `survey_integrations.md`  

---

## 1. Observation

- **AvaSyncService Integration Mechanism**:
  - File: `apps/backend/src/ava-sync/ava-sync.service.ts`:
    - Lines 282-304: `triggerMoodleUpdate(institution, attUrl, label)` sends an HTTP GET request (`fetch(attUrl, { cache: 'no-store' })`) to trigger Moodle's Deferred SQL generation.
    - Lines 325-334: `syncGrades` executes `fetch(getUrl, { cache: 'no-store', signal: controller.signal })` with a 120,000ms abort controller timeout.
    - Lines 335-350: On `AbortError` or network error (`fetchError`), returns `{ source: '...', status: 'queued', reason: '...' }`.
    - Lines 383-395: If response begins with `<!DOCTYPE`, `<html`, or `<xml`, returns `{ status: 'queued' }`.
    - Lines 399, 694: Synchronously executes `data = JSON.parse(cleanText)`.
    - Lines 141-265: `refreshConsolidatedSnapshot` runs `INSERT INTO ava_consolidated_report (...) SELECT ... FROM ava_progress_report p LEFT JOIN ava_grades_report g ON ... AND (p.curso = g.course_fullname OR ... regexp_replace(p.curso, ...) = regexp_replace(g.course_fullname, ...)) ON CONFLICT ("sourceInstitution", aluno_id, curso) DO UPDATE SET ...` without `DISTINCT ON`.
  - File: `apps/backend/src/jobs/processors/ava-sync.processor.ts`:
    - Line 13: `@Processor(QUEUE_AVA_SYNC, { concurrency: 2 })`.
    - Lines 152-158: `const onlyErrors = results.filter((r) => r.status === 'error'); if (onlyErrors.length === results.length && results.length > 0) throw new Error(...)`. Because timeouts return `status: 'queued'`, no error is thrown.

- **Academic / Lyceum MSSQL Integration**:
  - File: `apps/backend/src/academic/academic.service.ts`:
    - Lines 150-168: `this.pool = await new sql.ConnectionPool(config).connect()`. Executed once in `onModuleInit()`.
    - Line 229: Errors during connection are logged with `console.error` and swallowed; `this.pool` remains `null`.
    - Line 724: `if (!this.pool) throw new Error('Lyceum database not connected.')`.
    - There is no `this.pool.on('error', ...)` handler.
  - File: `apps/backend/src/academic/academic-sync.service.ts`:
    - Line 18: `private isSyncing = false` (in-memory boolean flag).
    - Line 25: `@Cron('0 3 * * *') async handleDailySync()`.
    - Lines 66-75, 149-154, 229-240: Runs queries directly against `VW_AVA_TURMA`, `VW_AVA_MATRICULA`, `VW_AVA_DISCENTE`, and `VW_AVA_DOCENTE` using active periods from `getLyceumActivePeriods()` (default `2026-2`).
    - Lines 219-224: `WHERE U.ID IN (${inParams})` builds unparameterized raw string lists of 1,000 user IDs.

- **BullMQ / Redis Configuration**:
  - File: `apps/backend/src/jobs/jobs.service.ts`:
    - Lines 44-53: `addAcademicSyncJob()` checks `getActive()` and `getWaiting()`, but check-and-enqueue is not atomic.
    - Lines 84-97: `addAvaSyncJob()` has no deduplication check and no deterministic `jobId`.
    - Lines 59-70, 85-96: `attempts: 3` (academic) and `2` (ava); `removeOnFail: { count: 100 }`. Neither queue defines a Dead-Letter Queue (DLQ).
  - File: `apps/backend/src/cache/cache.service.ts`:
    - Lines 133-145: Items stored without TTL (`expiresAt: null`) are never evicted from `memoryCache`.
    - Line 166: `await this.redisClient.keys(pattern)` uses blocking `KEYS`.

- **Frontend Polling**:
  - File: `apps/frontend/src/components/ava-reports/ConsolidatedActions.tsx`:
    - Lines 29-47: `pollJobUntilDone` uses `while (!isDone)` with 1500ms sleep and no maximum timeout or retry ceiling.
  - File: `apps/frontend/src/app/academic/AcademicDashboard.tsx`:
    - Lines 129-147: Identical unbounded `while (!isDone)` loop.

- **Build and Test Execution**:
  - Executed `npm --prefix apps/backend test`: 26 suites passed, 93 tests passed.
  - Executed `npm --prefix apps/backend run test:e2e`: 4 suites passed, 12 tests passed; output alerted `Force exiting Jest: Have you considered using --detectOpenHandles...`.

---

## 2. Logic Chain

1. **Lyceum MSSQL Fragility**:
   - *Observation*: `academic.service.ts:168` connects once on startup without auto-retry or lazy reconnect, and lacks `pool.on('error', ...)`.
   - *Logic*: If Lyceum is offline during startup, `this.pool` remains `null` permanently until backend restart. If Lyceum drops connection during runtime, unhandled pool error events can crash the Node.js process. Furthermore, lack of query timeout configuration risks hung transactions during large matricula exports.
2. **Masked Moodle AVA Retries**:
   - *Observation*: `ava-sync.service.ts:340` returns `status: 'queued'` on 120s timeout, and `ava-sync.processor.ts:152` only throws an error if all results are `status: 'error'`.
   - *Logic*: BullMQ receives a resolved promise, marking the job as completed. BullMQ's exponential backoff and retry policy is never invoked. The database remains stale with no automated mechanism to check when Moodle finishes generating the SQL Adiado report.
3. **Snapshot Inconsistency and Potential Crash**:
   - *Observation*: `ava-sync.service.ts:151-265` performs `INSERT ... ON CONFLICT DO UPDATE` joining `ava_progress_report` and `ava_grades_report` with fuzzy regex matching without `DISTINCT ON`.
   - *Logic*: If a student has more than one matching course in grades (e.g., retakes or ambiguous course names), multiple rows with the same conflict target `(sourceInstitution, aluno_id, curso)` are generated in the same query. PostgreSQL rejects this with `ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time`. Additionally, canceled or deleted students are never pruned because the query only inserts or updates.
4. **Duplicate Processing & Scalability**:
   - *Observation*: `AcademicSyncService` uses an in-memory boolean `isSyncing = false`, and `addAvaSyncJob` does not deduplicate requests.
   - *Logic*: In a multi-replica/clustered deployment, all pods run the `@Cron('0 3 * * *')` simultaneously, causing concurrent table deletes and duplicate inserts on `academic_matricula`. In the AVA sync, multiple concurrent clicks queue duplicate jobs that run in parallel due to `concurrency: 2`, multiplying database load and causing row lock contention during `refreshConsolidatedSnapshot`.
5. **Event Loop and Memory Risks**:
   - *Observation*: `JSON.parse` is run synchronously on multi-megabyte payloads (`ava-sync.service.ts:399`), and `memoryCache` in `cache.service.ts:133-145` lacks LRU eviction for items without TTL.
   - *Logic*: Large JSON payloads block the single-threaded Node.js event loop for hundreds of milliseconds, degrading API response times for all users. If Redis goes down, unbounded in-memory cache growth risks heap exhaustion (OOM).

---

## 3. Caveats

- **External Database Live Execution**: Direct live network connections to external Lyceum (MSSQL 172.29.44.90) and Moodle production URLs were not tested in live mutation mode to avoid affecting staging or production data.
- **Moodle MySQL Direct vs HTTP**: The prompt mentioned "Moodle AVA / MySQL", but the codebase exclusively uses HTTP JSON endpoints for Moodle. If direct MySQL access is planned for a future architecture phase, that connector does not currently exist in the codebase.
- **Frontend Build**: Focused on backend integration services, queues, and Next.js job polling actions. Complete frontend component rendering was inspected statically.

---

## 4. Conclusion

The external integration and synchronization subsystem in Nexus Core has sound functional foundations (local caching of Lyceum data, desensitized snapshot tables for fast queries, BullMQ job queuing), but suffers from **three critical architectural vulnerabilities**:
1. **Fault Tolerance Deficits**: Lack of MSSQL pool error listeners and auto-reconnect, coupled with Moodle timeout error masking that disables BullMQ retries.
2. **Snapshot Consolidation Vulnerabilities**: High risk of `ON CONFLICT DO UPDATE cannot affect row a second time` SQL aborts due to missing `DISTINCT ON` in regex-joined rows, plus retention of deleted/orphaned enrollments.
3. **Concurrency and Deduplication Gaps**: Absence of distributed locking (`pg_advisory_lock` or Redlock) for cron jobs in clustered environments, lack of `jobId` deduplication in AVA sync, and unbounded polling loops in frontend components.

A comprehensive survey report containing line-by-line evidence, architectural diagrams, and an Impact vs Effort roadmap was compiled at `survey_integrations.md`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Unit & E2E Tests**:
   ```pwsh
   npm --prefix apps/backend test
   npm --prefix apps/backend run test:e2e
   ```
   *Expected outcome*: Tests pass, but Jest warns regarding unclosed handles (`--detectOpenHandles`).

2. **Inspect MSSQL Connection & Error Handling**:
   - Inspect `apps/backend/src/academic/academic.service.ts:168-234` and `723-750`.
   - Confirm absence of `this.pool.on('error')` and absence of lazy reconnect logic.

3. **Inspect Moodle Timeout Error Masking**:
   - Inspect `apps/backend/src/ava-sync/ava-sync.service.ts:335-350`.
   - Confirm that `AbortError` returns `status: 'queued'`.
   - Inspect `apps/backend/src/jobs/processors/ava-sync.processor.ts:152-158` and confirm that `status: 'queued'` bypasses error throwing.

4. **Inspect Snapshot Duplicate Key Vulnerability**:
   - Inspect `apps/backend/src/ava-sync/ava-sync.service.ts:151-265`.
   - Confirm that `SELECT` lacks `DISTINCT ON (p."sourceInstitution", p.aluno_id, p.curso)`.

5. **Inspect Frontend Polling Loops**:
   - Inspect `apps/frontend/src/components/ava-reports/ConsolidatedActions.tsx:29-47`.
   - Inspect `apps/frontend/src/app/academic/AcademicDashboard.tsx:129-147`.
   - Confirm `while (!isDone)` without timeout or max attempt threshold.
