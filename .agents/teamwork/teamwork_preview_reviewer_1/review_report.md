# Relatório de Revisão Técnica e Crítica Adversarial (Peer Review & Adversarial Audit)

**Documento Auditado:** `AUDIT_REPORT_AND_ROADMAP.md` (Consolidated Technical Audit Report, Monorepo Baseline, and Prioritized Roadmap)  
**Data da Revisão:** 23 de Outubro de 2026  
**Revisor / Crítico:** `teamwork_preview_reviewer_1` (Roles: Reviewer & Adversarial Critic)  
**Veredito:** `REQUEST_CHANGES` (Revisão Reprovada com Solicitação de Alterações Obrigatórias)

---

## 1. Sumário da Revisão e Veredito

Após uma auditoria rigorosa, cruzamento exaustivo com a base de código real do monorepo (`apps/backend` e `apps/frontend`) e confronto com os 5 relatórios de evidências dos especialistas (`baseline_report.md`, `security_audit.md`, `concurrency_audit.md`, `integrations_audit.md` e `frontend_ux_audit.md`), o documento consolidado **`AUDIT_REPORT_AND_ROADMAP.md`** demonstrou excelente amplitude conceitual e síntese estratégica de alto nível, cobrindo com sucesso todos os tópicos dos requisitos R1 a R5.

No entanto, **foram detectadas inconformidades críticas de integridade técnica e factual que impedem a aprovação imediata do documento**:
1. **Quebra dos Critérios de Aceite no Mapeamento de Rotas (R1)**: A tabela de controllers da Seção 2.1 omitiu 3 controllers inteiros (`AuditController`, `SystemController`, `JobsController`) e mais de 20 rotas reais, além de alucinar rotas e métodos inexistentes no backend, contrariando o critério explícito de *"Mapeamento e conferência de 100% dos controllers e rotas expostas no backend NestJS"*.
2. **Código de Remediação Incompatível / Alucinado (R2)**: O trecho drop-in de remediação de concorrência na Seção 8.1 foi elaborado utilizando um schema de banco de dados fictício (`opcaos.vagasDisponiveis`, `opcaos.vagasOcupadas`, `opcaos.horaInicio`, `agendamentosMatricula.disciplinas` JSON), inexistente em `apps/backend/src/db/schema.ts`, tornando o código inexecutável em produção.
3. **Vulnerabilidade a Timing Attacks no HMAC (R1)**: O guard de sessão do estudante na Seção 8.2 utiliza comparação de strings convencional (`!==`), vulnerável a ataques de temporização, em vez de `crypto.timingSafeEqual`.

Portanto, em estrito cumprimento às diretrizes de integridade, o veredito formal é **REQUEST_CHANGES**.

---

## 2. Placar de Verificação dos Requisitos (ORIGINAL_REQUEST.md)

| Requisito | Escopo Auditado | Avaliação | Diagnóstico |
|---|---|:---:|---|
| **R1: Segurança e Acesso** | 100% controllers, sessão HMAC, RBAC admin scheduling, XSS, CSP, Helmet, CORS | **REPROVADO** | Conceitos corretos, mas tabela da Seção 2.1 incompleta e com rotas alucinadas; HMAC com timing vulnerability. |
| **R2: Concorrência e Vagas** | Locks de 30 min, deadlocks 40P01, reschedule atômico, formato HH:MM, índices | **REPROVADO** | Diagnóstico empírico perfeito, mas código da Seção 8.1 incompatível com schema Drizzle real. |
| **R3: Resiliência Integrações** | AvaSync BullMQ retry bypass, MSSQL pool lifecycle, snapshot regex, event loop | **APROVADO** | Rastreamento fiel das falhas e recomendações idênticas ao `integrations_audit.md`. |
| **R4: Frontend Next.js 16 & UX** | Server Actions digest masking, `ActionResult<T>`, App Router layouts, mobile stepper, voucher | **APROVADO** | Alinhamento exemplar com `frontend_ux_audit.md`; caminho do voucher precisa de pequeno ajuste. |
| **R5: Relatório & Roadmap** | Categorização de severidade, matriz Impacto x Esforço, roadmap em fases | **APROVADO** | Matriz clara, fases bem delimitadas (P0 a P3) e priorização aderente ao impacto operacional. |
| **Critérios de Aceite** | Build monorepo, 100% controllers mapped, concorrência verificada, snippets | **REPROVADO** | Mapeamento 100% falhou na consolidação e snippet 8.1 é incompatível com o banco de dados. |

---

## 3. Apontamentos Críticos e Maiores (Findings)

### Finding 1: [Crítico / Violação de Especificação] Mapeamento Incompleto e Alucinado de Controllers e Rotas (R1)
- **Onde:** `AUDIT_REPORT_AND_ROADMAP.md`, Seção 2.1 (linhas 33-77).
- **O que foi observado:** A tabela lista apenas 13 controllers e 38 rotas HTTP. Porém, na base de código real (`apps/backend/src`), existem **13 controllers e 58 rotas HTTP**, conforme documentado com precisão no relatório do especialista `security_audit.md` (linhas 41-100).
- **Inconsistências Factualmente Comprovadas:**
  1. **3 Controllers Omitidos**:
     - `AuditController` (`@Controller('api/audit-logs')`): 3 rotas (`GET /`, `GET /stats`, `POST /export`).
     - `SystemController` (`@Controller('api/system')`): 3 rotas (`GET /modules`, `GET /sidebar-modules`, `GET /admin-dashboard`).
     - `JobsController` (`@Controller('api/jobs')`): 1 rota (`GET /:queue/:id/status`).
  2. **Rotas Inexistentes / Alucinadas**:
     - `AuthController`: Listou `/auth/refresh` e `/auth/logout`. O controller real possui unicamente `POST /api/auth/login`.
     - `AcademicController`: Listou `/academic/consolidated` e `/academic/student/:matricula`. As rotas reais são 7: `/sync`, `/discentes`, `/discentes/:matricula/disciplinas`, `/docentes`, `/docentes/:docenteId/disciplinas`, `/turmas`, `/matriculas`.
     - `AvaSyncController`: Listou 3 rotas (`/ava-sync/trigger`, `/ava-sync/status/:jobId`, `/ava-sync/history`). O controller real possui apenas 1 rota: `GET /api/ava-sync`.
     - `AvaReportsController`: Listou 2 rotas (`/ava-reports/consolidated`, `/ava-reports/summary`). O controller real possui 8 rotas (`progress`, `progress/export`, `sync`, `grades`, `grades/export`, `consolidated`, `consolidated/export`, `dashboard-stats`).
     - `SchedulingController`: Listou rotas inexistentes como `/scheduling/slots` (o correto é `/api/scheduling/options`), `DELETE /scheduling/locals/:id`, `DELETE /scheduling/slots/:id`, `GET /scheduling/reports`, e omitiu 10 rotas reais fundamentais (`bookings`, `conclude`, `absent`, `import`, `export`, etc.).
     - `PublicSchedulingController`: Listou `/scheduling/public/locals`, `/dates`, `/slots`, `/student-status`. As rotas reais são `/api/public/scheduling/student-flow`, `/available-slots`, `/book`, `/cancel`, `/reschedule`.
- **Por que é um problema:** O Critério de Aceite de `ORIGINAL_REQUEST.md` exige: *"Mapeamento e conferência de 100% dos controllers e rotas expostas no backend NestJS quanto à proteção de autorização e guards."* A consolidação falhou neste critério ao não incorporar a tabela autêntica de 58 rotas já gerada pelo especialista de segurança.
- **Ação Requerida:** Substituir integralmente a tabela da Seção 2.1 pela tabela exaustiva de 58 rotas do `security_audit.md`.

---

### Finding 2: [Crítico / Violação de Implementação] Snippet de Concorrência Incompatível com o Schema Real (R2)
- **Onde:** `AUDIT_REPORT_AND_ROADMAP.md`, Seção 8.1 (linhas 356-468).
- **O que foi observado:** O trecho apresentado como "Trecho de Código de Remediação Pronto para Produção" utiliza nomes de campos e estruturas que **não existem** no Drizzle ORM (`apps/backend/src/db/schema.ts`):
  ```typescript
  // Trecho inválido presente no relatório:
  sql`${opcaos.vagasDisponiveis} - ${opcaos.vagasOcupadas} >= 1`
  vagasOcupadas: sql`${opcaos.vagasOcupadas} + 1`
  horaInicio: selectedSlots[0].horaInicio.slice(0, 5)
  disciplinas: JSON.stringify(disciplinas)
  ```
- **Confronto com o Schema Real (`schema.ts:370-420`):**
  - Tabela `opcaos`: possui `id`, `localId`, `data`, `hora` (texto), `vagas` (inteiro), `status` (booleano). **Não existem** `vagasDisponiveis`, `vagasOcupadas` nem `horaInicio`.
  - Tabela `agendamentosMatricula`: possui `id`, `opcaoId`, `matricula`, `descricao` (texto com disciplinas concatenadas por ponto e vírgula), `periodo`, `data`, `status` (default `'ativo'`). **Não existem** `localId`, `horaInicio`, `duracaoMinutos`, nem coluna `disciplinas`.
  - No método `rescheduleStudentBookingAtomic`, o código tenta atualizar `opcaos.vagasOcupadas` e une com `LEFT(${opcaos.horaInicio}, 5)`, o que causa erro fatal imediato no PostgreSQL (`column opcaos.vagasOcupadas does not exist`).
- **Por que é um problema:** O relatório promete trechos "prontos para produção" (*drop-in code snippets*). Se um engenheiro aplicar esse código, o backend quebrará em tempo de compilação TypeScript e em tempo de execução SQL. O especialista em concorrência (`concurrency_audit.md`, Seção 6) já forneceu e testou os snippets 100% corretos e aderentes ao schema real.
- **Ação Requerida:** Substituir o bloco da Seção 8.1 pelos métodos drop-in reais validados em `concurrency_audit.md` Seção 6.1, 6.2 e 6.3.

---

### Finding 3: [Maior / Falha de Segurança] Vulnerabilidade a Timing Attack no `StudentSessionGuard` (R1)
- **Onde:** `AUDIT_REPORT_AND_ROADMAP.md`, Seção 8.2 (linhas 494-496).
- **O que foi observado:**
  ```typescript
  if (signature !== expectedSignature) {
    throw new UnauthorizedException('Assinatura da sessão de estudante inválida.');
  }
  ```
- **Por que é um problema:** A comparação por igualdade estrita (`!==`) de strings em JavaScript/Node.js compara caractere por caractere e encerra no primeiro byte divergente. Isso permite que um invasor meça variações sub-microssegundo no tempo de resposta para forjar gradualmente assinaturas HMAC válidas para qualquer matrícula de estudante (Side-Channel Timing Attack).
- **Ação Requerida:** Utilizar `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))` garantindo previamente a checagem de igualdade de tamanho dos buffers, conforme demonstrado em `security_audit.md:380-384`.

---

### Finding 4: [Menor / Inconsistência de Caminho] Localização Incorreta do `StudentVoucherDialog.tsx` (R4)
- **Onde:** `AUDIT_REPORT_AND_ROADMAP.md`, Seção 2.4 (linha 102) e Seção 6.1 (linha 272).
- **O que foi observado:** O relatório indica `apps/frontend/src/components/StudentVoucherDialog.tsx`. O arquivo real reside em `apps/frontend/src/app/agendamento/StudentVoucherDialog.tsx`.
- **Ação Requerida:** Atualizar os caminhos no texto para evitar confusão durante as correções da Fase 2/Fase 3.

---

## 4. Análise Crítica Adversarial (Adversarial Stress-Testing)

Como Crítico Adversarial, desafiamos as premissas e soluções recomendadas no relatório sob condições operacionais extremas:

### Desafio 1: Deadlocks sob Cenários com Múltiplos Polos e Transações Reversas
- **Premissa do Relatório:** Ordenar `SELECT ... FOR UPDATE` por `asc(opcaos.hora)` elimina deadlocks.
- **Cenário de Ataque / Estresse:** Se uma rotina administrativa (ou script de reagendamento em lote) executar operações envolvendo múltiplos polos ou múltiplas datas em uma mesma transação, a ordenação apenas por `hora` não é globalmente monotônica.
- **Mitigação Recomendada:** A ordenação hierárquica deve ser composta e estrita: `.orderBy(asc(opcaos.data), asc(opcaos.hora), asc(opcaos.id))`.

### Desafio 2: Replay de Sessão do Aluno dentro da Janela de 30 Minutos
- **Premissa do Relatório:** O cookie assinado com HMAC e expiração de 30 minutos isola completamente a sessão do discente.
- **Cenário de Ataque:** Um token HMAC stateless válido por 30 minutos pode ser reutilizado se for interceptado em computadores públicos de laboratórios de polo. O discente confirma seu agendamento, sai da máquina, mas o cookie permanece válido nos próximos 20 minutos. Um segundo usuário pode acessar o histórico e cancelar o agendamento recém-feito.
- **Mitigação Recomendada:** Vincular a assinatura do token a um `nonce` ou timestamp de versão armazenado no Redis com invalidação imediata após a conclusão de uma reserva (`book`) ou cancelamento (`cancel`).

### Desafio 3: Thundering Herd no BullMQ sob Queda Prolongada do Moodle
- **Premissa do Relatório:** Eliminar o mascaramento de `status: 'queued'` e permitir que o BullMQ retente a cada 5 segundos com backoff exponencial.
- **Cenário de Falha:** Se o servidor Moodle passar por manutenção de 2 horas, o disparo de retentativas para 11 instituições simultâneas gerará um efeito de manada (*thundering herd*), congestionando os workers e saturando as conexões HTTP assim que o Moodle retornar.
- **Mitigação Recomendada:** Configurar `delay` inicial de 10s com fator multiplicador 3x, teto máximo de backoff de 300s (5 minutos), além de `jitter: true` no BullMQ para desincronizar os nós de retry.

---

## 5. Recomendações Concretas de Correção para Aprovação do Relatório

Para que o relatório `AUDIT_REPORT_AND_ROADMAP.md` seja integralmente aprovado (`APPROVE`), as seguintes 3 correções devem ser aplicadas ao arquivo:

1. **Atualizar a Seção 2.1**:
   Substituir a tabela de 38 rotas pela tabela exaustiva de **13 controllers e 58 rotas** documentada em `teamwork_preview_explorer_security_1/security_audit.md` (Seção 2), incluindo `AuditController`, `SystemController`, `JobsController` e todas as rotas autênticas de `AcademicController`, `AvaSyncController`, `AvaReportsController`, `SchedulingController` e `PublicSchedulingController`.
2. **Atualizar a Seção 8.1**:
   Substituir os métodos `createBookingAtomic` e `rescheduleStudentBookingAtomic` pelo código testado e aderente ao schema real presente em `teamwork_preview_challenger_concurrency_1/concurrency_audit.md` (Seções 6.1, 6.2 e 6.3), utilizando `opcaos.vagas`, `opcaos.hora`, `agendamentosMatricula.descricao` e transação unificada.
3. **Atualizar a Seção 8.2**:
   Substituir `signature !== expectedSignature` pelo uso de `crypto.timingSafeEqual` com buffers no `StudentSessionGuard`.

---

## 6. Conclusão do Revisor

O relatório consolidado possui valor técnico extraordinário, síntese estratégica precisa e um roadmap perfeitamente estruturado para a evolução do Nexus Core. Com a correção factual dos três pontos acima, o documento atingirá o estado de excelência técnica e integridade inquestionável exigido para a homologação executiva.

**Veredito Final:** `REQUEST_CHANGES`
