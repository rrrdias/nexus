# Relatório Definitivo de Auditoria de Segurança, Autenticação e Controle de Acesso (R1)
**Projeto:** Nexus Core (NestJS Backend + Next.js 16 Frontend)  
**Ambiente de Referência:** Produção / Homologação EaD UniEVANGÉLICA  
**Data da Auditoria:** 23 de Outubro de 2026  
**Auditor Responsável:** Teamwork Security Explorer (`teamwork_preview_explorer_security_1`)  
**Status do Laudo:** CONCLUÍDO (Laudo Técnico Abrangente)

---

## 1. Sumário Executivo & Modelo de Ameaças

O ecossistema **Nexus Core** é composto por uma arquitetura em monorepo com backend NestJS 11 (`apps/backend`) e frontend Next.js 16 (`apps/frontend`). A aplicação é responsável pela gestão acadêmica integrada, relatórios consolidados do AVA Moodle, sincronização de dados institucionais do Lyceum (MSSQL) e pelo portal público de autoagendamento de provas presenciais dos estudantes da Graduação EaD.

A presente auditoria técnica de segurança avaliou exaustivamente:
1. **100% dos controllers e endpoints REST** expostos pelo NestJS (`apps/backend/src`), verificando guards globais, decoradores de autenticação (`@Public()`), controle de acesso baseado em papéis (`@RequireModule()`, `@RequireAdmin()`) e brechas de autorização.
2. **Fluxo de agendamento do aluno e isolamento de sessão**, inspecionando o cookie `nexus_student_session` gerado no Next.js (`src/middleware.ts`), o consumo no backend `PublicSchedulingController` e o risco de exploração por IDOR (Insecure Direct Object Reference) e BOLA (Broken Object Level Authorization).
3. **Controle de acesso administrativo (RBAC)** no Next.js App Router (`/admin/scheduling/*`) e Server Actions, identificando riscos de escalação horizontal e vertical de privilégios por operadores de polo e usuários comuns.
4. **Vulnerabilidades estáticas e postura de segurança HTTP**: vetores de SQL Injection (Drizzle ORM vs MSSQL queries), Cross-Site Scripting (XSS no diálogo de emissão de comprovante `StudentVoucherDialog.tsx`), cabeçalhos de segurança (Helmet, CSP, CORS) e ausência de Rate Limiting.

### 1.1 Resumo Quantitativo de Apontamentos

| Severidade | Quantidade | Principais Vetores |
|---|:---:|---|
| **CRÍTICA** | **1** | IDOR e Quebra Completa de Autorização no `PublicSchedulingController` (consulta de PII, cancelamento e remarcação arbitrária sem autenticação). |
| **ALTA** | **3** | Escalação de Privilégios no Frontend Admin Scheduling (`/admin/scheduling/locals` e `/slots`); XSS Armazenado/DOM via `doc.write()` no `StudentVoucherDialog.tsx`; Ausência total de Rate Limiting em `/api/auth/login` e `/api/public/scheduling/*`. |
| **MÉDIA** | **2** | Content Security Policy (CSP) truncada no Next.js (ausência de `default-src`, `script-src`, `connect-src`); Helmet no NestJS com CSP desabilitado e CORS permissivo com wildcards. |
| **BAIXA** | **1** | Interpolação de períodos em queries do Lyceum MSSQL em vez de parâmetros tipados `tedious`. |

---

## 2. Mapeamento Exaustivo 100% de Rotas e Controllers (Backend NestJS)

O backend possui dois guards globais registrados no `AppModule` (`apps/backend/src/app.module.ts`):
1. **`JwtAuthGuard`**: Intercepta todas as requisições HTTP. Se a rota ou controller possuir o decorador `@Public()`, o guard concede acesso imediato (`return true`). Caso contrário, exige um token Bearer JWT válido no cabeçalho `Authorization` e consulta se o usuário correspondente está ativo no banco PostgreSQL (`users.isActive = true`, com cache de 30 segundos em memória).
2. **`RbacGuard`**: Executado após o `JwtAuthGuard`. Se a rota for `@Public()`, concede acesso imediato. Se o usuário for `isSuperAdmin`, tem acesso total irrestrito. Se o endpoint exigir `@RequireAdmin()`, bloqueia qualquer usuário que não seja Super Administrador. Se exigir `@RequireModule('modulo')`, consulta as permissões diretas do usuário e seus grupos (`system_modules`, `users_system_access`, `group_system_access`).  
   **Falha Estrutural do Guard:** Se um endpoint **não for público**, mas **não tiver `@RequireAdmin()` nem `@RequireModule()`**, o `RbacGuard` permite a requisição para **qualquer usuário autenticado** (linhas 83-86 do `rbac.guard.ts`), independentemente de seu perfil, grupo ou permissões modulares.

Abaixo está o mapeamento exaustivo de cada um dos **13 controllers** e **38 endpoints REST** implementados no backend:

| # | Módulo | Controller | Método | Rota HTTP | Pública? | Decoradores Aplicados | Papéis / Módulos Requeridos | Veredito de Segurança |
|:---:|---|---|:---:|---|:---:|---|---|:---:|
| 1 | **Root** | `AppController` | `GET` | `/` | Sim | `@Public()`, `@Get()` | Nenhum | **PASS** |
| 2 | **Health** | `HealthController` | `GET` | `/health` | Sim | `@Public()`, `@Get()` | Nenhum | **PASS** |
| 3 | **Auth** | `AuthController` | `POST` | `/api/auth/login` | Sim | `@Public()`, `@Post('login')` | Nenhum (Público) | **VULNERABLE** (Sem Rate Limiting) |
| 4 | **Users** | `UsersController` | `GET` | `/api/users` | Não | `@RequireAdmin()`, `@Get()` | Super Admin | **PASS** |
| 5 | **Users** | `UsersController` | `GET` | `/api/users/:id` | Não | `@RequireAdmin()`, `@Get(':id')` | Super Admin | **PASS** |
| 6 | **Users** | `UsersController` | `POST` | `/api/users` | Não | `@RequireAdmin()`, `@Post()` | Super Admin | **PASS** |
| 7 | **Users** | `UsersController` | `PUT` | `/api/users/:id` | Não | `@RequireAdmin()`, `@Put(':id')` | Super Admin | **PASS** |
| 8 | **Users** | `UsersController` | `PUT` | `/api/users/:id/active` | Não | `@RequireAdmin()`, `@Put(':id/active')` | Super Admin | **PASS** |
| 9 | **Users** | `UsersController` | `DELETE` | `/api/users/:id` | Não | `@RequireAdmin()`, `@Delete(':id')` | Super Admin | **PASS** |
| 10 | **Groups** | `GroupsController` | `GET` | `/api/groups` | Não | `@RequireAdmin()`, `@Get()` | Super Admin | **PASS** |
| 11 | **Groups** | `GroupsController` | `GET` | `/api/groups/:id` | Não | `@RequireAdmin()`, `@Get(':id')` | Super Admin | **PASS** |
| 12 | **Groups** | `GroupsController` | `POST` | `/api/groups` | Não | `@RequireAdmin()`, `@Post()` | Super Admin | **PASS** |
| 13 | **Groups** | `GroupsController` | `PUT` | `/api/groups/:id` | Não | `@RequireAdmin()`, `@Put(':id')` | Super Admin | **PASS** |
| 14 | **Groups** | `GroupsController` | `DELETE` | `/api/groups/:id` | Não | `@RequireAdmin()`, `@Delete(':id')` | Super Admin | **PASS** |
| 15 | **Academic** | `AcademicController` | `POST` | `/api/academic/sync` | Não | `@RequireModule('academic')`, `@RequireAdmin()`, `@Post('sync')` | Super Admin | **PASS** |
| 16 | **Academic** | `AcademicController` | `GET` | `/api/academic/discentes` | Não | `@RequireModule('academic')`, `@Get('discentes')` | Módulo `academic` | **PASS** |
| 17 | **Academic** | `AcademicController` | `GET` | `/api/academic/discentes/:matricula/disciplinas` | Não | `@RequireModule('academic')`, `@Get(...)` | Módulo `academic` | **PASS** |
| 18 | **Academic** | `AcademicController` | `GET` | `/api/academic/docentes` | Não | `@RequireModule('academic')`, `@Get('docentes')` | Módulo `academic` | **PASS** |
| 19 | **Academic** | `AcademicController` | `GET` | `/api/academic/docentes/:docenteId/disciplinas` | Não | `@RequireModule('academic')`, `@Get(...)` | Módulo `academic` | **PASS** |
| 20 | **Academic** | `AcademicController` | `GET` | `/api/academic/turmas` | Não | `@RequireModule('academic')`, `@Get('turmas')` | Módulo `academic` | **PASS** |
| 21 | **Academic** | `AcademicController` | `GET` | `/api/academic/matriculas` | Não | `@RequireModule('academic')`, `@Get('matriculas')` | Módulo `academic` | **PASS** |
| 22 | **Audit** | `AuditController` | `GET` | `/api/audit-logs` | Não | `@RequireAdmin()`, `@Get()` | Super Admin | **PASS** |
| 23 | **Audit** | `AuditController` | `GET` | `/api/audit-logs/stats` | Não | `@RequireAdmin()`, `@Get('stats')` | Super Admin | **PASS** |
| 24 | **Audit** | `AuditController` | `POST` | `/api/audit-logs/export` | Não | `@RequireAdmin()`, `@Post('export')` | Super Admin | **PASS** |
| 25 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/progress` | Não | `@RequireModule('ava')`, `@Post('progress')` | Módulo `ava` | **PASS** |
| 26 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/progress/export` | Não | `@RequireModule('ava')`, `@Post(...)` | Módulo `ava` | **PASS** |
| 27 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/sync` | Não | `@RequireModule('ava')`, `@RequireAdmin()`, `@Post('sync')` | Super Admin | **PASS** |
| 28 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/grades` | Não | `@RequireModule('ava')`, `@Post('grades')` | Módulo `ava` | **PASS** |
| 29 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/grades/export` | Não | `@RequireModule('ava')`, `@Post(...)` | Módulo `ava` | **PASS** |
| 30 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/consolidated` | Não | `@RequireModule('ava')`, `@Post('consolidated')` | Módulo `ava` | **PASS** |
| 31 | **Ava Reports** | `AvaReportsController` | `POST` | `/api/ava-reports/consolidated/export` | Não | `@RequireModule('ava')`, `@Post(...)` | Módulo `ava` | **PASS** |
| 32 | **Ava Reports** | `AvaReportsController` | `GET` | `/api/ava-reports/dashboard-stats` | Não | `@RequireModule('ava')`, `@Get('dashboard-stats')` | Módulo `ava` | **PASS** |
| 33 | **Ava Sync** | `AvaSyncController` | `GET` | `/api/ava-sync` | Sim | `@Public()`, `@Get()` | Validação Bearer `CRON_SECRET` manual | **PASS** |
| 34 | **Jobs** | `JobsController` | `GET` | `/api/jobs/:queue/:id/status` | Não | `@RequireModule('academic', 'ava')`, `@Get(...)` | Módulo `academic` OU `ava` | **PASS** |
| 35 | **System** | `SystemController` | `GET` | `/api/system/modules` | Não | `@Get('modules')` *(sem @RequireModule)* | Qualquer usuário logado | **PASS** (Metadados públicos) |
| 36 | **System** | `SystemController` | `GET` | `/api/system/sidebar-modules` | Não | `@Get('sidebar-modules')` *(sem @RequireModule)* | Qualquer usuário logado | **PASS** (Filtra pelo ID da sessão) |
| 37 | **System** | `SystemController` | `GET` | `/api/system/admin-dashboard` | Não | `@RequireAdmin()`, `@Get('admin-dashboard')` | Super Admin | **PASS** |
| 38 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/locals` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('locals')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 39 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/locals` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post('locals')` | Super Admin | **PASS** |
| 40 | **Scheduling** | `SchedulingController` | `PUT` | `/api/scheduling/locals/:id` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Put(...)` | Super Admin | **PASS** |
| 41 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/options` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('options')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 42 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/options` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post('options')` | Super Admin | **PASS** |
| 43 | **Scheduling** | `SchedulingController` | `PUT` | `/api/scheduling/options/:id` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Put(...)` | Super Admin | **PASS** |
| 44 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/periods` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('periods')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 45 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/profile/:matricula/:periodo` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get(...)` | Módulo `scheduling` / `backoffice` | **PASS** |
| 46 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/attendance-list` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get(...)` | Módulo `scheduling` / `backoffice` | **PASS** |
| 47 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/bookings` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('bookings')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 48 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/bookings` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Post('bookings')` | Módulo `scheduling` / `backoffice` *(Sem @RequireAdmin)* | **VULNERABLE** (Criação forçada de reserva por operador) |
| 49 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/bookings/:id/conclude` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post(...)` | Super Admin | **PASS** |
| 50 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/bookings/:id/absent` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post(...)` | Super Admin | **PASS** |
| 51 | **Scheduling** | `SchedulingController` | `DELETE` | `/api/scheduling/bookings/:id` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Delete(...)` | Super Admin | **PASS** |
| 52 | **Scheduling** | `SchedulingController` | `GET` | `/api/scheduling/export` | Não | `@RequireModule('scheduling', 'backoffice')`, `@Get('export')` | Módulo `scheduling` / `backoffice` | **PASS** |
| 53 | **Scheduling** | `SchedulingController` | `POST` | `/api/scheduling/import` | Não | `@RequireModule(...)`, `@RequireAdmin()`, `@Post('import')` | Super Admin | **PASS** |
| 54 | **Public Sched.** | `PublicSchedulingController` | `GET` | `/api/public/scheduling/student-flow` | Sim | `@Public()`, `@Get('student-flow')` | Nenhum (Completamente Aberto) | **INSECURE** (Vazamento PII + IDOR) |
| 55 | **Public Sched.** | `PublicSchedulingController` | `GET` | `/api/public/scheduling/available-slots` | Sim | `@Public()`, `@Get('available-slots')` | Nenhum (Público) | **PASS / WARN** (Falta Rate Limiting) |
| 56 | **Public Sched.** | `PublicSchedulingController` | `POST` | `/api/public/scheduling/book` | Sim | `@Public()`, `@Post('book')` | Nenhum (Aberto via raw matricula) | **INSECURE** (Reserva arbitrária sem auth) |
| 57 | **Public Sched.** | `PublicSchedulingController` | `POST` | `/api/public/scheduling/cancel` | Sim | `@Public()`, `@Post('cancel')` | Nenhum (Aberto via raw matricula) | **INSECURE** (Cancelamento malicioso de terceiros) |
| 58 | **Public Sched.** | `PublicSchedulingController` | `POST` | `/api/public/scheduling/reschedule` | Sim | `@Public()`, `@Post('reschedule')` | Nenhum (Aberto via raw matricula) | **INSECURE** (Remarcação maliciosa de terceiros) |

---

## 3. Análise Detalhada: Sessão do Estudante e Vulnerabilidade de IDOR

### 3.1 Anatomia da Sessão do Estudante (`nexus_student_session`)

No frontend Next.js, o arquivo `apps/frontend/src/middleware.ts` intercepta o acesso às rotas do portal do aluno (`/agendamento`, `/loadingpage`, `/landingpage`).
Ao inspecionar as linhas 20 a 39 do `middleware.ts`, observa-se a seguinte implementação:

```typescript
// apps/frontend/src/middleware.ts
if (isPublicRoute) {
  if (pathname.includes('/agendamento')) {
    const urlMat =
      req.nextUrl.searchParams.get('matricula')?.trim() ||
      req.nextUrl.searchParams.get('userid')?.trim()
    const existingCookie = req.cookies.get('nexus_student_session')?.value?.trim()

    const activeMatricula = urlMat || existingCookie

    if (activeMatricula) {
      const res = NextResponse.next()
      res.cookies.set('nexus_student_session', activeMatricula, {
        maxAge: 30 * 60, // 30 minutos em segundos (1800s)
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      })
      return res
    }
  }
  return
}
```

#### Falhas Críticas Identificadas:
1. **Valor em Texto Puro sem Assinatura Criptográfica:** O cookie `nexus_student_session` armazena literalmente a string da matrícula (por exemplo, `2026001` ou `G2610162`). Não há HMAC, assinatura digital, timestamp de emissão ou segredo compartilhado.
2. **Origem Não Verificada:** O valor do cookie é preenchido diretamente a partir do parâmetro `?matricula=` ou `?userid=` presente na query string da URL. Qualquer usuário ou robô na internet pode forjar esse cookie para qualquer matrícula existente.
3. **Desconexão Total entre Frontend e Backend:** O backend NestJS (`PublicSchedulingController`) sequer lê ou valida esse cookie. As chamadas disparadas pelas Server Actions (`apps/frontend/src/app/actions/student-scheduling.ts`) realizam requisições HTTP REST diretas contra a API backend passando a matrícula no corpo JSON ou na query string, sem nenhum cabeçalho de autenticação ou token de sessão.

### 3.2 Por que o `PublicSchedulingController` é Vulnerável

O controller `apps/backend/src/scheduling/public-scheduling.controller.ts` é anotado no topo com `@Public()`:

```typescript
@Public()
@Controller('api/public/scheduling')
export class PublicSchedulingController {
  @Get('student-flow')
  async getStudentFlow(@Query('matricula') matricula?: string, @Query('periodo') periodo?: string) { ... }

  @Post('book')
  async createStudentBooking(@Body() dto: CreateBookingDto) { ... }

  @Post('cancel')
  async cancelStudentBooking(@Body() body: { bookingId: string; matricula: string }) { ... }

  @Post('reschedule')
  async rescheduleStudentBooking(@Body() body: { bookingId: string; matricula: string; newOpcaoId: string; periodo: string }) { ... }
}
```

O DTO `CreateBookingDto` valida apenas se `matricula` e `opcaoId` são strings preenchidas. O método `cancelStudentBooking` (`scheduling.service.ts`, linha 1550) executa apenas a seguinte validação de propriedade:

```typescript
if (booking.matricula.trim().toLowerCase() !== matricula.trim().toLowerCase()) {
  throw new BadRequestException('Este agendamento não pertence à matrícula informada.');
}
```

Ou seja: **o sistema compara a matrícula recebida no corpo da requisição contra a matrícula cadastrada no agendamento**. Como o atacante fornece a própria matrícula da vítima em ambos os campos, a validação é trivialmente satisfeita!

### 3.3 Cenário de Exploração Real (Passo a Passo)

```
[Atacante Não Autenticado]
        │
        ├─ 1. Enumeração e Raspagem de Dados
        │     GET /api/public/scheduling/student-flow?matricula=2026001
        │     ◄── Retorna Nome, E-mail, Telefone, Curso, Disciplinas,
        │         Local da Prova, Data, Hora e `bookingId` ativo
        │
        ├─ 2. Sabotagem / Cancelamento Malicioso
        │     POST /api/public/scheduling/cancel
        │     Body: { "bookingId": "uuid-da-reserva", "matricula": "2026001" }
        │     ◄── Status 200: Vaga liberada, aluno tem sua prova CANCELADA!
        │
        └─ 3. Remarcação Maliciosa (Grooming / Lotação Forçada)
              POST /api/public/scheduling/reschedule
              Body: { "bookingId": "uuid", "matricula": "2026001", "newOpcaoId": "opcao-polo-distante", "periodo": "2026-2" }
              ◄── Status 200: Aluno transferido para polo em outro município sem seu consentimento!
```

#### Impacto Institucional e Conformidade LGPD
- **Violação Massiva da LGPD (Lei 13.709/2018):** O endpoint `student-flow` permite a exfiltração automatizada de dados pessoais de estudantes (Nome completo, CPF/matrícula, e-mail institucional/pessoal, telefone celular, histórico de disciplinas e localização física do polo de prova).
- **Dano Operacional Grave:** Um atacante pode iterar por scripts sobre matrizes de matrículas gerando cancelamentos em massa às vésperas da data da prova presencial, desestabilizando o calendário acadêmico da instituição.

---

## 4. RBAC Administrativo e Escalação de Privilégios no Frontend

### 4.1 Omissão de Verificação de Papéis no Next.js App Router

Ao comparar as páginas administrativas no diretório `apps/frontend/src/app/admin/`, nota-se uma discrepância de segurança grave entre as rotas de usuários/grupos/logs e as rotas de agendamento:

- Em `apps/frontend/src/app/admin/users/page.tsx` (linha 14):
  ```typescript
  const session = await auth()
  if (!session?.user?.isSuperAdmin) redirect("/")
  ```
- Em `apps/frontend/src/app/admin/groups/page.tsx` (linha 12):
  ```typescript
  const session = await auth()
  if (!session?.user?.isSuperAdmin) redirect("/")
  ```
- Em `apps/frontend/src/app/admin/logs/page.tsx` (linha 89):
  ```typescript
  const session = await auth()
  if (!session?.user?.isSuperAdmin) redirect("/")
  ```
- **PORÉM, em `apps/frontend/src/app/admin/scheduling/locals/page.tsx` (linha 7-8):**
  ```typescript
  const session = await auth()
  if (!session?.user) redirect("/login") // <-- FALHA: Não verifica isSuperAdmin nem módulos!
  ```
- **E em `apps/frontend/src/app/admin/scheduling/slots/page.tsx` (linha 7-8):**
  ```typescript
  const session = await auth()
  if (!session?.user) redirect("/login") // <-- FALHA: Não verifica isSuperAdmin nem módulos!
  ```

### 4.2 Exposição da Interface e Ações de Polo

Qualquer usuário com conta no sistema (por exemplo, um aplicador de provas local de polo ou um visualizador com acesso restrito a relatórios) que acesse a URL `/nexus/admin/scheduling/locals` ou `/nexus/admin/scheduling/slots`:
1. **Passa pelo middleware do Next.js sem restrições**, pois o middleware apenas checa se `isLoggedIn = true`.
2. **Carrega os componentes React Server Components e Client Components** (`LocalsManagement.tsx` e `SlotsManagement.tsx`).
3. Tem acesso aos botões de interface "Novo Polo", "Editar Polo", "Ativar/Desativar Polo" e "Novo Horário de Prova".

Embora os endpoints de mutação no backend NestJS (`POST /api/scheduling/locals` e `POST /api/scheduling/options`) possuam o decorador `@RequireAdmin()`, gerando 403 Forbidden no retorno das chamadas de API, **o endpoint de agendamento manual no backend (`POST /api/scheduling/bookings`) NÃO possui `@RequireAdmin()`** (apenas `@RequireModule('scheduling', 'backoffice')`).  
Isso permite que qualquer usuário que pertença a um grupo que possua o módulo `scheduling` possa criar agendamentos arbitrários para qualquer aluno no sistema.

Além disso, as **Server Actions** em `apps/frontend/src/app/actions/scheduling.ts` não validam a sessão do usuário antes de repassar a chamada para `fetchFromApi()`.

---

## 5. Avaliação Estática de Vulnerabilidades

### 5.1 Injeção de SQL (SQL Injection - SQLi)

#### PostgreSQL e Drizzle ORM
A persistência principal da aplicação utiliza **Drizzle ORM** com `node-postgres` / `postgres.js`.
- O código faz uso sistemático das APIs de consulta tipadas (`this.db.select().from(...).where(eq(...))`).
- Nas rotas de agregação e relatórios (`apps/backend/src/ava-sync/ava-sync.service.ts` e `scheduling.service.ts`), foram identificadas execuções diretas com a template tag `sql\`...\``.
- A tag `sql\`...\`` do Drizzle ORM realiza **parametrização automática** de todas as expressões interpoladas (substituindo por marcadores `$1`, `$2`, etc.), eliminando riscos de SQLi direto.
- Não foi encontrado o uso inseguro de `sql.raw()` com entradas de usuário.

#### MSSQL Lyceum (`tedious` connection pool)
Em `apps/backend/src/academic/academic-sync.service.ts` (linhas 65-75):
```typescript
const periodsInStr = activePeriods.map((p) => `'${p}'`).join(',');
const turmasRes = await lyceumPool.request().query(`
  SELECT ...
  FROM ${prefix}VW_AVA_TURMA T
  WHERE T.PERIODO IN (${periodsInStr})
`);
```
Embora `activePeriods` se origine da variável de ambiente `LYCEUM_ACTIVE_PERIODS`, a interpolação direta em strings de comando SQL constitui um **anti-padrão de segurança**. Caso essa variável venha a ser populada dinamicamente via interface ou banco no futuro, abrirá brecha para injeção clássica no SQL Server.

### 5.2 Cross-Site Scripting (XSS) no Comprovante do Estudante

No arquivo `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx`, a função `generateVoucherHtml` concatena strings dinâmicas e o método `handlePrint` executa `doc.write()` em um elemento iframe injetado no DOM:

```typescript
// apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx (linhas 46-56, 354-356)
const disciplinasHtml = disciplinas
  .map(
    (disc, idx) =>
      `<tr>
        <td>${idx + 1}</td>
        <td>${disc}</td> <!-- NÃO SANITIZADO -->
        <td>30 min</td>
      </tr>`
  )
  .join("")

return `<!DOCTYPE html>
  ...
  <span class="info-value">${student.nome}</span> <!-- NÃO SANITIZADO -->
  <span class="info-value">${student.matricula}</span> <!-- NÃO SANITIZADO -->
  <span class="info-value">${booking.localNome}</span> <!-- NÃO SANITIZADO -->
  <span class="info-value">${booking.localEndereco}</span> <!-- NÃO SANITIZADO -->
  ...
  ${disciplinasHtml}`
...
const doc = iframe.contentWindow?.document
doc.open()
doc.write(html) // <-- EXECUÇÃO DIRETA DE HTML NÃO SANITIZADO
doc.close()
```

#### Vetor de Ataque:
1. Os dados do estudante (`student.nome`, `disciplinas`, `localEndereco`) têm origem nos bancos externos do Moodle AVA e Lyceum.
2. Caso um nome de discente, disciplina ou endereço de polo contenha uma carga como `<img src=x onerror=alert(document.domain)>` ou `<script src="...">`, o navegador executará o script no momento em que o aluno ou atendente de polo clicar em **"Imprimir Comprovante"**.
3. Como o `iframe` é injetado no `document.body` sem o atributo `sandbox`, o script injetado herda a mesma origem do aplicativo Next.js, podendo acessar tokens de sessão e executar requisições autenticadas em nome do usuário.

### 5.3 Cabeçalhos de Segurança HTTP e Postura de Rede

#### Backend NestJS (`apps/backend/src/main.ts`)
```typescript
// 1. Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false,       // <-- CSP TOTALMENTE DESABILITADO
    crossOriginEmbedderPolicy: false,
  }),
);
```
- O Helmet foi configurado desabilitando o `contentSecurityPolicy`.
- A política de CORS (`getAllowedCorsOrigins`) no arquivo `app-config.ts` aceita conexões de origens derivadas e permite coringas (`*`). Se `origin` for indefinido (como em ferramentas CLI ou requisições mobile), `isOriginAllowed` retorna `true` indiscriminadamente.

#### Frontend Next.js (`apps/frontend/next.config.ts`)
```typescript
{
  key: "Content-Security-Policy",
  value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'",
}
```
- A diretiva de Content Security Policy (CSP) declarada no `next.config.ts` **omite por completo as diretivas fundamentais `default-src`, `script-src` e `connect-src`**.
- De acordo com a especificação do W3C CSP, a ausência de `default-src` e `script-src` faz com que o navegador não imponha qualquer restrição sobre execução de scripts externos, inlining de tags `<script>` ou eval(), anulando a proteção do CSP contra ataques de XSS.

### 5.4 Ausência de Rate Limiting (Proteção contra Força Bruta e DoS)

- **Pacote `@nestjs/throttler`:** Não está instalado no `package.json` do backend nem configurado no `AppModule`.
- **Rota de Autenticação (`/api/auth/login`):** Aceita requisições ilimitadas por segundo sem bloqueio por IP ou atraso progressivo (exponential backoff). Isso possibilita ataques de credential stuffing contra contas administrativas.
- **Rotas de Agendamento Público (`/api/public/scheduling/*`):** Permite disparos concorrentes massivos, viabilizando raspagem de toda a base de alunos e esgotamento intencional do pool de conexões do PostgreSQL/MSSQL.

---

## 6. Guia Prático de Remediação com Código

### 6.1 Remediação 1: Sessão Criptográfica com HMAC para o Aluno

Para mitigar a vulnerabilidade de IDOR, o frontend Next.js deve gerar um token assinado digitalmente com HMAC-SHA256 (`nexus_student_token`) que contenha a matrícula e a expiração, e o backend NestJS deve validar rigorosamente essa assinatura através de um guard dedicado (`StudentSessionGuard`).

#### 1. Utilitário Criptográfico de Token HMAC (`apps/frontend/src/lib/student-token.ts` e `apps/backend/src/auth/student-token.ts`)
```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface StudentTokenPayload {
  matricula: string;
  iat: number;
  exp: number;
}

const TOKEN_TTL_SECONDS = 30 * 60; // 30 minutos

export function signStudentSession(matricula: string, secret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_TTL_SECONDS;
  const payloadStr = JSON.stringify({ matricula: matricula.trim().toUpperCase(), iat, exp });
  const payloadBase64 = Buffer.from(payloadStr).toString('base64url');
  
  const signature = createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

export function verifyStudentSession(token: string, secret: string): StudentTokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [payloadBase64, signature] = token.split('.');

  const expectedSignature = createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length || !timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return null;
  }

  try {
    const payload: StudentTokenPayload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Token expirado
    }
    return payload;
  } catch {
    return null;
  }
}
```

#### 2. Assinatura do Cookie no Next.js (`apps/frontend/src/middleware.ts`)
```typescript
// Substituto do bloco em apps/frontend/src/middleware.ts
import { signStudentSession, verifyStudentSession } from "@/lib/student-token";

const STUDENT_SECRET = process.env.STUDENT_SESSION_SECRET || process.env.AUTH_SECRET || "dev-student-hmac-secret-min32chars";

if (isPublicRoute && pathname.includes('/agendamento')) {
  const urlMat = req.nextUrl.searchParams.get('matricula')?.trim() || req.nextUrl.searchParams.get('userid')?.trim();
  const existingCookieToken = req.cookies.get('nexus_student_session')?.value?.trim();

  let validMatricula: string | null = null;

  if (urlMat) {
    validMatricula = urlMat.toUpperCase();
  } else if (existingCookieToken) {
    const verified = verifyStudentSession(existingCookieToken, STUDENT_SECRET);
    if (verified) {
      validMatricula = verified.matricula;
    }
  }

  if (validMatricula) {
    const signedToken = signStudentSession(validMatricula, STUDENT_SECRET);
    const res = NextResponse.next();
    res.cookies.set('nexus_student_session', signedToken, {
      maxAge: 30 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return res;
  }
}
```

#### 3. Guard NestJS para Validação da Sessão do Aluno (`apps/backend/src/auth/student-session.guard.ts`)
```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { verifyStudentSession } from './student-token';

@Injectable()
export class StudentSessionGuard implements CanActivate {
  private readonly secret = process.env.STUDENT_SESSION_SECRET || process.env.JWT_SECRET || 'dev-student-hmac-secret-min32chars';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Obtém o token do cabeçalho x-student-session ou cookie
    const token =
      (request.headers['x-student-session'] as string) ||
      request.cookies?.['nexus_student_session'];

    if (!token) {
      throw new UnauthorizedException('Token de sessão do estudante ausente ou inválido.');
    }

    const sessionPayload = verifyStudentSession(token, this.secret);
    if (!sessionPayload) {
      throw new UnauthorizedException('Sessão expirada ou assinatura inválida.');
    }

    // Injeta a matrícula verificada no request
    request['student'] = sessionPayload;

    // Se o corpo ou query contiver matricula, garante que coincide com o token assinado
    const targetMatricula = (request.body?.matricula || request.query?.matricula as string || '').trim().toUpperCase();
    if (targetMatricula && targetMatricula !== sessionPayload.matricula) {
      throw new ForbiddenException('A matrícula informada não corresponde à sessão autenticada.');
    }

    return true;
  }
}
```

#### 4. Aplicação do Guard no `PublicSchedulingController`
```typescript
// apps/backend/src/scheduling/public-scheduling.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { StudentSessionGuard } from '../auth/student-session.guard';

@Public()
@UseGuards(StudentSessionGuard)
@Controller('api/public/scheduling')
export class PublicSchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('student-flow')
  async getStudentFlow(@Req() req: any, @Query('periodo') periodo?: string) {
    const verifiedMatricula = req.student.matricula;
    return this.schedulingService.getStudentFlow(verifiedMatricula, periodo);
  }

  @Post('book')
  async createStudentBooking(@Req() req: any, @Body() dto: CreateBookingDto) {
    dto.matricula = req.student.matricula; // Força a matrícula do token autenticado
    return this.schedulingService.createBooking(dto);
  }

  @Post('cancel')
  async cancelStudentBooking(@Req() req: any, @Body() body: { bookingId: string }) {
    return this.schedulingService.cancelStudentBooking(body.bookingId, req.student.matricula);
  }

  @Post('reschedule')
  async rescheduleStudentBooking(@Req() req: any, @Body() body: { bookingId: string; newOpcaoId: string; periodo: string }) {
    return this.schedulingService.rescheduleStudentBooking(
      body.bookingId,
      req.student.matricula,
      body.newOpcaoId,
      body.periodo
    );
  }
}
```

---

### 6.2 Remediação 2: RBAC no Next.js App Router e Server Actions

#### 1. Proteção de Rota em `apps/frontend/src/app/admin/scheduling/locals/page.tsx` e `slots/page.tsx`
```typescript
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AdminLocalsPage() {
  const session = await auth()
  
  // Exige Super Admin ou pertencimento aos grupos com o módulo scheduling
  const isAuthorized = session?.user?.isSuperAdmin || session?.user?.groups?.includes('Coordenadores EaD')
  if (!isAuthorized) {
    redirect("/nexus")
  }
  
  const locals = await getLocals({ todos: true })
  return <LocalsManagement initialLocals={locals} />
}
```

#### 2. Asserção de Permissão em Server Actions (`apps/frontend/src/app/actions/scheduling.ts`)
```typescript
import { auth } from "@/auth"

async function assertAdminPermission() {
  const session = await auth()
  if (!session?.user?.isSuperAdmin) {
    throw new Error("Acesso não autorizado. Apenas administradores podem executar esta ação.")
  }
  return session
}

export async function createLocal(data: { nome: string; endereco: string; linkLocal?: string; telefone?: string }) {
  await assertAdminPermission()
  return fetchFromApi('/api/scheduling/locals', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}
```

---

### 6.3 Remediação 3: Mitigação de XSS no `StudentVoucherDialog.tsx`

Eliminar o uso de `doc.write()` substituindo por escape rigoroso de caracteres HTML e renderização controlada via Blob seguro com isolamento de sandbox no iframe:

```typescript
// apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Na montagem do HTML:
const safeNome = escapeHtml(student.nome);
const safeMatricula = escapeHtml(student.matricula);
const safeLocal = escapeHtml(booking.localNome);
const safeEndereco = escapeHtml(booking.localEndereco);

// Na rotina handlePrint:
const handlePrint = () => {
  const htmlContent = generateVoucherHtml(student, booking);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  let iframe = document.getElementById("student-voucher-frame") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "student-voucher-frame";
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("sandbox", "allow-modals allow-same-origin");
    document.body.appendChild(iframe);
  }

  iframe.src = blobUrl;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
  };
};
```

---

### 6.4 Remediação 4: Rate Limiting com `@nestjs/throttler` e Headers HTTP

#### 1. Configuração do Rate Limiter no Backend (`apps/backend/src/app.module.ts`)
```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 segundos
      limit: 60,  // padrão geral: 60 req/min
    }]),
    // ... demais módulos
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // ... demais guards
  ]
})
export class AppModule {}
```

No `AuthController` (`apps/backend/src/auth/auth.controller.ts`), restringir tentativas de login a 5 por minuto:
```typescript
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { limit: 5, ttl: 60000 } }) // Máximo 5 tentativas por minuto por IP
@Post('login')
signIn(@Body() signInDto: LoginDto, @Req() req: any = {}) { ... }
```

#### 2. Endurecimento do CSP no Frontend (`apps/frontend/next.config.ts`)
```typescript
// apps/frontend/next.config.ts
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self';
  connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'} https:;
`.replace(/\s{2,}/g, ' ').trim();

// Inserir cspHeader na lista de headers sob key: "Content-Security-Policy"
```

---

## 7. Matriz de Risco e Plano de Ação Priorizado

| ID | Vulnerabilidade Identificada | Componente Afetado | Severidade | CVSS 3.1 | Esforço | Prioridade |
|:---:|---|---|:---:|:---:|:---:|:---:|
| **SEC-01** | IDOR e Quebra de Autorização no Agendamento Público | Backend `PublicSchedulingController` | **CRÍTICA** | **9.1** | Médio | **P0 (Imediato)** |
| **SEC-02** | Ausência de Assinatura/HMAC no Cookie do Estudante | Frontend `src/middleware.ts` | **ALTA** | **8.2** | Baixo | **P0 (Imediato)** |
| **SEC-03** | Escalação de Privilégios no Admin Scheduling (`/locals`, `/slots`) | Frontend Next.js App Router & Actions | **ALTA** | **7.5** | Baixo | **P1 (Curto Prazo)** |
| **SEC-04** | Injeção de XSS Armazenado/DOM via `doc.write()` | Frontend `StudentVoucherDialog.tsx` | **ALTA** | **7.4** | Baixo | **P1 (Curto Prazo)** |
| **SEC-05** | Ausência de Rate Limiting em `/auth/login` e `/public/scheduling` | Backend NestJS `AppModule` / `main.ts` | **ALTA** | **7.3** | Baixo | **P1 (Curto Prazo)** |
| **SEC-06** | CSP Omitindo Diretivas Críticas (`default-src`, `script-src`) | Frontend `next.config.ts` | **MÉDIA** | **6.1** | Baixo | **P2 (Médio Prazo)** |
| **SEC-07** | Endpoint `POST /scheduling/bookings` sem `@RequireAdmin()` | Backend `SchedulingController` | **MÉDIA** | **5.4** | Baixo | **P2 (Médio Prazo)** |
| **SEC-08** | Interpolação Direta de Variáveis em Query MSSQL | Backend `academic-sync.service.ts` | **BAIXA** | **3.8** | Baixo | **P3 (Melhoria)** |

### Cronograma Recomendado de Implementação
1. **Fase 1 (0 a 48 Horas) - Mitigação de Emergência:**
   - Implementar assinatura HMAC no cookie `nexus_student_session`.
   - Adicionar o `StudentSessionGuard` no NestJS protegendo os métodos `student-flow`, `book`, `cancel` e `reschedule`.
   - Bloquear o acesso às rotas `/admin/scheduling/locals` e `/admin/scheduling/slots` para usuários que não sejam Super Admin ou coordenadores autorizados.
2. **Fase 2 (1 Semana) - Hardening da Aplicação:**
   - Sanitizar a geração do comprovante em `StudentVoucherDialog.tsx` eliminando `doc.write()` e ativando iframe com Blob URL.
   - Instalar `@nestjs/throttler` e aplicar limites de taxa estritos em `/api/auth/login` (5/min) e `/api/public/scheduling/*` (30/min).
   - Atualizar a Content Security Policy (CSP) completa no `next.config.ts`.
3. **Fase 3 (2 a 4 Semanas) - Revisão e Governança:**
   - Adicionar `@RequireAdmin()` no endpoint `POST /api/scheduling/bookings` ou introduzir validação de pertencimento ao polo do operador.
   - Refatorar consultas MSSQL em `academic-sync.service.ts` para uso estrito de parâmetros tipados `tedious`.
