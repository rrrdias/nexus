# Original User Request

## 2026-10-23T11:52:27Z

Revisão abrangente, auditoria técnica e análise arquitetural profunda de toda a aplicação Nexus Core (NestJS backend e Next.js 16 frontend), avaliando a integridade dos módulos acadêmicos, relatórios consolidados, sincronizações AVA/Lyceum e o recém-implementado fluxo público de agendamento de provas presenciais, identificando falhas potenciais, gargalos de performance, riscos de segurança e um roadmap priorizado de melhorias.

Working directory: c:/Users/ricardo.dias/develop/projetos/nexus-core
Integrity mode: development

## Requirements

### R1. Auditoria de Segurança, Autenticação e Controle de Acesso
- Auditar todas as rotas da API backend e rotas do Next.js (App Router e middleware), garantindo que apenas os endpoints intencionalmente públicos (`@Public()` e rotas de agendamento do aluno) estejam abertos sem autenticação, e que o RBAC (`@RequireModule()`, roles de admin/coordenador/polo) esteja rigorosamente aplicado nas rotas administrativas.
- Validar a segurança e isolamento da sessão temporária do estudante via cookie (`nexus_student_session` de 30 min) e mitigações contra acessos indevidos com matrículas de terceiros.
- Verificar conformidade contra injeção de SQL, cross-site scripting (XSS), exposição indevida de variáveis de ambiente/credenciais e headers de segurança HTTP (Helmet, CSP, CORS).

### R2. Análise de Concorrência, Transações e Performance de Agendamento
- Avaliar a robustez do mecanismo de reserva de vagas consecutivas de 30 minutos em cenários de alta concorrência (concorrência simultânea de múltiplos alunos para os mesmos horários no mesmo polo).
- Auditar o uso de travas pessimistas (`FOR UPDATE`), transações no PostgreSQL via Drizzle ORM e devolução atômica de vagas no cancelamento/remarcação.
- Identificar gargalos de I/O em queries ao banco de dados e avaliar a necessidade de índices adicionais em `opcaos`, `agendamentos_matricula`, `locais` e tabelas de relatórios.

### R3. Resiliência e Integridade nas Integrações (Moodle AVA e Lyceum)
- Revisar os fluxos de sincronização assíncrona com BullMQ/Redis (`AvaSyncService` e `LyceumSyncService`), avaliando tolerância a falhas, timeouts, reconexões e comportamento sob indisponibilidade temporária dos bancos externos (MSSQL / MySQL).
- Avaliar a consistência do snapshot consolidado por polo/instituição e evitar processamento duplicado ou bloqueio do event loop.

### R4. Qualidade de Código, Padrões Frontend e Experiência do Usuário (UX)
- Avaliar a organização de componentes no Next.js 16 (Server Components vs Client Components, Server Actions e tratamento de erros sem masking de digest em produção).
- Revisar a experiência do aluno em dispositivos móveis no fluxo de agendamento (Loading Page, Landing Page, Stepper Wizard, Confirmação e Impressão do Comprovante).
- Identificar duplicações de código, estados desnecessários ou potenciais vazamentos de memória/listeners.

### R5. Relatório Consolidado de Auditoria e Roadmap Priorizado
- Gerar um relatório analítico estruturado categorizando os apontamentos em: **Crítico**, **Alto**, **Médio** e **Baixo/Melhoria**.
- Fornecer matriz de recomendações ordenadas por **Impacto vs Esforço** com sugestões práticas de implementação para os próximos passos da aplicação.

## Acceptance Criteria

### Integridade Técnica e Verificabilidade
- [ ] Execução e verificação dos comandos de integridade do monorepo (`npm run build` e `npm run test` em backend e frontend), registrando eventuais warnings ou falhas.
- [ ] Mapeamento e conferência de 100% dos controllers e rotas expostas no backend NestJS quanto à proteção de autorização e guards.
- [ ] Análise estática de vulnerabilidades e verificação de concorrência nas reservas de agendamento.
- [ ] Emissão de relatório técnico completo contendo diagnósticos pontuais, trechos de código referenciados e plano de ação executável.
