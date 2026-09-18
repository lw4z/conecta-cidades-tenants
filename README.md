# Conecta Cidades Tenants

Sistema de gerenciamento de tenants para integração com n8n. Permite cadastrar, configurar e consumir configurações de múltiplos tenants via API REST, com suporte a múltiplos provedores WhatsApp.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | FastAPI 3.12 + SQLModel/SQLAlchemy 2.x + SQLite + Alembic |
| **Frontend** | React 19 + TypeScript + Vite + Zustand + TanStack Query + Tailwind CSS |
| **Auth** | JWT (httpOnly cookie) + API Key (para n8n/curl) |
| **Container** | Docker multi-stage (Node → Python) |

## Features

- **CRUD completo de tenants** com paginação, busca e filtros
- **Autenticação JWT** via httpOnly cookie (sessão web)
- **API Keys** para acesso externo (n8n, curl)
- **API pública v1** (`/api/v1/tenants`) com formato específico para n8n
- **Import/Export** de tenants em JSON com estrutura dicionário-por-slug
- **Multi-provedor WhatsApp** — suporta `turn-io` e `meta-cloud-api`
- **Campos extras flexíveis** via `config_json` em Tenant, Conecta e WhatsApp
- **Cron editor** para agendamento de mensagens
- **Rate limiting** no login (5/min)
- **Campos sensíveis criptografados** (Fernet) no banco de dados
- **Soft-delete e hard-delete** para tenants
- **Preview JSON** da API pública antes de exportar

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- Ou para desenvolvimento: Python 3.12+ + Node.js 20+ + [Poetry 2.x](https://python-poetry.org/docs/#installation)

## Quick Start (Docker)

```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USER/conecta-cidades-tenants.git
cd conecta-cidades-tenants

# 2. Crie o arquivo .env (copie do exemplo)
cp .env.example .env

# 3. Suba o container
docker compose up -d --build

# 4. Acesse
# Frontend + API: http://localhost:8080
# Login: admin / admin123
```

O banco SQLite é persistido no volume Docker `tenants_data`.

## Desenvolvimento

### Backend

```bash
cd backend

# Instalar dependências
poetry install

# Variáveis de ambiente (já vem no .env da raiz, mas pode copiar)
cp ../.env.example .env

# Rodar migrations
poetry run alembic upgrade head

# Iniciar servidor de desenvolvimento (porta 8080)
poetry run uvicorn app.main:app --port 8080 --reload

# Rodar testes
poetry run pytest

# Rodar teste específico
poetry run pytest tests/test_tenants_crud.py
```

### Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (porta 5173, proxy para 8080)
npm run dev

# Build de produção
npm run build

# Lint
npm run lint
```

O frontend em dev mode faz proxy de `/api` para `http://localhost:8080`.

## Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `SECRET_KEY` | Chave para assinatura JWT | `change-me-to-a-random-string` |
| `FIELD_ENCRYPTION_KEY` | Chave Fernet para criptografia de campos sensíveis (32 bytes base64) | `XrmQ9n3-P4dg9zkuVrHxMrZA2LpiYFu8myHKSzfVbXI=` |
| `TENANTS_API_KEY` | API Key legado (sendo substituído por chaves por consumidor) | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Tempo de expiração do JWT | `480` |
| `ADMIN_USERNAME` | Usuário admin criado no boot | `admin` |
| `ADMIN_PASSWORD` | Senha do admin | `admin123` |
| `ADMIN_EMAIL` | Email do admin | `admin@conecta.local` |
| `DATABASE_URL` | URL do banco SQLite | `sqlite:////data/conecta_tenants.db` |

> **Gerar FIELD_ENCRYPTION_KEY válida:**
> ```python
> from cryptography.fernet import Fernet
> print(Fernet.generate_key().decode())
> ```

## Estrutura do Projeto

```
conecta-cidades-tenants/
├── backend/
│   ├── app/
│   │   ├── api/              # Rotas: auth, tenants, api-keys, public
│   │   ├── core/             # Config, database, security, rate limiter
│   │   ├── models/           # SQLModel: Tenant, User, ApiKey
│   │   ├── schemas/          # Pydantic: TenantCreate, TenantDetailRead
│   │   ├── services/         # Lógica: tenant_service, crypto_service
│   │   ├── alembic/          # Migrations
│   │   └── main.py           # FastAPI app + SPA catch-all
│   ├── tests/                # 61 testes (pytest + httpx)
│   ├── pyproject.toml
│   └── poetry.lock
├── frontend/
│   ├── src/
│   │   ├── api/              # Axios client
│   │   ├── components/       # CronEditor, JsonPreview, ConfirmModal
│   │   ├── hooks/            # useTenants, useApiKeys, useAuth
│   │   ├── pages/            # LoginPage, TenantsList, TenantForm, TenantDetail, ApiKeys, Account
│   │   ├── store/            # Zustand auth store
│   │   └── types.ts          # TypeScript types
│   ├── e2e/                  # Playwright E2E tests
│   └── package.json
├── docker-compose.yml
├── Dockerfile                # Multi-stage: Node build → Python runtime
├── .env.example
└── README.md
```

## API

### Autenticação (Cookie JWT)

```bash
# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# Verificar sessão
curl http://localhost:8080/api/auth/me -b cookies.txt
```

### CRUD Tenants (autenticado)

```bash
# Listar (paginado)
curl "http://localhost:8080/api/tenants?page=1&per_page=10" -b cookies.txt

# Criar
curl -X POST http://localhost:8080/api/tenants \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "tenant_slug": "cidade-exemplo_sp_br",
    "display_name": "Cidade Exemplo",
    "conecta": {"base_url": "https://conecta.example.com", "token": "xxx"},
    "whatsapp": {"provider": "turn-io", "token": "xxx"},
    "ai": {"api_key": "sk-xxx"}
  }'

# Exportar todos
curl http://localhost:8080/api/tenants/export -b cookies.txt -o tenants.json

# Importar
curl -X POST http://localhost:8080/api/tenants/import \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d @tenants.json
```

### API Pública v1 (API Key)

A API pública é consumida pelo n8n via header `X-API-Key`.

```bash
# Listar tenants ativos
curl http://localhost:8080/api/v1/tenants \
  -H "X-API-Key: SUA_API_KEY"

# Buscar tenant por slug
curl http://localhost:8080/api/v1/tenants/cidade-exemplo_sp_br \
  -H "X-API-Key: SUA_API_KEY"
```

**Formato de resposta:**

```json
[
  {
    "dados": {
      "cidade-exemplo_sp_br": {
        "tenant": "cidade-exemplo_sp_br",
        "contract_id": 16,
        "conecta": {
          "base_url": "https://conecta.example.com",
          "token": "xxx"
        },
        "whatsapp": {
          "provider": "turn-io",
          "base_url": "https://whatsapp.turn.io",
          "token": "xxx"
        },
        "chat": {
          "base_url": "https://chat.example.com",
          "account_id": 123
        },
        "ai": {
          "api_key": "sk-xxx",
          "horario_cron": "0 8 * * *",
          "horario_timezone": "America/Sao_Paulo"
        }
      }
    }
  }
]
```

### API Keys

```bash
# Listar API Keys
curl http://localhost:8080/api/api-keys -b cookies.txt

# Criar nova API Key
curl -X POST http://localhost:8080/api/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"n8n-producao"}'

# Alternar status (ativo/inativo)
curl -X PATCH http://localhost:8080/api/api-keys/1/status -b cookies.txt

# Deletar
curl -X DELETE http://localhost:8080/api/api-keys/1 -b cookies.txt
```

## Formato de Import/Export

O export usa estrutura de dicionário-chaveado-por-slug:

```json
{
  "cidade-exemplo_sp_br": {
    "tenant_slug": "cidade-exemplo_sp_br",
    "display_name": "Cidade Exemplo",
    "is_active": true,
    "contract_id": 16,
    "conecta": {
      "base_url": "https://conecta.example.com",
      "token": "xxx"
    },
    "whatsapp": {
      "provider": "turn-io",
      "token": "xxx"
    },
    "ai": {
      "api_key": "sk-xxx",
      "horario_funcionamento": {
        "seg": [{"inicio": "08:00", "fim": "18:00"}]
      }
    }
  }
}
```

Campos extras no nível raiz (como `contract_id`) são preservados em `config_json` do tenant. Campos aninhados como `horario_funcionamento` são flattenados para colunas específicas.

## Testes

```bash
# Backend — 61 testes
cd backend && poetry run pytest

# Frontend — build check
cd frontend && npm run build

# E2E (Playwright)
cd frontend && npx playwright test
```

## Deploy

### Docker Compose (produção)

```bash
# Subir em background
docker compose up -d --build

# Ver logs
docker compose logs -f

# Parar
docker compose down

# Parar e limpar dados
docker compose down -v
```

O container expõe a porta **8080** (mapeada internamente para 8000). O banco SQLite é persistido no volume Docker `tenants_data`.

### Atualizar

```bash
git pull
docker compose up -d --build
```

## Licença

MIT
