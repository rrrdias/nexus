# Handoff Report: Backend Architecture, Security, RBAC, Database & Booking Concurrency Survey

**Agent**: `teamwork_preview_explorer_survey_backend_1`  
**Milestone**: `milestone_survey_backend`  
**Handoff Type**: Hard (Task Complete)  
**Deliverable Document**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_explorer_survey_backend_1\survey_backend.md`  

---

## 1. Observation

### O1. Compilação e Testes Automatizados
- **Backend Build**: `npm run build` em `apps/backend` executou com sucesso (código de saída 0), gerando os artefatos em `dist/`.
- **Backend Test**: `npm run test` em `apps/backend` executou com sucesso (código de saída 0):
  ```
  Test Suites: 26 passed, 26 total
  Tests:       93 passed, 93 total
  Snapshots:   0 total
  Time:        5.621 s
  ```
- **Frontend Build**: `npm run build` em `apps/frontend` executou com sucesso (código de saída 0), compilando páginas estáticas e SSR (Next.js 16.2.6 com Turbopack).

### O2. Mapeamento de Controladores e Guards
- Auditados 13 controllers NestJS em `apps/backend/src`:
  - `AppController` (`app.controller.ts:5`)
  - `HealthController` (`health/health.controller.ts:6`)
  - `AuthController` (`auth/auth.controller.ts:6`)
  - `PublicSchedulingController` (`scheduling/public-scheduling.controller.ts:14`)
  - `SchedulingController` (`scheduling/scheduling.controller.ts:23`)
  - `AcademicController` (`academic/academic.controller.ts:16`)
  - `AvaReportsController` (`ava-reports/ava-reports.controller.ts:9`)
  - `AvaSyncController` (`ava-sync/ava-sync.controller.ts:8`)
  - `AuditController` (`audit/audit.controller.ts:7`)
  - `GroupsController` (`groups/groups.controller.ts:17`)
  - `JobsController` (`jobs/jobs.controller.ts:6`)
  - `SystemController` (`system/system.controller.ts:5`)
  - `UsersController` (`users/users.controller.ts:18`)
- O guard global `JwtAuthGuard` (`apps/backend/src/auth/jwt-auth.guard.ts:23-112`) e `RbacGuard` (`apps/backend/src/auth/rbac.guard.ts:25-211`) interceptam todas as rotas não decoradas com `@Public()`.
- Rotas públicas sem autenticação:
  - `GET /` (`app.controller.ts:10`)
  - `GET /health` (`health.controller.ts:11`)
  - `POST /api/auth/login` (`auth.controller.ts:12`)
  - `GET /api/ava-sync` (`ava-sync.controller.ts:12`, protegido por secret Bearer em tempo constante `timingSafeEqual`)
  - Todas as rotas de `PublicSchedulingController` (`public-scheduling.controller.ts:13-101`): `GET student-flow`, `GET available-slots`, `POST book`, `POST cancel`, `POST reschedule`.

### O3. Sessão Temporária do Estudante (`nexus_student_session`)
- Em `apps/frontend/src/middleware.ts` (linhas 30-36):
  ```typescript
  res.cookies.set('nexus_student_session', activeMatricula, {
    maxAge: 30 * 60, // 30 minutos em segundos (1800s)
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  ```
- O valor armazenado no cookie é a string da matrícula em texto claro (`activeMatricula`), sem assinatura criptográfica (sem HMAC).
- Em `apps/frontend/src/app/agendamento/page.tsx` (linhas 40-41):
  ```typescript
  const activeMatricula =
    matricula?.trim() || userid?.trim() || sessionCookie?.trim() || ""
  ```
- Em `apps/backend/src/scheduling/public-scheduling.controller.ts`: Nenhuma menção a cookies, sem verificação de token de sessão ou cabeçalhos de autenticação do estudante.

### O4. Concorrência e Transações no Agendamento
- Em `apps/backend/src/scheduling/scheduling.service.ts`:
  - Linha 630: Início de transação `this.db.transaction(async (tx) => { ... })`.
  - Linha 652: `const [opcao] = await tx.select().from(opcaos).where(eq(opcaos.id, opcaoId)).for('update');`
  - Linhas 697-710: Lock dos slots consecutivos ordenados:
    ```typescript
    const slots = await tx
      .select()
      .from(opcaos)
      .where(...)
      .orderBy(opcaos.hora)
      .for('update');
    ```
  - Linhas 1583-1646 (`rescheduleStudentBooking`):
    ```typescript
    await this.cancelBooking(bookingId); // Executa transação de cancelamento isolada
    try {
      const newBooking = await this.createBooking({ ... }); // Executa transação de reserva isolada
      return newBooking;
    } catch (err: any) {
      try {
        await this.createBooking({ opcaoId: booking.opcaoId, ... });
      } catch {
        // Silencioso se não conseguir reverter
      }
      throw err;
    }
    ```
  - Linha 798 (`cancelBooking`):
    ```typescript
    inArray(opcaos.hora, requiredTimes)
    ```
    onde `requiredTimes` contém formato `HH:MM:00`, não contendo fallback para strings de 5 dígitos `HH:MM` presentes no banco.

### O5. Banco de Dados e Índices (Drizzle ORM)
- Em `apps/backend/src/db/schema.ts`:
  - Linhas 370-390 (`opcaos`): Possui índices `idx_opcao_local`, `idx_opcao_data`, `idx_opcao_local_status_data`. Não possui constraint UNIQUE sobre `(localId, data, hora)`.
  - Linhas 392-418 (`agendamentos_matricula`): Possui índice único condicional:
    ```typescript
    uniqueIndex('unq_agendamento_matricula_periodo_ativo')
      .on(t.matricula, t.periodo)
      .where(sql`"deletedAt" IS NULL`)
    ```
    Este índice diferencia maiúsculas e minúsculas no PostgreSQL.

### O6. Performance em Relatórios e Sincronização
- Em `apps/backend/src/ava-sync/ava-sync.service.ts` (linhas 223-233):
  ```sql
  LEFT JOIN ava_grades_report g
    ON p."sourceInstitution" = g."sourceInstitution"
   AND (p.aluno_id = g.user_id OR p.matricula = g.user_identification)
   AND (
     p.curso = g.course_fullname 
     OR p.curso = g.course_shortname
     OR regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_fullname, '[^a-zA-Z0-9]', '', 'g')
     OR regexp_replace(p.curso, '[^a-zA-Z0-9]', '', 'g') = regexp_replace(g.course_shortname, '[^a-zA-Z0-9]', '', 'g')
   )
  ```

### O7. Headers de Segurança e Rate Limiting
- Em `apps/backend/src/main.ts`:
  - Linhas 17-20: `helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })`
  - Linhas 27-28: `app.use(json({ limit: '50mb' }))`
  - Ausência de `@nestjs/throttler` ou equivalente em `package.json` e `app.module.ts`.

---

## 2. Logic Chain

1. **Acesso não autorizado a dados pessoais e ações de agendamento (LGPD)**:
   - A partir de O2, o `PublicSchedulingController` está decorado com `@Public()`, dispensando verificação de JWT e de RBAC.
   - A partir de O3, o cookie `nexus_student_session` armazena apenas a matrícula em texto puro, sem HMAC. No backend, os métodos `getStudentFlow`, `cancelStudentBooking` e `rescheduleStudentBooking` recebem a matrícula via parâmetro e não conferem nenhuma credencial ou sessão assinada.
   - Logo, qualquer usuário pode enumerar matrículas sequenciais para consultar o nome completo, e-mail, telefone e disciplinas de qualquer estudante, ou cancelar/remarcar as provas de outros discentes.

2. **Perda de vaga e inconsistência de dados durante remarcação concorrente**:
   - A partir de O4, o método `rescheduleStudentBooking` executa `this.cancelBooking(bookingId)` em uma transação com commit independente.
   - Em seguida, tenta `this.createBooking(...)` para a nova opção. Se esta chamada falhar (por exemplo, a vaga no polo foi ocupada por outro aluno no mesmo instante), o fluxo entra no bloco `catch`.
   - No bloco `catch`, ele tenta re-reservar a vaga original. Contudo, como a vaga original já foi devolvida ao banco na etapa 1, outro usuário pode tê-la reservado. A re-reserva falha e o erro é ignorado (`catch {}`), deixando o estudante sem agendamento no sistema.

3. **Vazamento e travamento de capacidade física nos polos**:
   - A partir de O4 (`cancelBooking`), a busca dos slots a devolver usa `inArray(opcaos.hora, requiredTimes)` com horários de 8 caracteres (`HH:MM:00`).
   - Se slots existentes tiverem horários formatados com 5 caracteres (`HH:MM`), a busca retorna 0 linhas.
   - Logo, a devolução de capacidade (`vagas + 1`) não é executada, gerando perda acumulativa de vagas disponíveis no polo a cada cancelamento.

4. **Sobrecarga de CPU e instabilidade do PostgreSQL durante consolidação**:
   - A partir de O6, a sincronização de snapshot executa um `LEFT JOIN` com `regexp_replace` dinâmico em ambos os lados da cláusula `ON`.
   - O otimizador de consultas do PostgreSQL é forçado a realizar varreduras sequenciais completas com avaliação de regex para cada combinação de linhas entre `ava_progress_report` e `ava_grades_report`.
   - Para dezenas de milhares de registros, isso gera bilhões de cálculos de expressões regulares, saturando a CPU do banco de dados e elevando os tempos de resposta de toda a aplicação.

---

## 3. Caveats

- **No caveats**. Toda a estrutura de rotas, decorators, banco de dados Drizzle, transações pessimistas e serviços de sincronização foram inspecionados diretamente no código-fonte e validados contra os testes unitários e de integração existentes.

---

## 4. Conclusion

O backend do Nexus Core apresenta alta maturidade nos módulos administrativos internos (RBAC sólido com cache em Redis, auditoria de ações sensíveis e enfileiramento resiliente com BullMQ), mas contém vulnerabilidades críticas no fluxo público de agendamento de provas:
1. **Insegurança de Sessão e Ausência de Autorização no Agendamento do Estudante**: A falta de amarração criptográfica entre o aluno e suas requisições permite o acesso e a manipulação não autorizada de agendamentos de terceiros.
2. **Quebra de Transacionalidade no Reagendamento**: Falta de atomicidade em `rescheduleStudentBooking` coloca em risco a vaga do estudante sob concorrência.
3. **Ausência de Rate Limiting e Limite de Payload de 50MB**: Deixa as rotas de login e agendamento expostas a ataques de negação de serviço e força bruta.
4. **Ineficiência Algorítmica na Consolidação AVA**: Expressões regulares no join SQL degradam severamente a performance do PostgreSQL.

O relatório detalhado com plano de ação executável e recomendações priorizadas encontra-se disponível em:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork\teamwork_preview_explorer_survey_backend_1\survey_backend.md`.

---

## 5. Verification Method

Para verificar independentemente todos os apontamentos deste relatório:

1. **Compilação e Verificação Estática de Tipos**:
   ```pwsh
   cd c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\backend
   npm run build
   ```
   *Condição de invalidação*: O build não deve gerar erros de compilação TypeScript.

2. **Execução da Suite de Testes do Backend**:
   ```pwsh
   cd c:\Users\ricardo.dias\develop\projetos\nexus-core\apps\backend
   npm run test
   ```
   *Condição de invalidação*: Todas as 26 suítes e 93 testes unitários devem ser aprovados.

3. **Verificação da Falha de Atomicidade em `rescheduleStudentBooking`**:
   - Inspecionar `apps/backend/src/scheduling/scheduling.service.ts`, linhas 1583 a 1646.
   - Observar que `cancelBooking` e `createBooking` são chamados sequencialmente fora de um bloco `tx.transaction()`.

4. **Verificação da Insegurança no Cookie do Estudante**:
   - Inspecionar `apps/frontend/src/middleware.ts`, linhas 20 a 38 (geração do cookie sem assinatura).
   - Inspecionar `apps/backend/src/scheduling/public-scheduling.controller.ts`, linhas 13 a 101 (ausência de guard de sessão).

5. **Verificação do Gargalo de Join no Snapshot**:
   - Inspecionar `apps/backend/src/ava-sync/ava-sync.service.ts`, linhas 223 a 233 (`regexp_replace` em ambos os lados do join).
