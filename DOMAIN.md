# Domain Guide

## Existing Domain Reality

Wacha already defines key domain primitives:

- Project
- Story
- Task
- ProjectRole
- TaskStatus

For example, `ProjectRole` includes manager, reviewer, worker, viewer fileciteturn12file0L1-L4

And `TaskStatus` expresses the workflow including review and acceptance fileciteturn14file0L1-L7

These are the core of the domain and must remain stable.

## Core Concepts

### Project

A container of stories, tasks, roles, and artifacts.

### Story

Represents intent and context of work.

Story is owned by manager.

### Task

Executable unit for worker.

Task must be:

- small
- testable
- reviewable

### TaskStatus

The canonical lifecycle:

```txt
todo -> doing -> in_review -> wait_accept -> accepted
                    ↓
                 rejected
```

### ProjectRole

Defines responsibility and permission.

```txt
manager  -> planning + acceptance
reviewer -> technical validation
worker   -> execution
viewer   -> read-only
```

## Domain Rules

### Rule 1: State transition is explicit

Never mutate TaskStatus arbitrarily.

Always use defined transitions.

### Rule 2: Role decides responsibility

- Worker cannot accept
- Reviewer cannot finalize
- Manager owns acceptance

These rules are already partially enforced in MCP tools fileciteturn6file0L52-L67

### Rule 3: Review is part of the domain

Review is not optional.

A task is not complete at `in_review`.

It is only complete after `accepted`.

### Rule 4: Instructions are domain-driven

Instruction delivery is not UI concern.

It is part of role execution behavior.

This is already implemented via `InstructionService` fileciteturn16file0L1-L6

## Non-Domain Concepts

The following should not be placed in domain:

- MCP response formats
- HTTP request handling
- SQLite queries
- File loading logic

## Design Goal

Keep domain small and strict.

Push complexity to:

- usecases for orchestration
- skills for reusable behavior
- tools for execution boundary
