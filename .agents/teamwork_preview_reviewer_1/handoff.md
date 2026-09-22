# Handoff Report — Teamwork Preview Reviewer 1

- **Agent:** `teamwork_preview_reviewer_1`
- **Role:** Reviewer & Adversarial Critic
- **Milestone:** Survey Review & Synthesis
- **Date:** 2026-09-18T17:37:00Z
- **Verdict:** **APPROVE (Survey Reports) / REQUEST_CHANGES (Codebase Gate for Production)**

---

## 1. Observation

Direct observations verified through local filesystem inspection and tool execution:

1. **Vazamento de Credenciais de Banco MSSQL:**
   - Arquivo: `apps/backend/inspect_mat.js` (linhas 7-11):
     ```javascript
     const config = {
       user: process.env.LYCEUM_DB_USERNAME || 'PortAeeConsult',
       password: process.env.LYCEUM_DB_PASSWORD || 'Port4eeC0nsult@Tudo.',
       server: process.env.LYCEUM_DB_HOST || '172.29.44.90',
       port: parseInt(process.env.LYCEUM_DB_PORT || '1433'),
       database: process.env.LYCEUM_DB_DATABASE || 'Lyceum',
       ...
     };
     ```
   - O arquivo contém usuário, senha de produção e endereço IP real de host de banco de dados SQL Server institucional codificados como strings estáticas de fallback.

2. **Chave JWT Hardcoded como Fallback:**
   - Arquivo `apps/backend/src/auth/auth.module.ts` (linha 10) e `apps/backend/src/auth/jwt-auth.guard.ts` (linha 44):
     ```typescript
     secret: process.env.JWT_SECRET || 'nexus-secret-key-2026'
     ```

3. **Inconsistência de Portas e Host de Rede no Frontend:**
   - Arquivo `apps/frontend/src/app/api/scheduling/export/route.ts` (linha 12) e `bookings/route.ts` (linha 12):
     ```typescript
     const baseUrl = process.env.NEXT_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://backend:3001"
     ```
   - Em ambiente bare-metal/local, se `NEXT_API_URL` não for fornecido, a rota aponta para o host `backend` (que só existe na rede do Docker) e porta `3001` (quando o backend roda em `3004`).

4. **Deleção Irrestrita no Sync Acadêmico:**
   - Arquivo `apps/backend/src/academic/academic-sync.service.ts` (linha 135):
     ```typescript
     await this.db.transaction(async (tx) => {
       await tx.delete(academicMatricula);
       ...
     });
     ```
   - O método `tx.delete(academicMatricula)` é executado sem cláusula `where`, apagando todas as matrículas de qualquer período histórico armazenadas na tabela.

5. **Assimetria de Rotas no Módulo de Relatórios AVA:**
   - Estrutura de diretórios: `apps/frontend/src/app/relatorios/consolidado/ead/page.tsx` existe, enquanto `/relatorios/progresso/ead` e `/relatorios/notas/ead` não existem (retornam HTTP 404). As páginas de EaD para Progresso e Notas estão localizadas em `progresso/page.tsx` e `notas/page.tsx`.
   - Arquivo `apps/frontend/src/components/SidebarClient.tsx` (linhas 219-257): renderiza exclusivamente links para `/relatorios/consolidado/*`, ocultando completamente Progresso e Notas do menu lateral.

6. **Desalinhamento de Período e Fases Acadêmicas:**
   - Arquivo `apps/frontend/src/lib/academic-config.ts` (linhas 1, 12-21):
     ```typescript
     export const DEFAULT_PERIOD = process.env.NEXT_PUBLIC_NEXUS_DEFAULT_PERIOD || "2026-2";
     // Fases com fallback do 1º semestre:
     fase1: { inicio: "2026-02-13", fim: "2026-03-29" },
     fase2: { inicio: "2026-03-30", fim: "2026-05-11" },
     fase3: { inicio: "2026-05-12", fim: "2026-06-19" },
     ```
   - Arquivo `apps/frontend/src/app/admin/scheduling/SchedulingDashboard.tsx` (linhas 67, 88):
     ```typescript
     const [periodo, setPeriodo] = useState(searchParams.get("periodo") || "2026-1")
     const [modalPeriodo, setModalPeriodo] = useState("2026-1")
     ```

7. **Resultados de Execução de Comandos de Build, Testes e Lint:**
   - `npm run build`: Exit code 0. Ambas as workspaces compilam (`@nexus-core/backend` e `@nexus-core/frontend`).
   - `npm run test --workspace=@nexus-core/backend`: Exit code 0 (23 suites, 65 testes passados em 4.77s).
   - `npm run test:e2e --workspace=@nexus-core/backend`: Exit code 0 (4 suites, 12 testes passados em 4.50s).
   - `npm run lint`: Exit code 1. O frontend falhou com 276 problemas (175 erros, 101 warnings), sendo silenciado no CI por `continue-on-error: true`.
   - Testes do Frontend: 0 arquivos de teste, 0% de cobertura.

---

## 2. Logic Chain

1. **Da Observação 1 e 2 ao Critério de Aceite de Secrets:**
   - O Critério de Aceite em `ORIGINAL_REQUEST.md` estipula: `[ ] Ausência de secrets hardcoded no código-fonte`.
   - Como `inspect_mat.js` contém credenciais reais do banco Lyceum e `auth.module.ts` / `jwt-auth.guard.ts` contêm chaves estáticas de fallback para o JWT, o critério de ausência de secrets está formalmente **violado**.

2. **Da Observação 3 à Falha Funcional em Agendamento:**
   - Quando um operador utiliza o painel de agendamento em ambiente local ou fora do Docker sem `NEXT_API_URL` injetado, os botões de exportação e chamadas de bookings disparam fetch para `http://backend:3001`.
   - O DNS do sistema operacional não resolve o hostname `backend` e a porta `3001` não corresponde ao serviço ativo (`3004`), resultando em erro `500 ECONNREFUSED`.

3. **Da Observação 4 ao Risco de Perda de Dados:**
   - O job de sincronização acadêmica roda diariamente às 03:00 AM via cron.
   - Como ele executa `tx.delete(academicMatricula)` incondicionalmente, qualquer dado de matrícula de semestres anteriores preservado no PostgreSQL local é destruído a cada execução.

4. **Das Observações 5 e 6 à Inconsistência de UX e Roteamento:**
   - A discrepância estrutural nas URLs gera links quebrados (404) e impede que usuários naveguem para telas de notas e progresso através do menu lateral.
   - O uso de datas de fase de `2026-1` em pleno período `2026-2` acarreta falsos positivos em regras pedagógicas de cálculo de atraso.

5. **Da Observação 7 ao Veredito de Qualidade e CI:**
   - Os testes de backend passam integralmente (65 unitários e 12 E2E).
   - No entanto, a esteira de CI mascara 175 erros de linter com `continue-on-error: true`, e o frontend não possui salvaguardas automatizadas contra regressões.

---

## 3. Caveats

1. **Instâncias Externas Reais:** Os testes E2E executados utilizaram mocks de provedores (`overrideProvider(DB_CONNECTION)`, `overrideProvider(CacheService)`). Testes com instâncias reais de containers Postgres/Redis em pipeline de integração contínua ainda dependem de configuração de services no GitHub Actions.
2. **Rotação de Senha do Lyceum:** A validação se a senha `Port4eeC0nsult@Tudo.` permanece ativa no servidor `172.29.44.90` não pôde ser verificada externamente devido a restrições de rede, devendo ser tratada internamente pela equipe de infraestrutura com máxima urgência.

---

## 4. Conclusion

- **Aprovação do Trabalho dos Exploradores:** As investigações conduzidas por `teamwork_preview_explorer_survey_1`, `teamwork_preview_explorer_survey_2` e `teamwork_preview_explorer_survey_3` foram completas, minuciosas e fidedignas à realidade do repositório. Nenhuma evidência de simulação, facade enganosa ou autocertificação fraudulenta foi encontrada.
- **Veredito de Prontidão da Aplicação:** **REQUEST_CHANGES (Bloqueio de Promoção a Produção)**. O monorepo possui excelente qualidade arquitetural nas 6 etapas de modernização, mas requer intervenção corretiva obrigatória nos itens P0 (exclusão de credenciais em `inspect_mat.js`, remoção de fallback de JWT secret, correção de fallbacks de rede em rotas de agendamento e correção da query de deleção no sync acadêmico).
- **Blueprint para o Relatório Mestre:** O roteiro estrutural para autoria do `AUDIT_REPORT.md` final foi formalizado em `review_report.md`.

---

## 5. Verification Method

Para verificar independentemente todas as constatações deste relatório:

1. **Verificação de Secrets Hardcoded:**
   - Inspecionar `apps/backend/inspect_mat.js` linhas 7-11:
     `git grep -n "Port4eeC0nsult@Tudo."`
   - Inspecionar fallbacks de JWT:
     `git grep -n "nexus-secret-key-2026"`

2. **Verificação de Build e Testes:**
   - Monorepo Build: `npm run build` (esperado: sucesso em backend e frontend).
   - Testes Unitários do Backend: `npm run test --workspace=@nexus-core/backend` (esperado: 23 suites, 65 tests passed).
   - Testes E2E do Backend: `npm run test:e2e --workspace=@nexus-core/backend` (esperado: 4 suites, 12 tests passed).
   - Linter do Monorepo: `npm run lint` (esperado: falha no frontend com 175 erros de `no-explicit-any`).

3. **Verificação de Rotas e Código-Fonte:**
   - Inspecionar `apps/frontend/src/app/api/scheduling/export/route.ts` linha 12.
   - Inspecionar `apps/backend/src/academic/academic-sync.service.ts` linha 135.
   - Inspecionar `apps/frontend/src/app/relatorios/` para verificar ausência de `progresso/ead` e `notas/ead`.
