# AGENTS.md — Conecta Cidades Tenants

## What is this

Greenfield project: a web service for managing tenant configurations consumed by n8n via API. **No code exists yet.** The full spec is the single source of truth:

- `conecta-cidades-tenants-docs/CONECTA_CIDADES_TENANTS_SPEC.md` (459 lines, sections 1–13)

Read it before any implementation. Do not guess requirements.

## Target structure (from spec §9)

```
conecta-cidades-tenants/
├── backend/       # FastAPI 3.12, SQLModel, Alembic, pytest
├── frontend/      # React 19 + TS + Vite, Zustand, TanStack Query, Tailwind
├── Dockerfile     # multi-stage (node build → python runtime)
├── docker-compose.yml
└── .env.example
```

This directory lives at the repo root once scaffolding is done. Currently only `conecta-cidades-tenants-docs/` exists.

## Stack

- **Backend:** FastAPI (Python 3.12) + SQLModel/SQLAlchemy 2.x + SQLite + Alembic migrations
- **Auth:** JWT (httpOnly cookie for web) + API Key header (for n8n/curl integration)
- **Frontend:** React 19 + TypeScript + Vite + Zustand + TanStack Query + React Hook Form + Zod + Tailwind
- **Container:** Docker multi-stage — one image serves SPA + API
- **Tests:** pytest + httpx (backend), Vitest + RTL (frontend), Playwright (E2E)

## Key decisions an agent would miss

- **All logged-in users have full CRUD access** — no roles/permissions in v1 (spec §13)
- **Two deletion mechanisms coexist:** soft-deactivate (`is_active=false`, reversible) AND hard-delete (irreversible, cascade) — both must be implemented (spec §6.2)
- **WhatsApp: only `turn-io` provider in v1** — `provider` column exists but is a constant, no multi-provider form (spec §5.4)
- **API Keys: one key per consumer integration** (not a single global key) — stored as hash, shown once at creation (spec §6.3)
- **Sensitive fields (tokens, passwords, API keys) must be encrypted at rest** with `cryptography.Fernet` using `FIELD_ENCRYPTION_KEY` env var (spec §7.4)
- **The `/api/v1/tenants` response has a specific nested JSON format** (`{ "info": { ... } }` wrapper) — see spec §6.3 for exact shape. Serialization logic is non-trivial.
- **Cron editor is required** — `react-js-cron` + `cronstrue` for the `horario_cron` field, with human-readable translation (spec §8.2)

## Environment variables

From `docker-compose.yml` / `.env.example`:
- `SECRET_KEY` — JWT signing
- `FIELD_ENCRYPTION_KEY` — Fernet key for encrypting sensitive fields at rest (32 bytes, base64)
- `TENANTS_API_KEY` — legacy, being replaced by per-consumer API keys in `api_keys` table
- `DATABASE_URL` — defaults to `sqlite:////data/conecta_tenants.db`

## Verification commands (once code exists)

```bash
# Backend
cd backend && pytest                    # all tests
cd backend && pytest tests/test_auth.py # single file
cd backend && alembic upgrade head      # apply migrations

# Frontend
cd frontend && npm run dev              # dev server
cd frontend && npm run test             # vitest
cd frontend && npm run build            # production build

# Docker
docker compose build                    # multi-stage build
docker compose up                       # run
```

## Implementation phases (spec §12)

0. **Foundation** — project scaffold, Docker, models + Alembic, auth
1. **CRUD backend** — `/api/tenants/*`, serialization, integration tests
2. **Public API** — `/api/v1/tenants`, API Key auth
3. **Frontend** — all pages, multi-step form, TanStack Query
4. **Security polish** — field encryption, rate limiting, error messages
5. **E2E + Docker final** — Playwright, Dockerfile polish, README

Follow this order. Each phase builds on the previous.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**This project has a knowledge graph. Start with the code-review-graph
MCP tools to narrow scope, then read the source.** The graph is cheaper than scanning files and
gives you structural context (callers, dependents, test coverage) that file search cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

### Verify in the source

- Narrow scope with the graph, then read the source. Do not change code from graph output alone.
- For any non-trivial change, read the implementation and the relevant tests before concluding.
- Verify the exact source when touching behavior, database logic, migrations, retries, fallbacks,
  recovery, or compatibility code.
- When the graph and the source disagree, the source wins. The graph may be stale or may not
  model that relationship.
- An empty graph result can mean "not indexed" or "not statically visible", not "does not exist".

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
<!-- /code-review-graph MCP tools -->
