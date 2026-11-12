# Relatório de Investigação Arquitetural do Backend (Módulo de Tutoria)

**Data**: 2026-11-10T20:25:00Z  
**Autor**: Teamwork Explorer (Backend Architecture Explorer)  
**Escopo**: Modelagem de Dados, Trilha de Auditoria, Linha do Tempo, Modelo Híbrido Multi-Tutor e Endpoints no NestJS (`apps/backend`).

---

## 1. Observation

### 1.1. Schema Drizzle Atual (`apps/backend/src/db/schema.ts`)
O schema do Drizzle ORM gerencia atualmente quatro tabelas para o módulo de tutoria entre as linhas 615 e 805:
1. `tutoriaLogsAtividades` (`tutoria_logs_atividades`, linhas 620-672): Registra cada evento/clique detalhado por aluno e disciplina oriundo do Moodle/OpenLMS.
2. `tutoriaEngajamentoAluno` (`tutoria_engajamento_aluno`, linhas 674-729): Registra métricas consolidadas por aluno e disciplina (`tempoTotalMinutos`, `grupoRiscoCalculado`: `critico`, `atencao`, `procrastinacao`, `autonomo`, `scoreEngajamento`).
3. `tutoriaPlanosAcao` (`tutoria_planos_acao`, linhas 731-761): Planos de ação com IA contendo diagnóstico e orientações pedagógicas.
4. `tutoriaAtendimentosKanban` (`tutoria_atendimentos_kanban`, linhas 763-805):
   ```typescript
   export const tutoriaAtendimentosKanban = pgTable(
     'tutoria_atendimentos_kanban',
     {
       id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
       planoAcaoId: text('plano_acao_id').references(() => tutoriaPlanosAcao.id, { onDelete: 'cascade' }),
       sourceInstitution: text('sourceInstitution').default('ead').notNull(),
       periodo: text('periodo').notNull(),
       matricula: text('matricula').notNull(),
       alunoNome: text('aluno_nome'),
       alunoEmail: text('aluno_email'),
       disciplinaCodigo: text('disciplina_codigo'),
       disciplinaNome: text('disciplina_nome'),
       // Status das colunas do Kanban: 'pendente', 'em_contato', 'aguardando_retorno', 'em_recuperacao', 'revertido', 'evadido'
       statusKanban: text('status_kanban').default('pendente').notNull(),
       tutorResponsavelId: text('tutor_responsavel_id').references(() => users.id, { onDelete: 'set null' }),
       observacoes: text('observacoes'),
       canalContatoUtilizado: text('canal_contato_utilizado'), // 'whatsapp', 'email', 'telefone', 'ava'
       ultimoContatoEm: timestamp('ultimo_contato_em', { mode: 'date' }),
       dataResolucao: timestamp('data_resolucao', { mode: 'date' }),
       createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
       updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
     },
     (t) => [
       index('idx_tutoria_kanban_status').on(t.statusKanban),
       index('idx_tutoria_kanban_mat').on(t.matricula),
       index('idx_tutoria_kanban_plano').on(t.planoAcaoId),
       index('idx_tutoria_kanban_tutor').on(t.tutorResponsavelId),
       index('idx_tutoria_kanban_periodo').on(t.periodo),
     ],
   );
   ```
- **Inexistência de Tabela de Histórico**: Não há nenhuma tabela de trilha de auditoria (`tutoria_atendimento_historico` ou equivalente) para armazenar eventos históricos, passagens de bastão ou notas de transição.
- **Campos faltantes em `tutoria_atendimentos_kanban`**: Não existem colunas para identificar o tutor que abriu o atendimento (`tutor_iniciador_id`), a data da última intervenção (`ultima_intervencao_em`), nem a contagem de intervenções (`qtd_intervencoes`).

### 1.2. Mecanismo de Migração e Resiliência
- Arquivo `apps/backend/src/tutoria/tutoria.service.ts` (linhas 31-78):
  `TutoriaService.onModuleInit()` executa o método `ensureKanbanTable()`, que aplica comandos idempotentes (`CREATE TABLE IF NOT EXISTS` e `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- Arquivo `apps/backend/src/db/migrate-tutoria.ts` e `apps/backend/package.json` (linha 16):
  O projeto utiliza `drizzle-kit push` (`npm run db:push`) e scripts manuais em TypeScript (`npm run db:migrate-tutoria`).
- O sistema de permissões associa o módulo `slug: 'tutoria'` aos grupos e usuários via `group_system_access` e `users_system_access`.

### 1.3. Autenticação e Extração de Usuário no NestJS
- Arquivo `apps/backend/src/app.module.ts` (linhas 60-62):
  `JwtAuthGuard` é registrado globalmente como `APP_GUARD`.
- Arquivo `apps/backend/src/auth/jwt-auth.guard.ts` (linhas 96-101):
  ```typescript
  request['user'] = {
    id: payload.sub,
    email: payload.email,
    isSuperAdmin: payload.isSuperAdmin,
    isDisabled: !isActive,
  };
  ```
  O guard valida o JWT e anexa o usuário em `req.user`. Atualmente, `req.user` possui `id`, `email`, `isSuperAdmin`, `isDisabled`, mas não inclui `name`.
- Arquivo `apps/backend/src/users/users.controller.ts` (linha 17):
  Possui `@RequireAdmin()`, impedindo que tutores comuns acessem `GET /api/users` para listar colegas tutores.

### 1.4. Gargalo Crítico na Gestão de Posse no Kanban (`tutoria.service.ts`)
- Arquivo `apps/backend/src/tutoria/tutoria.service.ts` (linhas 722-778):
  No método `updateKanbanCard`:
  ```typescript
  if (tutorId) {
    try {
      const u = await this.db.execute(sql`SELECT id FROM "user" WHERE id = ${tutorId} LIMIT 1;`);
      if (u.length > 0) {
        updates.push(sql`tutor_responsavel_id = ${tutorId}`);
      }
    } catch {
      // Ignora se id de tutor inválido
    }
  }
  ```
  **Comportamento Incorreto**: Toda vez que qualquer tutor autenticado move um cartão entre colunas ou insere uma observação, o campo `tutor_responsavel_id` é sobrescrito com o `tutorId` de quem fez a chamada. Isso viola o modelo híbrido onde o discente possui um tutor responsável principal atribuído e outros tutores atuam como colaboradores / interventores.

### 1.5. Endpoints Atuais do `TutoriaController` (`tutoria.controller.ts`)
- `GET /api/tutoria/summary`: Resumo dos cards superiores.
- `GET /api/tutoria/engajamento`: Listagem paginada de engajamento discente.
- `GET /api/tutoria/disciplinas`: Lista de disciplinas ativas.
- `GET /api/tutoria/exportar`: Exportação de dados para planilha.
- `GET /api/tutoria/aluno/:matricula/logs`: Raio-X de logs, dados discentes e último registro kanban (não inclui timeline).
- `GET /api/tutoria/aluno/:matricula/lookup`: Busca inteligente de discente por matrícula.
- `GET /api/tutoria/sync/status` & `POST /api/tutoria/sync`: Sincronização com AVA.
- `GET /api/tutoria/kanban`: Listagem de cartões do quadro.
- `POST /api/tutoria/kanban`: Criação de cartão.
- `PATCH /api/tutoria/kanban/:id`: Atualização de cartão.
- `DELETE /api/tutoria/kanban/:id`: Remoção de cartão.
- **Faltam**: Endpoints para registro de intervenção com auditoria, transferência explícita de bastão com justificativa, consulta de timeline cronológica consolidada por discente e listagem de tutores autorizados.

---

## 2. Logic Chain

1. **Premissa de Posse Híbrida (R1)**:
   - Um discente em acompanhamento deve ter um `tutor_responsavel_id` fixado (o dono da carteira/atendimento).
   - Quando outro tutor realiza um contato, move o cartão ou adiciona um parecer, ele NÃO deve roubar a titularidade do cartão; a ação dele deve ser registrada como um evento de colaboração/intervenção na trilha de auditoria.
   - A titularidade principal só deve mudar mediante fluxo explícito de "Passagem de Bastão", que exige a seleção do novo tutor e uma nota de transição pedagógica.
2. **Premissa de Auditoria e Linha do Tempo (R2)**:
   - Para atender ao ciclo de vida completo auditável, precisamos persistir cada uma das seguintes ações com data/hora, autor (id e nome), estado anterior, novo estado, canal de contato e notas:
     - `abertura`: criação do atendimento no Kanban;
     - `mudanca_status`: movimentação entre etapas (`pendente`, `em_contato`, `em_recuperacao`, `revertido`, `evadido`);
     - `contato`: envio/tentativa de mensagem (WhatsApp, e-mail, telefone, AVA);
     - `passagem_bastao`: transferência da posse principal;
     - `intervencao_pedagogica`: notas ou pareceres sem troca de coluna;
     - `finalizacao`: resolução/reversão ou evasão;
     - `reabertura`: reativação de atendimento previamente finalizado.
3. **Mecanismo de Resolução de Nomes de Tutores**:
   - Para que a timeline exiba de forma rápida o nome do autor (mesmo se o usuário for editado ou desativado futuramente), a tabela de histórico deve armazenar um snapshot denormalizado (`tutor_nome`), além da foreign key `tutor_id`.
   - Como `req.user` vem do JWT assinado e pode não ter o campo `name` em tokens existentes, o backend deve enriquecer o `JwtAuthGuard` (adicionando o nome no cache em memória) e disponibilizar um método `resolveTutorInfo` no `TutoriaService` que consulta `user.name` caso o nome não venha na requisição.
4. **Resguardo de Acesso aos Tutores**:
   - Como `GET /api/users` é restrito a super admins via `@RequireAdmin()`, os tutores regulares não conseguem buscar os colegas para a passagem de bastão. A solução arquitetural ideal é criar um endpoint leve `GET /api/tutoria/tutores` dentro do `TutoriaController` (protegido por `@RequireModule('tutoria')`), retornando a lista de usuários ativos aptos a receber atendimentos.

---

## 3. Caveats

1. **Atendimentos Existentes sem Histórico**: Os cartões já presentes na tabela `tutoria_atendimentos_kanban` não possuem eventos históricos retroativos. A query de timeline deve lidar graciosamente com atendimentos antigos que tenham 0 eventos no histórico, exibindo a criação a partir do próprio `createdAt` do cartão caso o histórico esteja vazio.
2. **Tokens JWT em Circulação**: Usuários já logados possuem tokens que contêm apenas `sub` e `email`. Portanto, o backend não pode depender exclusivamente de `payload.name` no JWT; o `TutoriaService` deve ter fallback para consultar `user.name` no Postgres caso não venha no objeto `req.user`.
3. **Vínculo por Matrícula vs ID de Atendimento**: Um discente pode ter atendimentos em períodos diferentes ou disciplinas distintas. A consulta de timeline deve permitir filtrar tanto por `matricula` isolada (histórico acadêmico longitudinal completo do aluno) quanto por `atendimentoId` (histórico daquele cartão específico).

---

## 4. Conclusion

A arquitetura do backend requer as seguintes adições e ajustes pontuais:

### 4.1. Definição do Schema Drizzle (`apps/backend/src/db/schema.ts`)

```typescript
// Nova tabela de histórico e auditoria da tutoria
export const tutoriaAtendimentoHistorico = pgTable(
  'tutoria_atendimento_historico',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    atendimentoId: text('atendimento_id').references(
      () => tutoriaAtendimentosKanban.id,
      { onDelete: 'cascade' },
    ),
    matricula: text('matricula').notNull(),
    periodo: text('periodo').notNull(),
    sourceInstitution: text('sourceInstitution').default('ead').notNull(),
    disciplinaCodigo: text('disciplina_codigo'),
    tipoEvento: text('tipo_evento').notNull(), // 'abertura' | 'mudanca_status' | 'contato' | 'passagem_bastao' | 'intervencao_pedagogica' | 'finalizacao' | 'reabertura'
    tutorId: text('tutor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    tutorNome: text('tutor_nome'),
    tutorEmail: text('tutor_email'),
    canalContato: text('canal_contato'), // 'whatsapp' | 'email' | 'telefone' | 'ava' | 'outro'
    estadoAnterior: text('estado_anterior'),
    estadoNovo: text('estado_novo'),
    observacoes: text('observacoes'),
    metadata: text('metadata'), // JSON serializado com metadados adicionais
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_tutoria_hist_atendimento').on(t.atendimentoId),
    index('idx_tutoria_hist_mat').on(t.matricula),
    index('idx_tutoria_hist_mat_created').on(t.matricula, t.createdAt),
    index('idx_tutoria_hist_tipo').on(t.tipoEvento),
    index('idx_tutoria_hist_tutor').on(t.tutorId),
    index('idx_tutoria_hist_created').on(t.createdAt),
  ],
);
```

E extensão em `tutoriaAtendimentosKanban`:
- `tutorIniciadorId: text('tutor_iniciador_id').references(() => users.id, { onDelete: 'set null' })`
- `ultimaIntervencaoEm: timestamp('ultima_intervencao_em', { mode: 'date' })`
- `qtdIntervencoes: integer('qtd_intervencoes').default(0)`

### 4.2. DTOs Necessários (`apps/backend/src/tutoria/dto/`)

1. `create-intervencao.dto.ts`:
   ```typescript
   export class CreateIntervencaoDto {
     @IsOptional() @IsString() atendimentoId?: string;
     @IsNotEmpty() @IsString() matricula: string;
     @IsOptional() @IsString() periodo?: string;
     @IsOptional() @IsString() institution?: string;
     @IsOptional() @IsString() disciplinaCodigo?: string;
     @IsNotEmpty() @IsString() tipoEvento: string;
     @IsOptional() @IsString() canalContato?: string;
     @IsNotEmpty() @IsString() observacoes: string;
     @IsOptional() @IsString() statusKanban?: string;
     @IsOptional() metadata?: any;
   }
   ```
2. `transferir-atendimento.dto.ts`:
   ```typescript
   export class TransferirAtendimentoDto {
     @IsNotEmpty() @IsString() novoTutorId: string;
     @IsNotEmpty() @IsString() notaTransicao: string;
   }
   ```

### 4.3. Novos Endpoints no `TutoriaController`

1. `POST /api/tutoria/intervencoes`:
   Registra uma intervenção na trilha de auditoria e atualiza o cartão correspondente (contagem e data de última intervenção).
2. `POST /api/tutoria/kanban/:id/transferir`:
   Executa a passagem de bastão: transfere a titularidade (`tutor_responsavel_id`), atualiza metadados e gera evento `'passagem_bastao'` com a nota de transição.
3. `GET /api/tutoria/aluno/:matricula/timeline`:
   Retorna o histórico cronológico de intervenções de forma consolidada para aquele aluno.
4. `GET /api/tutoria/tutores`:
   Retorna a lista de tutores ativos para seleção no frontend.
5. `PATCH /api/tutoria/kanban/:id`:
   Ajustado para NÃO sobrescrever `tutor_responsavel_id` ao mover status ou atualizar notas, gravando em vez disso o evento de auditoria com o autor da ação.

---

## 5. Verification Method

Para verificar a implementação com integridade:

1. **Build do Backend**:
   ```bash
   npm run build --workspace=@nexus-core/backend
   ```
   Deve compilar com sucesso gerando a pasta `dist` sem erros de TypeScript.

2. **Testes Unitários do Módulo de Tutoria**:
   ```bash
   npm test -- tutoria
   ```
   Executa os testes existentes e novos testes unitários adicionados para `createIntervencao`, `transferirBastao` e `getTimeline`.

3. **Validação do Schema e Banco**:
   - Executar `npm run db:push` ou o script de migração atualizado `npm run db:migrate-tutoria`.
   - Verificar no PostgreSQL a existência da tabela `tutoria_atendimento_historico` e os novos campos em `tutoria_atendimentos_kanban`.
