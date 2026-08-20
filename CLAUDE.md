# CLAUDE.md

This file provides repository guidance for Claude Code. The authoritative task-coordination contract is `docs/agent-task-coordination-spec.md`; agent behavior is defined in `AGENTS.md` and `agent/`.

## Commands

```bash
npm install
npm run start
npm run dev
npm test
npm run build
npx tsc --noEmit
```

Run one test file with an isolated database:

```bash
WACHA_DB_PATH=.tmp/wacha-test.db node --import tsx --test test/application/service/TaskCoordinationService.test.ts
```

Environment variables:

- `PORT`: server port, default `51743`
- `WACHA_DB_PATH`: SQLite path, default `wacha.db`
- `WACHA_CLAIM_TTL_MS`: Task Claim TTL, default 30 minutes

## Runtime model

- `/mcp` is stateless. A fresh MCP server and transport are created per request.
- `Authorization: Bearer <AgentName>` supplies the trusted-local Principal ID.
- Project Roles are durable grants in `project_grant`.
- Task ownership is an expiring row in `task_claim`; MCP session IDs are not identity or ownership.
- State-changing MCP tools except `renew_claim` require `requestId`.
- Claim-bound mutations validate Principal, current Claim, expiry, Task status, and Role.
- Important transitions append `change_log` entries in the same transaction.

The Web UI is an unauthenticated trusted-local operator interface. Its Task accept, reject, and cancel operations use the same coordination service and are recorded as `system:web-ui`. This is an audit label, not authenticated human identity.

## Current structure

```txt
src/app.ts
  Hono routes, stateless MCP transport, static SPA, error handling

src/mcp/createMcpServer.ts
  MCP tool registration and Zod input schemas

src/application/service/TaskCoordinationService.ts
  Project access, Role checks, Claim lifecycle, Task transitions,
  idempotency receipts, ordering, availability, and Change Log

src/application/usecase/
  Web UI CRUD and repository-backed domain operations

src/domain/
  Project, Story, Task models and repository interfaces

src/infrastructure/
  SQLite schema/migration and repository implementations

src/presentation/controller/PageController.ts
  Web UI JSON API

src/frontend/
  React 19, Vite, TanStack Query, Tailwind v4 SPA
```

`TaskCoordinationService` intentionally uses Kysely directly so multi-table workflow updates are atomic. Do not add a second Task transition implementation to a legacy use case. Extend the coordination service and reuse its transaction logic from both MCP and Web UI paths.

## Roles and workflow

Roles are `manager`, `reviewer`, and `worker`.

- Managers create Stories, plan and edit Tasks, and perform acceptance.
- Workers and Reviewers may create technical follow-up Tasks discovered during active work.
- Workers and Reviewers must not expand user requirements or change Task priority.

Task flow:

```txt
todo -> doing -> in_review -> wait_accept -> accepted
                    |             |
                    +-> rejected <-+
```

`availableFor` is caller-aware: it filters by Role, self-review/self-acceptance policy, Task state, and active Claim. Claim commands revalidate all conditions atomically.

## Change rules

- Prefer small changes consistent with existing naming and tests.
- Preserve the Claim and Change Log invariants for every Task transition.
- Register MCP schema changes in `createMcpServer.ts` and update `AGENTS.md`, `agent/`, README, and the canonical specification.
- Keep `skill/*.md` `allowRoles`, `requiredTools`, and procedural steps consistent with `agent/role-policy.md`.
- Human hard delete remains a Web UI administrative exception; Agent/MCP flows use reasoned cancellation.
- Do not expose the trusted-local Bearer or unauthenticated Web UI as a production security boundary.
