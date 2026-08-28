# 🚀 Nexus Core - Manual Operacional de Implantação e Produção

Este documento fornece as instruções completas para implantação, configuração de ambiente, execução com Docker / PM2, proxy reverso Nginx e manutenção contínua do **Nexus Core**.

---

## 🏛️ 1. Arquitetura da Infraestrutura

O Nexus Core opera em arquitetura monorepo com as seguintes portas e serviços:

| Serviço | Tecnologia | Porta Interna | Porta Exposta (Prod) | Rota / Proxy Nginx |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Next.js 15 / NextAuth v5 | `3002` | `3002` | `/nexus` |
| **Backend** | NestJS 11 / Drizzle ORM | `3004` | `3004` | `/nexus-api/` |
| **Banco Principal** | PostgreSQL 16 Alpine | `5432` | `5433` | Interno Docker |
| **Integrador AVA** | Moodle OpenLMS (REST/JSON) | - | - | Sincronizado via Cron / Cron Secret |
| **Integrador Lyceum**| SQL Server (mssql pool) | `1433` | - | Consulta direta a Views |

---

## 🔐 2. Variáveis de Ambiente de Produção

Crie o arquivo `.env` na raiz do projeto (`/opt/nexus-core/.env` ou diretório do servidor) contendo:

```bash
# ==========================================
# AMBIENTE E REDE
# ==========================================
NODE_ENV=production
PORT=3004
BACKEND_PORT=3004
FRONTEND_PORT=3002

# ==========================================
# BANCO DE DADOS POSTGRESQL
# ==========================================
DB_PASSWORD=SuaSenhaSeguraPostgres2026!
DATABASE_URL=postgresql://admin:SuaSenhaSeguraPostgres2026!@db:5432/core_db

# ==========================================
# SEGURANÇA & JWT
# ==========================================
JWT_SECRET=nexus_jwt_super_secret_production_key_2026
CRON_SECRET=nexus_cron_secret_token_secure_2026
AUTH_SECRET=nexus_nextauth_secret_key_production_2026
SEED_ADMIN_PASSWORD=SenhaAdminInicialForte2026!

# ==========================================
# URLS PÚBLICAS & NGINX
# ==========================================
NEXT_PUBLIC_API_URL=https://aplicacao.unievangelica.edu.br/nexus-api
NEXT_API_URL=http://backend:3004
NEXT_BASE_PATH=/nexus
AUTH_URL=https://aplicacao.unievangelica.edu.br/nexus/api/auth
AUTH_TRUST_HOST=true

# ==========================================
# INTEGRAÇÃO LYCEUM (SQL SERVER)
# ==========================================
LYCEUM_DB_HOST=10.0.0.X
LYCEUM_DB_PORT=1433
LYCEUM_DB_DATABASE=LYCEUM_PROD
LYCEUM_DB_USERNAME=usr_nexus_sync
LYCEUM_DB_PASSWORD=SenhaForteLyceum2026!
LYCEUM_DB_PREFIX=dbo.

# ==========================================
# INTEGRAÇÃO MOODLE (OPENLMS)
# ==========================================
MOODLE_EAD_GRADES_GET_URL=https://...
MOODLE_EAD_GRADES_ATT_URL=https://...
MOODLE_EAD_PROGRESS_GET_URL=https://...
MOODLE_EAD_PROGRESS_ATT_URL=https://...
```

---

## 🐳 3. Implantação com Docker Compose (Recomendado)

### 3.1 Construir e Iniciar os Containers
```bash
# 1. Clonar ou atualizar o repositório
cd /opt/nexus-core
git pull origin main

# 2. Subir o stack completo de produção
docker compose -f docker-compose.prod.yml up -d --build

# 3. Verificar o status dos containers
docker compose -f docker-compose.prod.yml ps
```

### 3.2 Executar Migrações e Seeds Manuais (se necessário)
```bash
# Executar push das tabelas Drizzle
docker compose -f docker-compose.prod.yml exec backend npx drizzle-kit push --config=apps/backend/drizzle.config.ts --force

# Executar Seed de Módulos e Usuário Admin
docker compose -f docker-compose.prod.yml exec backend npx ts-node src/db/seed.ts
```

---

## 🌐 4. Configuração do Nginx (Proxy Reverso)

Copie o arquivo de configuração [`nginx/nexus.conf`](file:///c:/Users/ricardo.dias/develop/projetos/nexus-core/nginx/nexus.conf) para a pasta de configurações do Nginx no servidor:

```bash
sudo cp nginx/nexus.conf /etc/nginx/default.d/nexus.conf
sudo nginx -t
sudo systemctl reload nginx
```

### Trecho de Configuração no Nginx:
```nginx
# 1. Frontend (Next.js)
location /nexus {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# 2. Backend API (NestJS)
location /nexus-api/ {
    proxy_pass http://localhost:3004/; # Barra no final preserva rotas limpas no NestJS
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    client_max_body_size 50M;
}
```

---

## 🕒 5. Sincronização Periódica do Moodle (Crontab do Servidor)

Configure a execução periódica do sync do Moodle adicionando ao `crontab` do servidor:

```bash
# Executa a sincronização do AVA a cada 30 minutos
*/30 * * * * curl -X GET -H "Authorization: Bearer nexus_cron_secret_token_secure_2026" "https://aplicacao.unievangelica.edu.br/nexus-api/api/ava-sync?type=progress" > /dev/null 2>&1
0 */2 * * * curl -X GET -H "Authorization: Bearer nexus_cron_secret_token_secure_2026" "https://aplicacao.unievangelica.edu.br/nexus-api/api/ava-sync?type=grades" > /dev/null 2>&1
```

---

## 🩺 6. Verificação de Saúde e Monitoramento

1. **Testar API Backend:**
   ```bash
   curl -I https://aplicacao.unievangelica.edu.br/nexus-api/api/auth/login
   ```
2. **Visualizar Logs em Tempo Real:**
   ```bash
   # Logs do backend
   docker compose -f docker-compose.prod.yml logs -f --tail=100 backend

   # Logs do frontend
   docker compose -f docker-compose.prod.yml logs -f --tail=100 frontend
   ```
