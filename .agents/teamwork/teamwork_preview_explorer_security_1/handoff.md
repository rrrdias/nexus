# Handoff Report: Security, Authentication & Access Control Audit (R1)
**Agent:** `teamwork_preview_explorer_security_1`  
**Working Directory:** `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_explorer_security_1`  
**Authoritative Request:** `ORIGINAL_REQUEST.md` (R1)  
**Deliverable File:** `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_explorer_security_1\security_audit.md`  
**Handoff Type:** Hard (Task Complete)

---

## 1. Observation

1. **Backend Controller Mapping & Public Decorator**:
   - `apps/backend/src/scheduling/public-scheduling.controller.ts` (lines 13-101): Decorator `@Public()` applied at class level. All 5 methods (`student-flow`, `available-slots`, `book`, `cancel`, `reschedule`) are accessible without `Authorization: Bearer` token.
   - The method `getStudentFlow` accepts `@Query('matricula')`, `book` accepts `@Body() dto: CreateBookingDto`, `cancel` accepts `@Body() body: { bookingId: string; matricula: string }`, and `reschedule` accepts `@Body() body: { bookingId: string; matricula: string; newOpcaoId: string; periodo: string }`. None of these methods validate session tokens, cookies, or cryptographic signatures.
   - In `apps/backend/src/scheduling/scheduling.service.ts` (lines 1550-1567), `cancelStudentBooking` checks only:
     ```typescript
     if (booking.matricula.trim().toLowerCase() !== matricula.trim().toLowerCase()) {
       throw new BadRequestException('Este agendamento não pertence à matrícula informada.');
     }
     ```
   - In `apps/backend/src/scheduling/scheduling.controller.ts` (lines 123-126), `POST /api/scheduling/bookings` lacks `@RequireAdmin()`, possessing only `@RequireModule('scheduling', 'backoffice')`.

2. **Student Session Cookie in Next.js Middleware**:
   - `apps/frontend/src/middleware.ts` (lines 20-38):
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
   - The cookie `nexus_student_session` stores raw, unencrypted, unsigned matricula text (e.g. `2026001`). Server Actions in `apps/frontend/src/app/actions/student-scheduling.ts` do not pass this cookie to the backend.

3. **Frontend Admin RBAC Omissions**:
   - `apps/frontend/src/app/admin/scheduling/locals/page.tsx` (lines 7-8):
     ```typescript
     const session = await auth()
     if (!session?.user) redirect("/login")
     ```
   - `apps/frontend/src/app/admin/scheduling/slots/page.tsx` (lines 7-8):
     ```typescript
     const session = await auth()
     if (!session?.user) redirect("/login")
     ```
   - Conversely, `apps/frontend/src/app/admin/users/page.tsx` (line 14) and `apps/frontend/src/app/admin/groups/page.tsx` (line 12) strictly enforce `if (!session?.user?.isSuperAdmin) redirect("/")`.
   - `apps/frontend/src/app/actions/scheduling.ts` server actions perform no permission checks prior to invoking `fetchFromApi()`.

4. **Static Code Analysis (XSS, SQLi, Headers, Rate Limiting)**:
   - **XSS**: `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx` (lines 46-56, 241-285) interpolates `${student.nome}`, `${student.matricula}`, `${booking.localNome}`, `${booking.localEndereco}`, and `${disc}` without HTML escaping. Lines 354-356 invoke `doc.write(html)` on a dynamic hidden iframe without a `sandbox` attribute.
   - **SQLi**: Drizzle ORM queries in `apps/backend/src/` use tagged templates (`sql\`...\``) which automatically parameterize dynamic variables. In `apps/backend/src/academic/academic-sync.service.ts` (lines 65-75), MSSQL queries concatenate `WHERE T.PERIODO IN (${periodsInStr})` where `periodsInStr` is generated from configuration.
   - **Headers**: `apps/backend/src/main.ts` (lines 16-21) configures Helmet with `contentSecurityPolicy: false`. `apps/frontend/next.config.ts` (lines 27-29) declares a CSP header that completely omits `default-src`, `script-src`, and `connect-src`.
   - **Rate Limiting**: `apps/backend/package.json` contains no rate-limiting library (`@nestjs/throttler` is absent). No rate limiting is implemented on `/api/auth/login` or `/api/public/scheduling/*`.

---

## 2. Logic Chain

1. **IDOR & BOLA Exploit Chain**:
   - Because `PublicSchedulingController` is marked `@Public()`, NestJS bypasses `JwtAuthGuard` and `RbacGuard`.
   - Because `getStudentFlow` returns full student PII and active `bookingId` based solely on the unauthenticated query parameter `matricula`, an attacker can enumerate matricula numbers and harvest student records.
   - Because `cancelStudentBooking` only verifies that the caller-supplied `matricula` matches the booking's `matricula`, an attacker supplying both values can cancel any student's exam appointment without proof of identity.
   - Because `rescheduleStudentBooking` only requires `bookingId`, `matricula`, and `newOpcaoId`, an attacker can relocate a student's exam to an arbitrary date or distant location.
   - The cookie `nexus_student_session` in `src/middleware.ts` fails to mitigate this attack because it is neither signed nor validated by the backend.

2. **Administrative RBAC & Privilege Escalation Chain**:
   - `middleware.ts` in Next.js checks only `isLoggedIn`, allowing any authenticated user access to `/nexus/admin/*`.
   - `/admin/scheduling/locals` and `/admin/scheduling/slots` verify only `!session?.user`, allowing low-privilege users (e.g. polo proctors or read-only users) to load the slot and location management pages.
   - In the backend, `POST /api/scheduling/bookings` lacks `@RequireAdmin()`, allowing any user with the `scheduling` module to book exams on behalf of any student.

3. **Client-Side Code Execution (XSS) Chain**:
   - Academic and scheduling data flows from Lyceum/Moodle through the backend into `StudentVoucherDialog.tsx`.
   - The string generator `generateVoucherHtml` interpolates raw fields directly into HTML markup.
   - Invoking `doc.write()` parses and executes any embedded HTML/JavaScript tags in the context of the frontend origin.

4. **Security Headers & Network Posture Chain**:
   - Omitting `default-src` and `script-src` in the CSP means the browser applies no restrictions on script execution or inline code, neutralizing CSP-based defense-in-depth against XSS.
   - The absence of rate limiting allows automated brute-force attacks against `/api/auth/login` and volumetric scraping of student data.

---

## 3. Caveats

- **MSSQL Lyceum Input Vector**: The string interpolation in `academic-sync.service.ts` uses `getLyceumActivePeriods()`, which currently reads from `process.env.LYCEUM_ACTIVE_PERIODS`. It is not directly exploitable via user input unless the environment variable or database configuration is compromised.
- **Backend Mutation Protection**: Non-admin users who access `/admin/scheduling/locals` will receive HTTP 403 when attempting to submit `createLocal` or `updateLocal`, because the backend NestJS controller has `@RequireAdmin()`. However, the frontend leak remains a privilege escalation issue because UI elements, active polo lists, and `POST /api/scheduling/bookings` are exposed.
- No other unmapped controllers or guards exist in the backend codebase (verified via recursive search for `@Controller`).

---

## 4. Conclusion

The security posture of Nexus Core exhibits critical vulnerabilities in the public student scheduling flow (IDOR/BOLA), high-severity authorization gaps in the administrative scheduling frontend, a stored/DOM XSS vector in the voucher print dialog, and missing rate-limiting and CSP controls.

All findings have been fully documented with CVSS scores, impact analyses, and production-ready remediation code blocks in:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_explorer_security_1\security_audit.md`.

---

## 5. Verification Method

To independently verify the observations and conclusions:

1. **Verify Backend Controller Annotations**:
   - Run `grep_search` on `apps/backend/src` for `@Controller` and inspect guards in `apps/backend/src/app.module.ts`.
   - View `apps/backend/src/scheduling/public-scheduling.controller.ts` (lines 13-101) to confirm `@Public()` and raw parameter signatures.
   - Run existing unit tests:
     ```pwsh
     npm --prefix apps/backend test -- src/scheduling/public-scheduling.controller.spec.ts
     ```
2. **Verify Frontend Route Protection**:
   - Inspect `apps/frontend/src/app/admin/scheduling/locals/page.tsx` (lines 7-8) vs `apps/frontend/src/app/admin/users/page.tsx` (line 14) to confirm the missing `isSuperAdmin` check.
   - Inspect `apps/frontend/src/middleware.ts` (lines 20-38) to confirm raw `matricula` cookie assignment without HMAC.
3. **Verify XSS Vector**:
   - Inspect `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx` (lines 46-56, 354-356) to confirm unescaped string interpolation and `doc.write(html)`.
4. **Verify CSP and Helmet**:
   - Inspect `apps/frontend/next.config.ts` (lines 27-29) to confirm absence of `default-src` and `script-src`.
   - Inspect `apps/backend/src/main.ts` (lines 16-21) to confirm `contentSecurityPolicy: false`.
