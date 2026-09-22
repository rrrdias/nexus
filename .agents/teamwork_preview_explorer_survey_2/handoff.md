# Handoff Report — Auditoria Funcional de Ponta a Ponta Nexus Core

**Agent**: `teamwork_preview_explorer_survey_2`  
**Working Directory**: `c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork_preview_explorer_survey_2`  
**Milestone**: `survey_phase_2`  
**Report Artifact**: `functional_audit.md`  

---

## 1. Observation

Durante a investigação detalhada do monorepo Nexus Core, foram observados os seguintes fatos, comandos e trechos de código exatos:

1. **Build e Testes Automatizados**:
   - `npm run test`: **23 test suites passed, 65 tests passed (100% green)**. Tempo: 4.422s.
   - `npm run test:e2e`: **4 test suites passed, 12 tests passed (100% green)**. Tempo: 4.651s.
   - `npm run build`: Executou `turbo run build` com sucesso no `@nexus-core/backend` (NestJS build) e `@nexus-core/frontend` (Next.js 16.2.6 Turbopack, 30 rotas geradas).

2. **Fluxo de Autenticação**:
   - `apps/backend/src/auth/auth.module.ts:10`: `JwtModule.register({ secret: process.env.JWT_SECRET || 'nexus-secret-key-2026', signOptions: { expiresIn: '2h' } })`.
   - `apps/frontend/src/auth.ts:12-14`: `session: { strategy: "jwt", maxAge: 30 * 60, updateAge: 10 * 60 }`. O `accessToken` é armazenado estaticamente no token JWT do NextAuth. Não existe endpoint `/api/auth/refresh` no NestJS nem rotação de token no NextAuth.
   - `apps/frontend/src/middleware.ts:26`: `if (isLoggedIn && req.auth?.user?.isDisabled)`. No entanto, em `apps/frontend/src/auth.ts:41-76`, `isDisabled` não é preenchido no retorno de `authorize()`, `jwt()`, nem `session()`.
   - `apps/backend/src/auth/jwt-auth.guard.ts:18-20, 50-77`: Implementa `userActiveCache = new Map<string, UserActiveCacheEntry>()` com TTL de 30s.

3. **Fluxo de Relatórios AVA**:
   - `apps/backend/src/ava-sync/ava-sync.service.ts:121-215`: Atualiza a tabela `ava_consolidated_report` usando `ON CONFLICT ("sourceInstitution", aluno_id, curso) DO UPDATE`.
   - Rotas de Relatório no Frontend:
     - `apps/frontend/src/app/relatorios/consolidado/page.tsx:4`: Redireciona para `/relatorios/consolidado/ead`. Subpastas existem para `/ead`, `/uni`, `/uniego`, `/raizes`, `/eefn`.
     - `apps/frontend/src/app/relatorios/progresso/page.tsx:4-12`: Componente direto `ProgressoEaDPage`. Não existe a pasta `/relatorios/progresso/ead`. Acessar `/ead` resulta em 404.
     - `apps/frontend/src/app/relatorios/notas/page.tsx:4-12`: Componente direto `NotasEaDPage`. Não existe a pasta `/relatorios/notas/ead`. Acessar `/ead` resulta em 404.
   - `apps/frontend/src/components/SidebarClient.tsx:219-257`: A barra lateral possui apenas links para `/relatorios/consolidado/*`. Não possui links para `/relatorios/progresso` ou `/relatorios/notas`.
   - `apps/backend/src/config/app-config.ts:1, 29-43`: `DEFAULT_PERIOD = '2026-2'`. Porém as datas de fase em fallback em `getAcademicPhaseDates()` são de 2026-1 (fase 1: 13/02 a 29/03, fase 2: 30/03 a 11/05, fase 3: 12/05 a 19/06).

4. **Fluxo do Módulo Acadêmico**:
   - `apps/backend/src/academic/academic-sync.service.ts:135`: Durante a sincronização, executa `await tx.delete(academicMatricula)` antes de inserir as novas matrículas, truncando todas as matrículas locais de qualquer período.
   - `apps/backend/src/academic/academic-sync.service.ts:175-180`: IDs de discentes/docentes são sanitizados via `id.replace(/[^a-zA-Z0-9_-]/g, '')` antes da cláusula `IN (...)` do SQL Server.
   - `apps/backend/src/db/schema.ts:394-407`: `academicMatricula` possui constraint `unique("unq_ac_matricula").on(t.usuarioId, t.turmaId, t.nivel)`, mas não possui chave estrangeira explícita para `academicTurma` ou `academicDiscente`.
   - `apps/frontend/src/app/academic/AcademicDashboard.tsx:91-98`: A tabela permanece vazia (`listData: []`) até que `hasSearched === true`.

5. **Fluxo de Agendamentos e Gestão de Usuários / Grupos**:
   - `apps/backend/src/scheduling/scheduling.service.ts:253-330`: Criação de agendamento utiliza transação com `for update` no slot base e em todos os slots subsequentes correspondentes ao número de disciplinas do aluno.
   - `apps/frontend/src/app/api/scheduling/export/route.ts:12`: `const baseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://backend:3001"`. Idem em `bookings/route.ts:12`. (O backend roda na porta 3004).
   - `apps/frontend/src/app/admin/scheduling/SchedulingDashboard.tsx:337`: `window.open('/nexus/api/scheduling/export?${params.toString()}')`.
   - `apps/frontend/src/app/admin/scheduling/SchedulingDashboard.tsx:67, 88`: `useState(searchParams.get("periodo") || "2026-1")` (período default do componente é 2026-1 em desacordo com o default 2026-2 do sistema).

---

## 2. Logic Chain

1. **Da observação de validade de tokens à expiração de sessão**:
   - O backend emite JWTs com expiração estrita de 2h (`signOptions: { expiresIn: '2h' }`).
   - O frontend renova o cookie do NextAuth a cada 10 minutos de atividade (`updateAge: 10 * 60`).
   - Como o backend não expõe endpoint de refresh token e o NextAuth não possui callback de renovação do `accessToken`, após 120 minutos de navegação contínua, o token backend expira. A próxima chamada à API resultará em 401, acionando o redirecionamento para o login em `apps/frontend/src/app/actions/api.ts:27`.

2. **Da observação de rotas AVA à inconsistência de navegação**:
   - Em `/relatorios/consolidado`, cada instituição possui subrota física com `page.tsx` (`/ead`, `/uni`, etc.).
   - Em `/relatorios/progresso` e `/relatorios/notas`, o EaD é servido diretamente no index da pasta, sem pasta `/ead`.
   - Isso quebra a uniformidade da URL e impede que a sidebar crie links parametrizados simples para EaD em todos os tipos de relatório.

3. **Da observação de rede à falha de exportação de agendamentos**:
   - Ao clicar em "Exportar" no Painel de Agendamentos, o navegador abre `/nexus/api/scheduling/export?...`.
   - A rota de API Next.js atua como proxy reverso chamando `baseUrl/api/scheduling/export?...`.
   - Quando `NEXT_API_URL` não está explicitamente definida no `.env` do frontend, o fallback tenta se conectar em `http://backend:3001`. Como o NestJS atende na porta 3004, a conexão é recusada (`ECONNREFUSED`), gerando erro 500 para o usuário.

4. **Da observação do sync acadêmico à perda de dados históricos**:
   - `AcademicSyncService` faz `await tx.delete(academicMatricula)` incondicionalmente no banco.
   - Em seguida, insere apenas as matrículas resultantes da consulta aos períodos ativos atuais do Lyceum (`WHERE T.PERIODO IN (...)`).
   - Logo, quaisquer matrículas de períodos anteriores que estivessem cacheadas são permanentemente excluídas a cada sincronização diária.

---

## 3. Caveats

- Não foi executada a sincronização ao vivo contra instâncias de produção do Moodle ou Lyceum MSSQL durante esta auditoria, uma vez que a investigação é restrita a modo de leitura e análise estática/funcional.
- A auditoria não realizou mutações em código-fonte de aplicação, em total conformidade com a persona de Explorer.

---

## 4. Conclusion

O Nexus Core apresenta uma arquitetura robusta, moderna e tecnicamente sólida, com testes automatizados 100% green e build bem-sucedido em ambos os workspaces. As seis etapas de modernização arquitetural estão operacionais. No entanto, foram catalogadas inconsistências pontuais que demandam correção:

1. **P0 (Bugs funcionais imediatos)**:
   - Fallback de porta incorreto (`http://backend:3001`) nas rotas de proxy `app/api/scheduling/export/route.ts` e `bookings/route.ts`.
   - Período padrão dessincronizado (`2026-1` vs `2026-2`) em `SchedulingDashboard.tsx`.
   - Atribuição ausente de `isDisabled` no `auth.ts` do NextAuth.
2. **P1 (Arquitetura e Roteamento)**:
   - Assimetria nas rotas de relatórios (`/relatorios/progresso/ead` e `/relatorios/notas/ead` inexistentes).
   - Deleção global de matrículas (`tx.delete(academicMatricula)`) no sync diário do Lyceum.
   - Fallback de datas de fases de 2026-1 desatualizado para o semestre 2026-2.
   - Omissão de links de Progresso e Notas na Sidebar.
3. **P2 (Robustez)**:
   - Implementação de fluxo de Refresh Token para prevenir timeout de 2h de API.
   - Criação do decorator `@CurrentUser()`.

O relatório detalhado está disponível em:
`c:\Users\ricardo.dias\develop\projetos\nexus-core\.agents\teamwork_preview_explorer_survey_2\functional_audit.md`.

---

## 5. Verification Method

Para verificar de forma independente as observações e conclusões deste relatório:

1. **Testes Unitários**:
   ```bash
   npm run test --workspace=@nexus-core/backend
   ```
   *Resultado esperado*: 23 suites passadas, 65 testes passados com 100% de sucesso.

2. **Testes E2E**:
   ```bash
   npm run test:e2e --workspace=@nexus-core/backend
   ```
   *Resultado esperado*: 4 suites passadas, 12 testes passados com 100% de sucesso.

3. **Build Completo**:
   ```bash
   npm run build
   ```
   *Resultado esperado*: Sucesso no NestJS e no Next.js 16 (30 rotas geradas).

4. **Inspeção de Código dos Gaps Citados**:
   - Inspecionar `apps/frontend/src/app/api/scheduling/export/route.ts:12` (verificar fallback `http://backend:3001`).
   - Inspecionar `apps/frontend/src/app/admin/scheduling/SchedulingDashboard.tsx:67, 88` (verificar default `2026-1`).
   - Inspecionar `apps/backend/src/academic/academic-sync.service.ts:135` (verificar `tx.delete(academicMatricula)`).
   - Inspecionar `apps/frontend/src/app/relatorios/progresso` e `apps/frontend/src/app/relatorios/notas` (verificar ausência de subpastas `ead/page.tsx`).
