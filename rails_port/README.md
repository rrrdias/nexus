# Nexus Core Rails Port

Port Rails do projeto `nexus-core`, criado em pasta separada para preservar a aplicação NestJS/Next.js original.

## Stack

- Ruby 3.3
- Rails 7.1
- PostgreSQL
- JWT para API
- Sessão Rails para views HTML
- BCrypt para senha

## Setup

```bash
cd rails_port
bundle install
bin/rails db:create db:migrate db:seed
bin/rails server -p 3002
```

No Windows desta máquina, Ruby/Rails não estavam instalados durante a criação, então os comandos acima precisam ser executados após instalar Ruby e Bundler.

## Banco

Configure `DATABASE_URL` ou edite `config/database.yml`.

Exemplo compatível com o `docker-compose.yml` do projeto original:

```bash
DATABASE_URL=postgres://admin:1213122@localhost:5433/core_db
```

Para rodar em um banco separado, omita `DATABASE_URL` e deixe o Rails criar
`nexus_core_rails_development`. Para apontar para o banco já usado pelo projeto
NestJS, mantenha o `DATABASE_URL` acima; as migrations usam `if_not_exists` para
evitar recriar tabelas existentes.

## Funcionalidades portadas

- Login por e-mail ou `userid`
- Sessão HTML e JWT para API
- Super Admin por grupo `Super Admin` ou e-mail legado
- Módulos do sistema e sidebar por permissões diretas/grupos
- CRUD de usuários
- CRUD de grupos
- Relatórios AVA de progresso e notas
- Filtros, paginação e métricas dos dashboards
- Exportação em CSV
- Sincronização Moodle por `CRON_SECRET`
- Índices de performance para filtros e buscas AVA

## Endpoints principais

- `GET /login`
- `POST /login`
- `DELETE /logout`
- `GET /`
- `GET /admin/users`
- `GET /admin/groups`
- `GET /reports/progress/:institution`
- `GET /reports/grades/:institution`
- `GET /api/system/sidebar_modules`
- `GET /api/system/sidebar-modules`
- `POST /api/auth/login`
- `POST /api/ava_reports/progress`
- `POST /api/ava-reports/progress`
- `POST /api/ava_reports/grades`
- `POST /api/ava-reports/grades`
- `GET /api/ava_sync`
- `GET /api/ava-sync`

## Observação

Este port preserva os nomes das tabelas/colunas do projeto original para facilitar migração gradual e reuso do banco.

## Variaveis de ambiente

- `DATABASE_URL`
- `JWT_SECRET`
- `CRON_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `MOODLE_*_GET_URL`
- `MOODLE_*_ATT_URL`

## Validacao local

Ruby, Bundler e Rails nao estavam instalados no ambiente onde esta porta foi
gerada. Por isso, a validacao feita aqui foi estatica. Depois de instalar Ruby,
rode:

```bash
bundle install
bin/rails zeitwerk:check
bin/rails db:prepare
bin/rails server -p 3002
```
