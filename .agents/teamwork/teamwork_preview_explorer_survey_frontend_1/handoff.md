# Handoff Report — Frontend Architecture, UX & Client Security Survey

**Agent**: `teamwork_preview_explorer_survey_frontend_1`  
**Parent**: `27e91390-bd43-444c-a451-05eaa934d0b8`  
**Milestone**: `survey_frontend`  
**Artifact**: `survey_frontend.md`

---

## 1. Observation

1. **Next.js 16 App Router File System**:
   - Zero `error.tsx`, `global-error.tsx`, `loading.tsx` or `not-found.tsx` exist in `apps/frontend/src/app` (confirmed via `find_by_name` returning 0 results for patterns `*{error,loading,not-found}*`).
   - Root layout (`src/app/layout.tsx:42-58`) executes `const session = await auth()` and dynamically decides whether to render `<Sidebar />` and `<Topbar />`, wrapping `{children}` without Route Groups.
   - All 32 routes compiled in `next build` are marked with `ƒ (Dynamic)` due to `RootLayout` reading headers/cookies.

2. **Middleware & Student Session (`src/middleware.ts`)**:
   - Lines 20-37:
     ```typescript
     const urlMat = req.nextUrl.searchParams.get('matricula')?.trim() || req.nextUrl.searchParams.get('userid')?.trim()
     const existingCookie = req.cookies.get('nexus_student_session')?.value?.trim()
     const activeMatricula = urlMat || existingCookie
     if (activeMatricula) {
       const res = NextResponse.next()
       res.cookies.set('nexus_student_session', activeMatricula, {
         maxAge: 30 * 60,
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'lax',
         path: '/',
       })
       return res
     }
     ```
   - The cookie value is raw plaintext `activeMatricula`. There is no HMAC signature, timestamp, or token validation.
   - Lines 56-59 check `if (isLoggedIn && req.auth?.user?.isDisabled)`. However, in `src/auth.ts:41-50, 60-76`, `isDisabled` is never added to the user object, JWT token, or session callback.

3. **RBAC Guard Disparities Across Admin Pages**:
   - `src/app/admin/users/page.tsx:13-14` and `src/app/admin/groups/page.tsx:11-12`:
     ```typescript
     const session = await auth()
     if (!session?.user?.isSuperAdmin) redirect("/")
     ```
   - `src/app/admin/scheduling/page.tsx:7-8`, `src/app/admin/scheduling/locals/page.tsx:7-8`, and `src/app/admin/scheduling/slots/page.tsx:7-8`:
     ```typescript
     const session = await auth()
     if (!session?.user) redirect("/login")
     ```
   - No check for `isSuperAdmin`, coordinator role, or group membership exists on scheduling admin pages.

4. **Error Masking in Server Actions**:
   - `src/app/actions/api.ts:30-47` throws `new Error(error?.message || ...)` on non-200 responses.
   - Server Actions in `src/app/actions/users.ts:23-28`, `src/app/actions/groups.ts:19-24`, and `src/app/actions/scheduling.ts:17-33, 51-67` invoke `fetchFromApi` directly without catching or returning structured objects.
   - In Next.js 16 production runtime (`next build`), thrown exceptions in Server Actions are replaced with `An error occurred in the Server Components render. Digest: ...`, hiding validation messages from user dialogs.
   - `student-scheduling.ts:5-8, 110-130` uses `ActionResult<T> = { success: true; data: T } | { success: false; error: string }`, successfully preventing error masking.

5. **XSS Vector in Print Voucher**:
   - `src/app/agendamento/StudentVoucherDialog.tsx:46-56, 330-356`:
     Raw strings (`student.nome`, `student.matricula`, `booking.localNome`, `booking.localEndereco`, `disc`) are concatenated directly into an HTML template string in `generateVoucherHtml` and written to an iframe using `doc.write(html)` without entity escaping.

6. **Content Security Policy**:
   - `next.config.ts:27-29`:
     ```typescript
     {
       key: "Content-Security-Policy",
       value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'",
     }
     ```
   - Omits `default-src`, `script-src`, `style-src`, `connect-src`, and `img-src`.

7. **Build and Test Verification**:
   - `npx tsc --noEmit` exited with code 0 (0 type errors).
   - `npm run lint` exited with code 0 (91 warnings: ESLint `react-hooks/set-state-in-effect` and unused imports).
   - `npx tsx src/lib/scheduling-utils.test.ts` passed 5 unit test suites testing `parseTimeToMinutes`, `getExamEndTime`, `isSlotInPast` (America/Sao_Paulo timezone), `filterValidStartSlots` (consecutive 30-min blocks), and `calculateDatesStatus`.
   - `npm run build` compiled 32 dynamic pages successfully in Turbopack.

---

## 2. Logic Chain

1. From **Observation 2**, `nexus_student_session` is stored in plaintext from either the `matricula` query param or an existing cookie without an HMAC signature or backend token validation. Therefore, any client can arbitrarily set `Cookie: nexus_student_session=<victim_id>` or load `/agendamento?matricula=<victim_id>` to view, cancel, or reschedule another student's exam.
2. From **Observation 3**, scheduling management pages (`/admin/scheduling`, `/locals`, `/slots`) only test `!session?.user`. Therefore, any logged-in user (regardless of privileges or whether they are coordinator, teacher, or polo staff) can view, edit, create, or delete exam slots and polo centers.
3. From **Observation 4**, Next.js 16 production server action semantics mask uncaught thrown errors with a cryptographic digest hash. Because `users.ts`, `groups.ts`, and `scheduling.ts` throw raw exceptions rather than returning `ActionResult<T>`, users in production will only see unhelpful generic digest errors on form validation failures.
4. From **Observation 5 & 6**, `doc.write(html)` inside an un-sandboxed iframe receives unescaped student and discipline strings, while CSP lacks `script-src` and `default-src`. Therefore, any malicious payload stored in student records or disciplines executes without restriction in the document's origin.
5. From **Observation 1**, absence of Route Groups, `error.tsx`, and `loading.tsx` causes the root layout to execute `auth()` for all routes, turning every page into dynamic SSR and allowing authenticated chrome to bleed into the public booking flow.

---

## 3. Caveats

- Investigation was performed strictly in read-only mode without applying source code modifications to application files.
- Backend database persistence was observed via controllers and ORM query interfaces; live Moodle AVA and Lyceum ERP network endpoints were not reached directly during offline test execution.
- No caveats regarding frontend Next.js 16 App Router code structure or static verification.

---

## 4. Conclusion

The Nexus Core frontend architecture is modern (Next.js 16.2.6, React 19, Tailwind CSS 4) and features a well-crafted visual UI for students and administrators. However, it requires four critical remediation actions before production deployment:
1. **Cryptographic signing of student session cookies** and requirement of signed AVA tokens for public scheduling.
2. **Strict RBAC enforcement** on `/admin/scheduling/*` routes.
3. **HTML escaping in voucher generation** and deployment of a complete CSP policy.
4. **Standardization of Server Actions** to return `ActionResult<T>` to eliminate production digest masking.

---

## 5. Verification Method

To independently verify these findings:
1. **Type Check**:
   ```pwsh
   cd c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\frontend
   npx tsc --noEmit
   ```
2. **ESLint Warnings Check**:
   ```pwsh
   npm run lint
   ```
3. **Unit Tests (Scheduling Consecutive Slots & Timezone)**:
   ```pwsh
   npx tsx src/lib/scheduling-utils.test.ts
   ```
4. **Production Build & Dynamic Route Generation**:
   ```pwsh
   npm run build
   ```
5. **Inspect Key Findings**:
   - Session Cookie: `apps/frontend/src/middleware.ts:24-37`
   - RBAC Guards: `apps/frontend/src/app/admin/scheduling/locals/page.tsx:6-9`
   - Action Error Masking: `apps/frontend/src/app/actions/users.ts:23-28` vs `student-scheduling.ts:110-130`
   - Voucher DOM XSS: `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx:46-56, 330-356`
   - CSP: `apps/frontend/next.config.ts:27-29`
