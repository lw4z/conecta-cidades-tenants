# Conecta Cidades Tenants — Documentação Técnica e Especificação

> Documento de referência para construção do projeto via agentes OpenCode.
> Versão: 1.0 — Draft inicial de especificação.

---

## 1. Visão Geral

**Conecta Cidades Tenants** é um serviço web (rodando em container Docker) para **gerenciar tenants** (configurações de clientes/prefeituras) que serão consumidos por **outros sistemas** — principalmente via um nó *HTTP Request* no **n8n**.

O produto tem duas faces:

1. **Interface web (CRUD)** — autenticada, moderna, para um ou mais usuários criarem, editarem, visualizarem e removerem tenants e seus parâmetros de integração (Conecta, WhatsApp/Turn.io, Chatwoot-like "chat", IA).
2. **API de leitura (integração)** — protegida por API Key, consumida via `curl`/n8n, que devolve os tenants no **formato JSON exato** já usado hoje (ver seção 6.3), seja **todos agrupados** ou **um único tenant por nome**.

Não há necessidade de multitenancy de acesso (isolamento entre usuários) — é uma ferramenta interna de administração. Os "tenants" gerenciados aqui são **dados de configuração**, não contas de usuários do próprio sistema.

---

## 2. Objetivos e Escopo

### Objetivos
- CRUD completo de tenants, com formulários estruturados (não JSON cru) para reduzir erro humano.
- Persistência local em **SQLite** (dado ser um volume pequeno de texto/configuração).
- Autenticação de usuários administradores (login/senha), com tela de "meus dados" para alterar nome, e-mail e senha.
- Rodar como **um único serviço Docker** (imagem final publicável), com dados persistidos via volume.
- Expor **2 rotas de leitura pública/integrável**:
  - `GET /api/v1/tenants` → lista de todos os tenants ativos, no formato de array de objetos `{ "info": {...} }`.
  - `GET /api/v1/tenants/{tenant}` → um único tenant no mesmo formato (objeto único, não array).

### Fora de escopo (v1)
- Multi-organização / múltiplos ambientes (dev/staging/prod) dentro do mesmo banco.
- Histórico de versões / auditoria detalhada de alterações (pode virar v1.1).
- Gestão de permissões granulares por usuário (todo usuário logado tem acesso total ao CRUD).
- Rotação automática de segredos/tokens dos provedores externos.

---

## 3. Stack Tecnológica

| Camada | Tecnologia | Observação |
|---|---|---|
| Backend / API | **FastAPI** (Python 3.12) | Consistente com o stack já usado no Judicial |
| ORM / DB | **SQLModel** ou **SQLAlchemy 2.x** + **SQLite** | Migrations com **Alembic** |
| Auth | **JWT** (cookie httpOnly p/ web) + **API Key** (header, p/ integração) | `passlib[bcrypt]` para hash de senha |
| Frontend | **React 19 + TypeScript + Vite** | Zustand (estado), TanStack Query (dados), React Hook Form + Zod (formulários) |
| Estilo | Tailwind CSS | Visual moderno, sem "cara técnica" |
| Editor de cron | **react-js-cron** (ou equivalente) + **cronstrue** | Editor visual para `horario.cron`, com tradução da expressão para texto legível ("segunda a sexta, das 8h às 17h") |
| Testes backend | **pytest** + **httpx.AsyncClient** | Cobertura de rotas, regras de negócio e serialização |
| Testes frontend | **Vitest** + **React Testing Library** | Componentes e fluxos de formulário |
| E2E | **Playwright** | Login → criar tenant → consultar API |
| Container | **Docker multi-stage** | Build do frontend + backend em uma única imagem final |
| Persistência | Volume Docker apontando para o arquivo `.sqlite3` | Backup = copiar o arquivo |

---

## 4. Arquitetura

```
                        ┌─────────────────────────────┐
                        │        Docker Container      │
                        │                              │
   Browser  ───────────▶│  FastAPI (uvicorn)           │
   (Web UI)              │  ├─ /             (SPA React)│
                        │  ├─ /api/auth/*    (sessão)   │
                        │  ├─ /api/tenants/* (CRUD, JWT)│
                        │  └─ /api/v1/tenants* (API Key)│
                        │           │                  │
   n8n / curl ─────────▶│           ▼                  │
   (X-API-Key)           │      SQLite (volume)         │
                        └─────────────────────────────┘
```

- **Um único processo/container** serve tanto os arquivos estáticos da SPA quanto a API — simplifica o deploy (uma imagem, um `docker run`).
- O SQLite fica em `/data/conecta_tenants.db` dentro do container, mapeado para um volume nomeado no host.

---

## 5. Modelo de Dados (SQLite)

O JSON de exemplo tem uma estrutura aninhada. Para permitir edição via formulários (e não JSON cru), o modelo é **relacional**, com uma tabela por "bloco" do JSON. Campos que variam por provedor (ex.: WhatsApp com provedores diferentes de "turn-io") usam uma coluna `config_json` (TEXT) como extensão flexível, evitando migrations a cada novo provedor.

### 5.1 `users`
| coluna | tipo | obs |
|---|---|---|
| id | INTEGER PK | |
| username | TEXT UNIQUE | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt |
| full_name | TEXT | |
| is_active | BOOLEAN | default true |
| created_at | DATETIME | |
| updated_at | DATETIME | |
| last_login_at | DATETIME | nullable |

### 5.2 `tenants` (raiz)
| coluna | tipo | obs |
|---|---|---|
| id | INTEGER PK | |
| tenant_slug | TEXT UNIQUE | ex.: `jaboataomaisfacil_jaboatao_pe_gov_br` — chave usada na rota `/api/v1/tenants/{tenant}` |
| display_name | TEXT | nome amigável só para a UI |
| is_active | BOOLEAN | default true; tenants inativos não aparecem na API pública |
| created_at / updated_at | DATETIME | |
| created_by_id / updated_by_id | INTEGER FK → users.id | |

### 5.3 `tenant_conecta` (1:1 com tenant)
| coluna | tipo |
|---|---|
| tenant_id | INTEGER FK PK |
| base_url | TEXT |
| token | TEXT (armazenado criptografado — ver §7.4) |

### 5.4 `tenant_whatsapp` (1:1 com tenant)
**Decisão confirmada: v1 suporta apenas o provedor `turn-io`** (sem formulário genérico/multi-provedor por enquanto — campo `provider` fica fixo como constante, mas mantido como coluna para permitir extensão futura sem quebrar o schema).

| coluna | tipo | obs |
|---|---|---|
| tenant_id | INTEGER FK PK | |
| provider | TEXT | valor fixo `"turn-io"` na v1 |
| base_url | TEXT | |
| version | TEXT | ex.: `v1` |
| access_token | TEXT | criptografado |
| business_id | TEXT | |
| username | TEXT | |
| password | TEXT | criptografado |
| token | TEXT | criptografado (`Bearer ...`) |

Campos estruturados diretamente na tabela (em vez de `config_json` genérico), já que só há um provedor a suportar — simplifica o formulário e a validação.

### 5.5 `tenant_chat` (1:1 com tenant)
| coluna | tipo |
|---|---|
| tenant_id | INTEGER FK PK |
| base_url | TEXT |
| account_id | INTEGER |
| api_access_token | TEXT (criptografado) |
| api_access_token_bot | TEXT (criptografado) |
| csat_flow_id | TEXT |

### 5.6 `tenant_chat_inbox` (1:N com tenant_chat)
| coluna | tipo |
|---|---|
| id | INTEGER PK |
| tenant_id | INTEGER FK |
| inbox_id | INTEGER |
| inbox_identifier | TEXT |
| ordem | INTEGER | ordem de exibição/serialização |

### 5.7 `tenant_ai` (1:1 com tenant)
| coluna | tipo |
|---|---|
| tenant_id | INTEGER FK PK |
| api_key | TEXT (criptografado) |
| database | TEXT |
| database_chat_histories | TEXT |
| nome_projeto | TEXT |
| nome_prefeitura | TEXT |
| url_projeto | TEXT |
| url_servico | TEXT |
| horario_cron | TEXT |
| horario_timezone | TEXT |
| horario_msg | TEXT |

### 5.8 Diagrama ER simplificado
```
users 1───N tenants (created_by / updated_by)

tenants 1───1 tenant_conecta
tenants 1───1 tenant_whatsapp
tenants 1───1 tenant_chat ───N tenant_chat_inbox
tenants 1───1 tenant_ai
```

---

## 6. API

### 6.1 Autenticação — `/api/auth`
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | body `{username, password}` → seta cookie httpOnly com JWT |
| POST | `/api/auth/logout` | invalida cookie |
| GET | `/api/auth/me` | retorna dados do usuário logado |
| PUT | `/api/auth/me` | altera nome/e-mail/senha do próprio usuário (exige senha atual para trocar senha) |

### 6.2 CRUD de tenants (autenticado via JWT/cookie) — `/api/tenants`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/tenants` | lista paginada/resumida (para a tabela da UI) |
| POST | `/api/tenants` | cria tenant (payload estruturado, não o JSON final) |
| GET | `/api/tenants/{id}` | detalhe completo (para popular o formulário de edição) |
| PUT | `/api/tenants/{id}` | atualiza |
| DELETE | `/api/tenants/{id}` | remove **definitivamente** (exclusão real, com confirmação obrigatória na UI) |
| PATCH | `/api/tenants/{id}/status` | ativa/**desativa temporariamente** (`is_active=false`) sem excluir nem editar os demais campos |

**Decisão confirmada:** os dois mecanismos coexistem — desativação temporária (reversível, tenant some da API pública mas continua no banco/listagem admin) e exclusão definitiva (irreversível, remove o registro e seus blocos relacionados via `ON DELETE CASCADE`).

### 6.2.1 Gestão de API Keys — `/api/api-keys` (autenticado)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/api-keys` | lista chaves (nome, ativa/inativa, `last_used_at`) — nunca retorna a chave em claro |
| POST | `/api/api-keys` | cria uma nova chave para uma integração; retorna a chave em claro **apenas nesta resposta** |
| PATCH | `/api/api-keys/{id}/status` | ativa/revoga |
| DELETE | `/api/api-keys/{id}` | remove definitivamente |

### 6.3 Integração pública (API Key) — `/api/v1`
Protegida por header `X-API-Key: <chave>`. **Não usa cookie/JWT** — é feita para ser chamada por n8n/curl.

**Decisão confirmada: uma API Key por integração consumidora** (não uma única chave global). Isso exige uma tabela `api_keys`:

| coluna | tipo | obs |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | nome da integração consumidora (ex.: `n8n-producao`, `n8n-homolog`) |
| key_hash | TEXT | hash da chave (a chave em claro só é exibida uma vez, na criação) |
| is_active | BOOLEAN | permite revogar sem excluir (histórico de uso) |
| created_at | DATETIME | |
| last_used_at | DATETIME | atualizado a cada chamada autenticada, útil para auditoria |

- Gestão das chaves (criar/revogar/renomear) fica em uma tela da própria UI web (`/api/tenants`-style, autenticada por login), não mais em variável de ambiente fixa.
- A verificação compara o hash da chave recebida no header contra `api_keys.key_hash` das chaves `is_active = true`.
- Cada chamada às rotas `/api/v1/*` atualiza `last_used_at` da chave usada, permitindo saber quais integrações estão ativas de fato.

**`GET /api/v1/tenants`** → retorna array com todos os tenants ativos, no formato:
```json
[
  {
    "info": {
      "tenant": "jaboataomaisfacil_jaboatao_pe_gov_br",
      "conecta": { "base_url": "...", "token": "..." },
      "whatsapp": { "provider": "turn-io", "turn-io": { "...": "..." } },
      "chat": { "base_url": "...", "account_id": 7, "...": "...", "inbox": [ { "id": 7, "inbox_identifier": "..." } ], "csat": { "flow_id": "..." } },
      "ai": { "...": "..." }
    }
  }
]
```

**`GET /api/v1/tenants/{tenant}`** → retorna **um único objeto** (não array) no mesmo formato de `info`, ou `404` se o `tenant_slug` não existir ou estiver inativo.

Exemplo de uso real (o caso de uso descrito pelo usuário):
```bash
curl -H "X-API-Key: $CONECTA_TENANTS_API_KEY" \
  https://seu-host/api/v1/tenants

curl -H "X-API-Key: $CONECTA_TENANTS_API_KEY" \
  https://seu-host/api/v1/tenants/jaboataomaisfacil_jaboatao_pe_gov_br
```

### 6.4 Erros padronizados
```json
{ "error": { "code": "TENANT_NOT_FOUND", "message": "Tenant 'x' não encontrado ou inativo." } }
```
Códigos: `INVALID_CREDENTIALS`, `TENANT_NOT_FOUND`, `TENANT_SLUG_ALREADY_EXISTS`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_API_KEY`.

---

## 7. Segurança

1. **Senhas** de usuários: hash com bcrypt (`passlib`), nunca armazenadas em texto puro.
2. **JWT**: cookie `httpOnly`, `secure` (quando HTTPS), `SameSite=Lax`, expiração curta (ex.: 8h) + refresh silencioso.
3. **API Keys** da rota `/api/v1/*`: uma chave por integração consumidora, gerenciadas via tabela `api_keys` (armazenadas com hash, nunca em claro). A chave em claro é exibida **uma única vez**, no momento da criação, e não pode ser recuperada depois — apenas revogada e recriada.
4. **Segredos dos tenants** (tokens, senhas de provedores, `api_key` de IA): recomendado armazenar **criptografados em repouso** no SQLite usando `cryptography.Fernet`, com a chave de criptografia vinda de uma env var (`FIELD_ENCRYPTION_KEY`) — nunca commitada. A API `/api/v1/*` descriptografa na hora de montar o JSON de resposta (o consumidor final, n8n, precisa do valor em claro).
5. Rate limiting básico na rota de login (ex.: `slowapi`) para mitigar força bruta.
6. CORS restrito ao próprio domínio da SPA (a API pública `/api/v1` não precisa de CORS, é server-to-server).

---

## 8. Interface Web

### 8.1 Telas
- **Login** — usuário/senha.
- **Dashboard/Lista de tenants** — tabela com busca por nome, filtro ativo/inativo, badges indicando quais integrações estão configuradas (Conecta / WhatsApp / Chat / IA).
- **Criar/Editar tenant** — formulário em abas ou *wizard* de passos: `1. Identificação` → `2. Conecta` → `3. WhatsApp` → `4. Chat` → `5. IA` → `6. Revisão (preview do JSON final)`.
- **Detalhe do tenant** — visão somente leitura + botão "ver JSON" (preview do payload exatamente como sai na API) + botão de copiar `curl` de exemplo + botões de "Desativar/Ativar" e "Excluir definitivamente" (com modal de confirmação distinto para cada ação, já que uma é reversível e a outra não).
- **Meus dados** — o usuário logado edita nome, e-mail e senha.
- **Usuários** (opcional v1, se for útil desde já) — tela simples para cadastrar outros usuários administradores. Todo usuário logado tem acesso total ao sistema (sem papéis/permissões diferenciadas na v1).
- **API Keys** — tela para criar/nomear/revogar chaves de integração (uma por integração consumidora), com exibição da chave em claro apenas no momento da criação.

### 8.2 Requisitos de UX
- Campos sensíveis (tokens, senhas de integração) em inputs do tipo "password" com botão de mostrar/ocultar.
- Validação client-side com Zod espelhando as validações do backend (Pydantic).
- Preview do JSON final do tenant antes de salvar, para conferência.
- Feedback visual claro de sucesso/erro (toast).
- **Editor visual de cron** (campo `ai.horario_funcionamento.cron`): em vez de o usuário digitar a expressão cron manualmente, um componente com seletores amigáveis — dias da semana (checkboxes seg-dom), horário de início/fim, ou opções pré-definidas ("comercial: seg-sex 8h-17h") — que gera a expressão cron por baixo dos panos. Deve mostrar em tempo real a tradução legível da expressão (ex.: "Todos os dias úteis, das 08h às 17h") e permitir alternar para edição manual da expressão crua para casos avançados.

---

## 9. Estrutura de Pastas do Projeto

```
conecta-cidades-tenants/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py          # env vars, settings via pydantic-settings
│   │   │   ├── security.py        # JWT, hash, API key, Fernet
│   │   │   └── database.py        # engine, sessão
│   │   ├── models/                # SQLModel/SQLAlchemy models
│   │   │   ├── user.py
│   │   │   └── tenant.py
│   │   ├── schemas/                # Pydantic (request/response)
│   │   │   ├── auth.py
│   │   │   └── tenant.py
│   │   ├── api/
│   │   │   ├── deps.py            # dependências (get_current_user, verify_api_key)
│   │   │   ├── auth.py
│   │   │   ├── tenants.py         # CRUD autenticado
│   │   │   └── public.py          # /api/v1/tenants*
│   │   ├── services/
│   │   │   ├── tenant_service.py  # regras de negócio + serialização p/ JSON final
│   │   │   └── crypto_service.py
│   │   └── alembic/                # migrations
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_tenants_crud.py
│   │   ├── test_public_api.py
│   │   └── test_tenant_serialization.py
│   ├── pyproject.toml
│   └── Dockerfile.backend (ou integrado no Dockerfile raiz)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── TenantsListPage.tsx
│   │   │   ├── TenantFormPage.tsx
│   │   │   ├── TenantDetailPage.tsx
│   │   │   └── AccountPage.tsx
│   │   ├── components/
│   │   │   └── CronEditor.tsx      # editor visual de cron (react-js-cron + cronstrue)
│   │   ├── hooks/                  # useTenants, useAuth, useApiKeys (TanStack Query)
│   │   ├── store/                  # Zustand
│   │   ├── schemas/                # Zod
│   │   └── api/client.ts
│   ├── tests/                      # Vitest + RTL
│   ├── e2e/                        # Playwright
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile                       # multi-stage: build frontend + runtime backend
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 10. Docker

### 10.1 `Dockerfile` (multi-stage, imagem única)
```dockerfile
# ---- Stage 1: build do frontend ----
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Stage 2: runtime backend ----
FROM python:3.12-slim AS runtime
WORKDIR /app
COPY backend/pyproject.toml backend/poetry.lock* ./
RUN pip install --no-cache-dir poetry && poetry install --no-root --only main
COPY backend/ .
COPY --from=frontend-build /app/frontend/dist ./app/static

RUN mkdir -p /data
VOLUME ["/data"]
ENV DATABASE_URL=sqlite:////data/conecta_tenants.db

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 10.2 `docker-compose.yml`
```yaml
services:
  conecta-tenants:
    build: .
    image: conecta-cidades-tenants:latest
    ports:
      - "8000:8000"
    volumes:
      - tenants_data:/data
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - FIELD_ENCRYPTION_KEY=${FIELD_ENCRYPTION_KEY}
      - TENANTS_API_KEY=${TENANTS_API_KEY}
      - ACCESS_TOKEN_EXPIRE_MINUTES=480
    restart: unless-stopped

volumes:
  tenants_data:
```

### 10.3 `.env.example`
```
SECRET_KEY=change-me
FIELD_ENCRYPTION_KEY=change-me-32-bytes-base64
TENANTS_API_KEY=change-me-long-random-key
```

Na primeira subida, um script de *bootstrap* (executado no `startup` do FastAPI ou via comando `python -m app.cli create-admin`) cria o primeiro usuário administrador, evitando um banco sem nenhum login possível.

---

## 11. Testes

### 11.1 Backend (pytest)
- **Unitários**
  - Hash/verificação de senha.
  - Criptografia/decriptação de campos sensíveis (`crypto_service`).
  - Serialização de um tenant do modelo relacional para o JSON final (`tenant_service`), incluindo casos com `inbox` vazio, múltiplos inboxes, provider de WhatsApp diferente de `turn-io`.
- **Integração (API, com banco SQLite em memória/arquivo temporário)**
  - Login com credenciais válidas/inválidas, expiração de token.
  - CRUD completo de tenant (criar → editar → desativar → excluir), incluindo validação de `tenant_slug` duplicado.
  - `PUT /api/auth/me` alterando senha (exige senha atual correta).
  - `GET /api/v1/tenants` sem API Key → 401; com API Key inválida → 401; com API Key válida → 200 e formato correto.
  - `GET /api/v1/tenants/{tenant}` existente → 200; inexistente → 404; inativo → 404.
  - Tenants inativos não aparecem em `GET /api/v1/tenants`.

### 11.2 Frontend (Vitest + RTL)
- Formulário de tenant: validação de campos obrigatórios por aba, preview do JSON final antes de salvar.
- Fluxo de login/logout e redirecionamento de rotas protegidas.
- Tela "meus dados": troca de senha com confirmação.

### 11.3 E2E (Playwright)
- Login → criar tenant completo (todas as abas) → verificar que aparece na listagem → chamar (via `fetch`/API) `/api/v1/tenants/{tenant}` e validar o JSON retornado.
- Editar tenant existente e confirmar que a API pública reflete a alteração.
- Desativar tenant e confirmar que some da API pública mas continua visível na listagem administrativa.

### 11.4 Critério de pronto (Definition of Done)
- Cobertura de testes backend ≥ 80% nas camadas `services` e `api`.
- Todos os testes de integração e E2E acima implementados e passando em CI local (`docker compose run tests` ou equivalente).
- `docker build` gera imagem funcional que sobe com `docker compose up` sem passos manuais além de configurar `.env`.

---

## 12. Roadmap de Implementação (fases sugeridas para os agentes)

1. **Fase 0 — Fundação**: setup do projeto (backend + frontend), Docker básico, modelo de dados + migrations Alembic, autenticação (login, JWT, hash).
2. **Fase 1 — CRUD de tenants (backend)**: endpoints `/api/tenants/*`, serialização para o JSON final, testes de integração.
3. **Fase 2 — API pública**: `/api/v1/tenants` e `/api/v1/tenants/{tenant}`, autenticação via API Key, testes.
4. **Fase 3 — Frontend**: telas de login, listagem, formulário multi-etapas, tela de conta, integração com TanStack Query.
5. **Fase 4 — Segurança e polimento**: criptografia de campos sensíveis, rate limiting no login, preview de JSON, mensagens de erro amigáveis.
6. **Fase 5 — Testes E2E e Docker final**: Playwright, ajuste fino do `Dockerfile`/`docker-compose`, README com instruções de deploy.

---

## 13. Decisões confirmadas

- **Permissões:** todo usuário logado tem acesso total ao CRUD (sem papéis/permissões diferenciadas na v1).
- **Exclusão de tenants:** ambos os mecanismos existem — desativação temporária (reversível, `is_active=false`) e exclusão definitiva (irreversível, `DELETE`).
- **API Keys:** uma chave por integração consumidora, gerenciadas via tela própria na UI (tabela `api_keys`, armazenadas com hash).
- **WhatsApp:** v1 suporta apenas o provedor `turn-io`, com campos estruturados dedicados (sem formulário genérico multi-provedor por enquanto).
- **Cron:** o campo `horario_funcionamento.cron` tem editor visual amigável (dias da semana + horário, com tradução legível da expressão), com opção de edição manual avançada.
