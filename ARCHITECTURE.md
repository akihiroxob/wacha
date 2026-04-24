# Wacha Architecture

## Positioning

Wacha is a task orchestration hub for coordinating human requests and AI agents through MCP.

It is not only a tool server. It owns the workflow for project, story, task, role, review, and instruction delivery.

## Core Principle: AI-Native DDD

Wacha uses AI-Native DDD.

This means:

- domain concepts are explicit
- use cases are the main unit of change
- agents receive role-specific instructions
- MCP tools expose controlled operations
- review is part of the workflow, not an afterthought

## Current Architectural Contract

Wacha already has these important boundaries:

- `AGENTS.md` explains how agents should use the MCP server.
- `agent/role-policy.md` defines role responsibilities and tool permissions.
- `agent/manager.md`, `agent/reviewer.md`, and `agent/worker.md` define role-specific behavior.
- `get_role_instructions` returns role-specific instruction files.
- `TaskStatus` represents the review workflow: `todo`, `doing`, `in_review`, `wait_accept`, `accepted`, `rejected`.

These files and concepts should remain the operational base.

## Recommended Layering

```txt
src/
  constants/          # shared constants such as ProjectRole and TaskStatus
  domain/
    model/            # domain models
    repository/       # repository interfaces
    service/          # domain services
    policy/           # pure decision rules

  application/
    usecase/          # one application action per use case
    service/          # orchestration services such as InstructionService

  infrastructure/
    database/         # schema and DB setup
    repository/       # concrete repository implementations
    filesystem/       # file-backed instruction / skill loading

  mcp/
    tool/             # MCP tool adapters
    middleware/       # guards and role checks
    utils/            # MCP response helpers

  presentation/       # Hono routes, controllers, SSR views
```

## Dependency Direction

```txt
presentation / mcp
        ↓
application
        ↓
domain
        ↑
infrastructure
```

Rules:

- Domain must not depend on MCP, Hono, SQLite, filesystem, or Codex.
- Application may depend on domain interfaces.
- Infrastructure implements concrete persistence and I/O.
- MCP tools should be thin adapters around use cases or application services.

## UseCase Policy

A UseCase represents one intentional action.

Good examples:

- `AssignProjectRoleUseCase`
- `IssueStoryUseCase`
- `IssueTaskUseCase`
- `ClaimTaskUseCase`
- `CompleteTaskUseCase`
- `ReviewedTaskUseCase`
- `AcceptTaskUseCase`
- `RejectTaskUseCase`

Avoid generic services such as:

- `TaskService` that does everything
- `ProjectService` that owns unrelated workflows
- `AgentService` that mixes role, task, and instruction logic

## MCP Tool Policy

An MCP tool is an external operation boundary.

It should:

- validate input
- check role permissions when needed
- call one use case or application service
- return a clear machine-readable result

It should not:

- contain large domain logic
- directly encode complex state transition rules
- bypass review or role policy

## Role Policy

Role is not just permission.

```txt
Role = permission + responsibility + instruction
```

The canonical roles are:

- `manager`
- `reviewer`
- `worker`
- `viewer`

Role behavior is defined under `agent/`.

## Instruction Policy

Instructions should be delivered by Wacha, not assumed to be known by the agent.

The current `get_role_instructions` approach is correct.

Recommended shared instruction set:

- `agent/role-policy.md`
- `DOMAIN.md`
- `REVIEW_POLICY.md`
- `SKILL_GUIDE.md`

Recommended role-specific instruction set:

- `agent/manager.md`
- `agent/reviewer.md`
- `agent/worker.md`
- `agent/viewer.md` when viewer becomes active

## Review Policy

Review is a domain workflow.

The intended flow is:

```txt
todo -> doing -> in_review -> wait_accept -> accepted
                    ↓
                 rejected
```

- `worker` moves a task to `in_review`.
- `reviewer` moves a reviewed task to `wait_accept`.
- `manager` performs final `accepted` / `rejected` judgment.

## Skill Policy

A Skill is a reusable agent operating procedure.

A Skill is not a role and not a task.

```txt
Task  = what should be done
Role  = who is responsible
Skill = how the agent should perform a reusable operation
Tool  = executable operation exposed through MCP
```

Skills should first be stored as Markdown or JSON artifacts. After they stabilize, they can be exposed through MCP tools.

## Design Rule

When unsure where something belongs, use this test:

- Is it a business concept? -> domain
- Is it one application action? -> application/usecase
- Is it I/O or persistence? -> infrastructure
- Is it an external callable operation? -> mcp/tool
- Is it agent behavior guidance? -> agent or skill docs
