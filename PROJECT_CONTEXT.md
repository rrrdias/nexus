# Nexus Core - Memoria de Contexto do Projeto

Ultima analise: 2026-09-15.

## Visao Geral

Nexus Core e um monorepo Node.js gerenciado por npm workspaces e Turbo. A aplicacao une:

- Frontend: Next.js App Router, React, NextAuth v5, Tailwind/shadcn-like components, porta 3002, basePath `/nexus`.
- Backend: NestJS 11, Drizzle ORM, PostgreSQL, JWT, porta 3004.
- Banco principal: PostgreSQL 16.
- Integracoes externas: Moodle/OpenLMS por endpoints JSON e Lyceum via SQL Server (`mssql`).
- Deploy: Docker Compose com proxy Nginx em `/nexus` para frontend e `/nexus-api/` para backend.

## Estrutura Principal

- `apps/backend`: API NestJS, regras de negocio, integracoes e schema Drizzle.
- `apps/frontend`: interface Next.js, autenticacao via NextAuth e server actions que chamam o backend.
- `nginx`: configuracoes de proxy reverso.
- `docker-compose.yml`: ambiente local/dev com Postgres, backend e frontend.
- `docker-compose.prod.yml`: ambiente de producao com variaveis da raiz `.env`.
- `AUDIT_REPORT_AND_ACTION_PLAN.md`: auditoria tecnica anterior. Parte dos itens ja foi corrigida no codigo atual.
- `DEPLOY_AND_OPERATIONS_MANUAL.md`: manual de operacao, portas, env vars, Nginx e cron de sincronizacao.

## Scripts

Raiz:

- `npm run dev`: `turbo run dev`
- `npm run build`: `turbo run build`
- `npm run lint`: `turbo run lint`

Backend:

- `npm run dev -w @nexus-core/backend`: Nest watch.
- `npm run build -w @nexus-core/backend`: build Nest.
- `npm run test -w @nexus-core/backend`: Jest.
- `npm run db:push -w @nexus-core/backend`: Drizzle push.
- `npm run db:seed -w @nexus-core/backend`: seed inicial.

Frontend:

- `npm run dev -w @nexus-core/frontend`: Next dev na porta 3002.
- `npm run build -w @nexus-core/frontend`: Next build.
- `npm run lint -w @nexus-core/frontend`: ESLint.

## Modulos Funcionais

### 1. Autenticacao e sessao

Backend:

- `apps/backend/src/auth`
- Login em `POST /api/auth/login`.
- JWT emitido pelo backend com `sub`, `email`, `isSuperAdmin`, `isDisabled`.
- `JwtAuthGuard` e global em `AppModule`.
- Rotas publicas usam `@Public()` e tambem ha liberacao estrita para `/api/auth/login` e `/api/ava-sync`.
- O guard consulta o banco para validar se o usuario ainda esta ativo, com cache TTL de 30 segundos.

Frontend:

- `apps/frontend/src/auth.ts`
- NextAuth Credentials chama o backend em `/api/auth/login`.
- Sessao JWT dura 30 minutos.
- `middleware.ts` protege rotas, redireciona usuarios nao autenticados para `/nexus/login` e usuarios autenticados para `/nexus`.
- `fetchFromApi` injeta o Bearer token e trata `NEXT_REDIRECT`.

### 2. Usuarios e grupos

Backend:

- `apps/backend/src/users`
- `apps/backend/src/groups`
- Rotas em `/api/users` e `/api/groups`.
- CRUD restrito a `Super Admin`.
- Usuario possui grupos e acessos diretos a modulos.
- Grupo possui acessos a modulos.

Frontend:

- `apps/frontend/src/app/admin/users`
- `apps/frontend/src/app/admin/groups`
- Actions em `apps/frontend/src/app/actions/users.ts` e `groups.ts`.

Tabelas:

- `user`
- `group`
- `user_group`
- `system_module`
- `users_system_access`
- `group_system_access`

### 3. Sistema, sidebar e dashboard admin

Backend:

- `apps/backend/src/system`
- Rotas:
  - `GET /api/system/modules`
  - `GET /api/system/sidebar-modules`
  - `GET /api/system/admin-dashboard`
- Registra atividade do usuario e monta modulos disponiveis.

Frontend:

- `apps/frontend/src/components/Sidebar.tsx`
- `apps/frontend/src/components/SidebarClient.tsx`
- Home em `apps/frontend/src/app/page.tsx`.
- Usuarios comuns veem dashboard conforme modulos permitidos; Super Admin ve dashboard tecnico.

### 4. AVA Reports

Objetivo: relatorios academicos do Moodle/OpenLMS por instituicao.

Backend:

- `apps/backend/src/ava-reports`
- Rotas:
  - `POST /api/ava-reports/progress`
  - `POST /api/ava-reports/progress/export`
  - `POST /api/ava-reports/grades`
  - `POST /api/ava-reports/grades/export`
  - `POST /api/ava-reports/consolidated`
  - `POST /api/ava-reports/consolidated/export`
  - `POST /api/ava-reports/sync`
  - `GET /api/ava-reports/dashboard-stats`
- Acesso exige Super Admin ou modulo ativo com slug `ava`, direto ou por grupo.
- Filtros padrao tendem ao periodo `2026-2`.
- Progresso e consolidado usam contagem/paginacao SQL e agregacoes no PostgreSQL.
- Exportacoes possuem teto de seguranca em alguns endpoints.

Frontend:

- Hub: `apps/frontend/src/app/relatorios/page.tsx`
- Progresso: `apps/frontend/src/app/relatorios/progresso/*`
- Notas: `apps/frontend/src/app/relatorios/notas/*`
- Consolidado: `apps/frontend/src/app/relatorios/consolidado/*`
- Componentes em `apps/frontend/src/components/ava-reports`.
- Instituicoes: `ead`, `uni`, `uniego`, `raizes`, `eefn`; ha sync de notas para `pos`.

Tabelas:

- `ava_progress_report`
- `ava_grades_report`
- `ava_consolidated_report`

### 5. AVA Sync / Moodle

Backend:

- `apps/backend/src/ava-sync`
- Rota publica com segredo proprio: `GET /api/ava-sync?institution=&type=`.
- Autorizacao via header `Authorization: Bearer ${CRON_SECRET}` com `timingSafeEqual`.
- Busca JSON em URLs Moodle configuradas por env.
- Grava dados em chunks de 250.
- Usa `onConflictDoUpdate` com deduplicacao local.
- Atualiza snapshot consolidado apos sync de progresso/notas.
- `onModuleInit` valida extensao `pg_trgm`, indices e tabela consolidada.

Cron recomendado:

- Progresso a cada 30 minutos.
- Notas a cada 2 horas.

### 6. Agendamento / Backoffice de provas

Backend:

- `apps/backend/src/scheduling`
- Rotas em `/api/scheduling`.
- Funcionalidades:
  - CRUD de locais/campus.
  - CRUD de opcoes/slots de horario.
  - Consulta de perfil do estudante via dados AVA.
  - Criacao de agendamento com reserva transacional e decremento de vagas em slots consecutivos.
  - Cancelamento com devolucao de vagas.
  - Marcar presenca e falta.
  - Listagem paginada e export CSV.
  - Importacao em massa.
- Mutacoes administrativas chamam `assertSchedulingAdminAccess`.
- Acesso admin exige Super Admin ou modulo `backoffice`/`scheduling`.
- Criacao de slot valida horario HH:MM e usa laco finito de 30 min.

Frontend:

- `apps/frontend/src/app/admin/scheduling`
- Subtelas:
  - `/admin/scheduling`
  - `/admin/scheduling/locals`
  - `/admin/scheduling/slots`
- Actions em `apps/frontend/src/app/actions/scheduling.ts`.

Tabelas:

- `local`
- `opcao`
- `agendamentos_matricula`

### 7. Modulo Academico / Lyceum

Backend:

- `apps/backend/src/academic`
- Rotas:
  - `POST /api/academic/sync`
  - `GET /api/academic/discentes`
  - `GET /api/academic/discentes/:matricula/disciplinas`
  - `GET /api/academic/docentes`
  - `GET /api/academic/docentes/:docenteId/disciplinas`
  - `GET /api/academic/turmas`
  - `GET /api/academic/matriculas`
- Conecta ao SQL Server Lyceum no `onModuleInit`.
- Consulta views `VW_AVA_*`.
- Sincronizacao diaria as 03:00 via `@Cron('0 3 * * *')`.
- `syncActivePeriods` usa `LYCEUM_ACTIVE_PERIODS` com fallback para periodos de 2024 a 2027.
- Cacheia turmas, discentes, docentes e matriculas em tabelas PostgreSQL.
- Auto-seed cria modulo `academic` se ausente e concede ao grupo `Super Admin`.

Frontend:

- `apps/frontend/src/app/academic`
- `AcademicDashboard.tsx` oferece consultas por abas e sync manual.
- Actions em `apps/frontend/src/app/actions/academic.ts`.

Tabelas:

- `academic_turma`
- `academic_discente`
- `academic_docente`
- `academic_matricula`

## Observacoes Tecnicas e Riscos Atuais

- O arquivo `.env` existe na raiz e nao deve ser exposto. Nao copiar segredos para documentacao ou commits.
- `docker-compose.yml` local contem credenciais simples/hardcoded para dev.
- `next.config.ts` ainda esta com `typescript.ignoreBuildErrors: true`; isso permite deploy com erro de tipo.
- CORS no backend ainda e permissivo: quando a origem nao bate com localhost/unievangelica, o callback tambem libera.
- `AcademicSyncService` ainda monta alguns `IN (...)` dinamicos em SQL Server. Ha sanitizacao parcial dos IDs, mas o ideal e parametrizar ou usar tabela temporaria/batch seguro.
- `AvaSyncService.refreshConsolidatedSnapshot` usa conflito em `("sourceInstitution", aluno_id, curso)`. Se `aluno_id` ficar vazio/nulo, pode haver inconsistencias; progresso ja tenta fallback para matricula/usuario.
- `AvaReportsService.getGradesData` e grande e merece revisao especifica antes de alteracoes de desempenho/metricas.
- Algumas datas/periodos estao hardcoded (`2026-2`, janelas de fase em 2026).
- `AcademicPage` protege apenas autenticacao no frontend; permissao real de modulo deve ser reforcada no backend se necessario, pois consultas academicas GET nao checam slug `academic` hoje.
- Frontend usa basePath fixo `/nexus`; cuidar de links, redirects e `AUTH_URL`.

## Pontos Ja Corrigidos em Relacao a Auditoria Antiga

- `JwtAuthGuard` nao usa mais `request.url.includes()` para liberar login; usa rota normalizada e `@Public()`.
- `AuthService` nao possui mais email de Super Admin hardcoded; usa grupo `Super Admin`.
- `SchedulingController` ja chama validacao de acesso admin nas mutacoes.
- Criacao de opcoes de agendamento nao usa mais `while (true)` vulneravel; valida horario e usa loop finito.
- `fetchFromApi` preserva erros `NEXT_REDIRECT`.
- `nginx/nexus.conf` aponta `/nexus-api/` para porta 3004.
- `AcademicSyncService` hoje preenche `matricula` e `usuario` com fallback, em vez de inserir nulo.

## Convenções Para Implementacoes Futuras

- Preferir manter regras sensiveis de permissao no backend, nao apenas na UI.
- Server actions do frontend devem continuar usando `fetchFromApi`.
- Novos modulos devem ser cadastrados em `system_module` e respeitar acesso por usuario/grupo.
- Para queries volumosas, empurrar filtros, contagens, paginacao e agregacoes para SQL.
- Evitar novos periodos/datas hardcoded; preferir env/config/tabela.
- Antes de alterar relatorios AVA, validar impacto nos componentes `DashboardProgresso`, `DashboardNotas`, `ConsolidatedDashboard` e `ConsolidatedEadDashboard`.
- Antes de alterar auth/basePath, testar login, middleware, signOut e redirects sob `/nexus`.
