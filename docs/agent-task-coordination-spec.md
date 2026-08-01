# Agent Task Coordination Specification

- Status: Implemented initial version
- Date: 2026-08-01
- Target branch: `feature/codewithclaude-advanced`
- Related design: `minimal-stateless-task-coordination-design.md`
- Audience: Codex, Claude Code, maintainers, and external orchestrator implementers

## 1. Purpose

This document is the implementation-facing source of truth for Wacha's agent task coordination model.

Wacha is not an agent runtime or agent orchestrator. Wacha is a task coordination service that allows multiple authenticated principals, including human users and AI agents, to inspect shared work, choose tasks independently, acquire exclusive task claims, and apply guarded state transitions.

Wacha must preserve the useful properties of the original Ralph Loop:

1. one loop handles one task;
2. each loop may start with a fresh context;
3. state, plans, and discoveries are externalized;
4. the agent retains the freedom to decide which task to perform next;
5. results are validated by external facts such as tests, code, and Git history.

Wacha must not choose the next task on behalf of an agent.

## 2. Responsibility boundary

### 2.1 Wacha owns

- Project, Story, Task, and Comment persistence
- authenticated Principal identity
- Project-scoped Role grants
- authorization checks for each operation
- exclusive, expiring Task Claims
- guarded Task state transitions
- append-only Change Log entries
- auditability of who claimed, completed, reviewed, accepted, or rejected a Task

### 2.2 Wacha does not own

- agent process lifecycle
- Ralph Loop iteration lifecycle
- conversation or model context
- token usage or cost
- model selection
- Git branch, worktree, commit, PR, CI, release, or rollback
- agent online or process status
- Console session lifecycle
- automatic selection of the next Task

External runners, Consoles, and orchestrators own those concerns and call Wacha through MCP or another adapter.

## 3. Core principles

### 3.1 Agents choose; Wacha validates

Wacha exposes Task facts and availability. An agent inspects the Project, specifications, repository, priority, and current code, then chooses a Task.

Wacha only decides whether the selected Task can be claimed at the moment the claim request is committed.

```text
list_tasks
  -> agent evaluates candidates
  -> agent calls claim_task / claim_review / claim_acceptance
  -> Wacha atomically accepts or rejects the claim
```

There are no `claim_next_task` or `claim_next_review` tools in this design.

### 3.2 Claim conflicts are expected

Multiple agents may select the same Task. This is acceptable.

Exactly one claim succeeds. Other callers receive a structured `CLAIM_CONFLICT` result and may choose another Task.

Wacha prevents duplicate execution; it does not prevent duplicate selection attempts.

### 3.3 Session state is not domain state

MCP connection state, HTTP connection state, `clientInfo`, and legacy `Mcp-Session-Id` must not be used as Principal identity, Role state, Project membership, or Task ownership.

Every request is authorized from an authenticated Principal and persisted Project grants.

## 4. Task status model

The existing Task status model is retained.

```ts
type TaskStatus =
  | "todo"
  | "doing"
  | "canceled"
  | "in_review"
  | "wait_accept"
  | "accepted"
  | "rejected";
```

No additional status model is introduced by this specification.

### 4.1 Main transition flow

```text
todo
  -- claim_task --> doing
  -- complete_task --> in_review

in_review
  -- claim_review --> in_review
  -- reviewed_task --> wait_accept

in_review
  -- claim_acceptance --> wait_accept  # Manager directly performs the review

wait_accept
  -- claim_acceptance --> wait_accept
  -- accept_task --> accepted
```

`claim_review`, and `claim_acceptance` when the Task is already `wait_accept`, acquire exclusive rights without changing the Task status. `claim_acceptance` on `in_review` is the one exception: it records that the Manager directly performed the review and moves the Task to `wait_accept` atomically with Claim acquisition.

### 4.2 Rejection

Both review rejection and acceptance rejection use the same command.

```text
in_review
  -- reject_task --> rejected

wait_accept
  -- reject_task --> rejected
```

The originating status is recorded in the Change Log, so review rejection and acceptance rejection remain distinguishable without separate commands.

```json
{
  "type": "TASK_REJECTED",
  "fromStatus": "wait_accept",
  "reason": "AC-3 is not satisfied"
}
```

There is no `reject_acceptance` command.

### 4.3 Cancellation

The existing cancellation transitions are retained.

```text
todo
  -- cancel_task --> canceled

doing
  -- cancel_task --> canceled
```

Cancellation is a Manager administration operation and does not require an Acceptance Claim.

If `cancel_task` cancels a `doing` Task with an active work Claim, the same transaction must complete that Claim as `released` with a cancellation reason. The old `claimId` must be unable to mutate the canceled Task.

## 5. Principal, Role, and authorization

### 5.1 Principal

A Principal is the authenticated actor that performs an operation.

Examples:

- human manager
- Console-backed agent
- Ralph worker agent
- Ralph reviewer agent
- manager or acceptance agent
- external orchestrator service account

The MCP tool input must not accept a caller-supplied `principalId` as identity.

The initial implementation operates in a trusted local environment and accepts an Agent Name directly as the Principal identity.

```http
Authorization: Bearer <AgentName>
```

The initial adapter uses the bearer value as `principalId` without verifying a secret. Agent Names and their Project grants are configured manually. Project Role authorization is still enforced from persisted grants; a Principal without the required grant receives `FORBIDDEN`.

This is caller-asserted identity, not a security boundary. A caller can impersonate another Agent Name. The server must not be exposed to an untrusted network in this mode. A later authentication adapter may replace this mechanism with API tokens, OIDC, service accounts, reverse-proxy signed headers, or another verified credential without changing the application model.

```ts
type AuthContext = {
  principalId: string;
};
```

### 5.2 Project grants

Roles are persisted per Principal and Project.

```text
project_grant
  project_id
  principal_id
  role
```

A Principal may hold multiple Roles in the same Project.

```text
project-A / console-agent / worker
project-A / console-agent / reviewer
project-A / console-agent / manager
```

The uniqueness constraint is:

```text
UNIQUE(project_id, principal_id, role)
```

### 5.3 Roles

Initial Roles are:

```ts
type ProjectRole = "worker" | "reviewer" | "manager";
```

`manager` and `acceptor` are not separate Roles. The Manager Role includes acceptance work.

A Role is not selected or switched during a session. There is no `select_role` or `set_current_role` operation.

Each request determines its required authorization from the command being called.

```text
claim_task / complete_task
  -> worker Role required

claim_review / reviewed_task
  -> reviewer Role required

claim_acceptance / accept_task
  -> manager Role required

reject_task
  -> reviewer Role when Task.status = in_review
  -> manager Role when Task.status = wait_accept
```

### 5.4 Capability mapping

Roles are persisted, while the application layer may expand them into capabilities for authorization.

```ts
const roleCapabilities = {
  worker: ["task:claim", "task:complete"],
  reviewer: ["review:claim", "task:review", "task:reject"],
  manager: [
    "task:create",
    "task:update",
    "task:cancel",
    "acceptance:claim",
    "task:accept",
    "task:reject",
  ],
};
```

Do not persist fine-grained capabilities in the first implementation unless an implementation constraint requires it.

## 6. Task Claim

A Task Claim is an expiring, exclusive right to operate on one Task in its current workflow state.

It is not an assignee label, an MCP session, an Agent Run, or proof that an agent process is healthy.

### 6.1 Data model

```text
task_claim
  id                 opaque UUID / claimId
  task_id
  principal_id
  state              active | completed | released | expired
  acquired_at
  renewed_at nullable
  expires_at
  released_at nullable
  release_reason nullable
```

The Claim does not store a `phase` field.

The meaning of a Claim is determined by:

1. the Task status at claim acquisition;
2. the claim command used;
3. the guarded mutation that later consumes the Claim.

### 6.2 Claim commands and eligible statuses

```text
claim_task
  allowed when Task.status is todo or rejected
  changes Task.status to doing
  requires worker Role

claim_review
  allowed when Task.status is in_review
  leaves Task.status as in_review
  requires reviewer Role

claim_acceptance
  allowed when Task.status is in_review or wait_accept
  changes in_review to wait_accept when the Manager directly performs the review
  leaves wait_accept as wait_accept
  requires manager Role
```

### 6.3 Exclusivity

Only one active Claim may exist for a Task at a time.

The first implementation must enforce exclusivity atomically in the database. A read followed by an unguarded insert is insufficient.

A successful reacquisition always creates a new `claimId`. An old Claim must never be revived.

### 6.4 Fencing

Every claim-bound mutation must verify, in the same transaction:

- the Claim exists;
- the Claim is active;
- the Claim is not expired;
- the Claim belongs to the authenticated Principal;
- the Claim belongs to the target Task;
- the Task is in the status required by the command;
- the Claim is still the current active Claim for the Task.

A stale agent that later resumes with an old `claimId` must be rejected.

### 6.5 Claim renewal

```text
renew_claim(claimId)
```

`renew_claim` extends `expires_at` within server-defined limits.

This operation means:

> the Principal intends to keep the Task Claim

It does not mean:

> the agent process is healthy or making progress

There is no agent-wide heartbeat API in Wacha Core.

An expired Claim cannot be renewed. The caller must acquire a new Claim if the Task is eligible again.

### 6.6 Release and expiry

```text
release_claim(claimId, reason, requestId)
```

Release returns the Task to the appropriate unclaimed status. Expiry invalidates the Claim immediately by time comparison, but does not require an immediate persisted Task status rewrite.

Initial behavior:

```text
work Claim released
  doing -> todo

work Claim expired
  persisted Task status may temporarily remain doing
  availableFor=work treats the Task as reclaimable

review Claim released or expired
  in_review -> in_review

acceptance Claim released or expired
  wait_accept -> wait_accept
```

If the Task entered `doing` from `rejected`, the first implementation may still return it to `todo`; preserving a pre-claim status may be added later if required. This is an implementation detail, not a reason to add a Claim phase.

When a new `claim_task` reclaims a `doing` Task whose current Claim has expired, one database transaction must:

1. verify that the old Claim is expired;
2. mark the old Claim as `expired`;
3. logically recover the Task to `todo`;
4. create a new active Claim;
5. move the Task to `doing` under the new Claim;
6. append the required Change Log entries.

The intermediate `todo` state does not need to be externally visible. A stale `claimId` is fenced out after the transaction. A maintenance scheduler may normalize an expired, unreclaimed `doing` Task to persisted `todo`, but correctness and reacquisition must not depend on that scheduler.

### 6.7 Claim history retention

Claim history is not deleted in the initial implementation.

The system is expected to change during early development, and maintainers will need historical Claim data for debugging and design validation.

Do not implement deletion or archival yet. Do not interpret this as a permanent product guarantee; retention policy may be introduced after observing actual volume and operational needs.

## 7. Task list contract

There is no separate `list_claimable_tasks` tool.

The existing `list_tasks` tool is extended with filters.

### 7.1 Input

```ts
type TaskAvailability = "work" | "review" | "acceptance";

type ListTasksInput = {
  projectId: string;
  filter?: {
    status?: TaskStatus[];
    availableFor?: TaskAvailability;
    storyId?: string;
  };
  limit?: number;
};
```

### 7.2 Filter rules

`status` and `availableFor` are mutually exclusive.

A request containing both must fail with a structured validation error.

```text
INVALID_FILTER_COMBINATION
```

Reason:

- `status` filters persisted Task state;
- `availableFor` computes whether the authenticated Principal can claim the Task now.

They represent different query intents and combining them creates ambiguous or contradictory requests.

### 7.3 `status` behavior

Example:

```json
{
  "projectId": "project-1",
  "filter": {
    "status": ["todo", "rejected"]
  }
}
```

This only filters persisted status values. It does not guarantee that the returned Tasks are claimable.

### 7.4 `availableFor` behavior

#### Work

```json
{
  "projectId": "project-1",
  "filter": {
    "availableFor": "work"
  }
}
```

A Task is available for work when all required conditions are true, including:

- Principal has worker Role for the Project;
- Task status is `todo` or `rejected` and no active unexpired Claim exists; or
- Task status is `doing` and its current work Claim is expired;
- Project policy allows the operation.

Task-to-Task dependencies are not part of the first implementation.

The `status` filter continues to report persisted Task state. Therefore, a Task with an expired work Claim may still appear as `doing` in a status-based query while also appearing in `availableFor=work`. This is intentional: `status` reports stored workflow state, while `availableFor` reports whether the Principal can successfully claim the Task now.

#### Review

A Task is available for review when all required conditions are true, including:

- Principal has reviewer Role;
- Task status is `in_review`;
- no active unexpired Claim exists;
- self-review policy allows the Principal.

#### Acceptance

A Task is available for acceptance when all required conditions are true, including:

- Principal has manager Role;
- Task status is `in_review` or `wait_accept`;
- no active unexpired Claim exists;
- self-acceptance policy allows the Principal;
- Project policy allows the operation.

When the Manager selects an `in_review` Task, successful `claim_acceptance` moves it to `wait_accept`. This preserves the lower-cost human direct-review path without making Review Claims and Acceptance Claims ambiguous on the same Task status.

### 7.5 Ordering

The initial default ordering is:

```text
parent Story sortOrder ASC
  -> Task sortOrder ASC
  -> createdAt ASC
```

For a standalone Task, its own `sortOrder` is used on the same primary axis as a parent Story's `sortOrder`, then as the Task-level ordering key.

Ordering is only a presentation hint. It is not an instruction that the agent must claim the first Task.

The agent remains responsible for choosing a Task after considering specifications, code, priority, comments, and other relevant facts.

## 8. MCP tool contract

The first implementation should expose the following conceptual tools. Exact TypeScript names and input wrappers may follow current repository conventions, but behavior must match this specification.

### 8.1 Read

```text
list_projects()
list_stories(projectId, ...)
list_tasks(ListTasksInput)
list_task_comments(taskId)
list_changes(projectId, afterCursor?, limit?)
```

### 8.2 Claim

```text
claim_task(taskId, requestId)
claim_review(taskId, requestId)
claim_acceptance(taskId, requestId)
renew_claim(claimId)
release_claim(claimId, reason, requestId)
```

### 8.3 Worker

```text
add_task_comment(taskId, claimId, body, requestId)
complete_task(taskId, claimId, requestId)
```

`complete_task` transitions `doing -> in_review` and completes the active Claim.

`add_task_comment` requires the current active Claim. The authenticated Principal is recorded as the author, and the Claim records the work context in which the comment was added. A Principal without the current Claim cannot add a Task Comment.

### 8.4 Reviewer

```text
reviewed_task(taskId, claimId, requestId)
reject_task(taskId, claimId, reason, requestId)
```

`reviewed_task` is retained as the command name and transitions `in_review -> wait_accept`.

### 8.5 Manager

```text
claim_acceptance(taskId, requestId)
accept_task(taskId, claimId, requestId)
reject_task(taskId, claimId, reason, requestId)
```

`accept_task` verifies Acceptance Criteria and transitions `wait_accept -> accepted`.

To directly review and accept an `in_review` Task, a Manager first calls `claim_acceptance`. That operation moves the Task to `wait_accept` and returns the Acceptance Claim used by `accept_task` or `reject_task`.

A Manager may be a human or an authenticated agent. Wacha must not assume acceptance is always performed manually.

Manager Project administration operations such as Task creation, update, cancellation, and priority changes do not require a Task Claim.

### 8.6 Idempotency

All state-changing commands except `renew_claim` should accept `requestId` unless an existing repository convention provides an equivalent mechanism.

The idempotency key is:

```text
(principalId, toolName, requestId)
```

A retry with the same key and same input returns the original result. Reusing the key with different input fails with a conflict.

## 9. Self-review and self-acceptance policy

A Principal may hold both worker and reviewer Roles in the same Project.

This does not automatically permit self-review.

The first implementation prohibits self-review. `claim_review` must reject a Principal that is the same as the Principal that most recently completed the Task through `complete_task`.

```text
SELF_REVIEW_NOT_ALLOWED
```

Role difference is not sufficient. Compare Principal IDs.

The first implementation also prohibits self-acceptance. `claim_acceptance` must reject a Principal that is the same as the Principal that most recently completed the Task through `complete_task`.

```text
SELF_ACCEPTANCE_NOT_ALLOWED
```

For Ralph-style automation, separate worker and reviewer Principals and credentials are recommended even when they use the same model or executable.

For Console use, one Principal may hold multiple Roles and perform different operations on different Tasks.

## 10. Change Log

Wacha records important domain state changes in an append-only Change Log transactionally with the state change.

```text
change_log
  cursor
  project_id
  type
  entity_id
  principal_id
  claim_id nullable
  payload
  occurred_at
```

Initial event types include:

```text
TASK_CREATED
TASK_CLAIMED
CLAIM_RELEASED
CLAIM_EXPIRED
TASK_COMPLETED
TASK_REVIEWED
TASK_ACCEPTED
TASK_REJECTED
```

`TASK_CLAIMED` records the claim command and status transition in its payload. A direct Manager review is therefore distinguishable without storing a Claim phase.

```json
{
  "type": "TASK_CLAIMED",
  "claimCommand": "claim_acceptance",
  "fromStatus": "in_review",
  "toStatus": "wait_accept",
  "path": "manager_direct_review"
}
```

Do not append a Change Log entry for every `renew_claim` call. Renewal updates the Claim record's `renewed_at` and `expires_at` values.

Change Log entries are not deleted in the initial implementation. As with Claim history, this is an initial operational policy rather than a permanent storage guarantee.

## 11. External memory classification

Externalized memory is divided into three layers.

### 11.1 Wacha: work state and handoff memory

Store information required to coordinate ongoing work:

- Story and Task backlog
- status and priority
- Claim ownership and history
- comments and handoff notes
- rejection reasons
- acceptance outcomes
- newly discovered work
- Change Log

Do not store full model chain-of-thought or every tool operation.

### 11.2 Project repository: project-specific durable knowledge

Store decisions and facts that future work on the Project must preserve:

- ADRs
- specifications
- architecture and domain rules
- API and database contracts
- tests
- project `AGENTS.md`
- operational instructions
- source code and Git history

A working observation in Wacha should be promoted to the Project repository when it becomes an accepted project-specific decision.

### 11.3 Common repository: reusable development knowledge

Store generalized knowledge that applies across Projects:

- Skills
- Rules and Hooks
- reusable review checks
- testing strategies
- common failure patterns
- security checks
- implementation templates
- common `AGENTS.md` guidance
- harness components

Knowledge flows upward by refinement:

```text
Wacha observation
  -> Project-specific accepted decision
  -> Project repository
  -> generalized reusable knowledge
  -> Common repository
```

Do not copy identical content indefinitely across all three locations. Preserve the appropriate authoritative form and link to it from Wacha when useful.

## 12. Ralph Loop compatibility

A Ralph worker loop should behave conceptually as follows:

```text
1. start with a fresh agent context
2. read Project and Task facts through Wacha
3. inspect repository specifications and code
4. call list_tasks with availableFor = work
5. independently choose the most appropriate Task
6. call claim_task for that Task
7. on CLAIM_CONFLICT, choose another candidate
8. implement and validate exactly one Task
9. externalize discoveries as Task updates, comments, new Tasks, code, tests, ADRs, or common knowledge as appropriate
10. call complete_task or release_claim
11. terminate the iteration
```

Review and acceptance loops follow the same pattern using `availableFor = review` or `availableFor = acceptance` and their corresponding claim and completion commands.

Wacha must not replace the agent's judgment with a queue-style next-task selector.

## 13. Required error semantics

At minimum, implementations must distinguish:

```text
CLAIM_CONFLICT
  another active Claim won the race; the agent may choose another Task

CLAIM_NOT_FOUND
  the supplied Claim does not exist

CLAIM_NOT_OWNED
  the Claim belongs to another Principal

CLAIM_EXPIRED
  the Claim is no longer valid and cannot be revived

TASK_NOT_CLAIMABLE
  current Task state or policy prevents acquisition

INVALID_INPUT
  a required value is empty or references an entity outside the requested Project

INVALID_TASK_STATUS
  the command is not valid for the current Task status

FORBIDDEN
  the authenticated Principal lacks the required Project Role

SELF_REVIEW_NOT_ALLOWED
  Project policy forbids this Principal from reviewing its own completed work

SELF_ACCEPTANCE_NOT_ALLOWED
  Project policy forbids this Principal from accepting its own completed work

INVALID_FILTER_COMBINATION
  list_tasks contains both status and availableFor

IDEMPOTENCY_CONFLICT
  a requestId was reused with different input
```

Errors must be structured so an agent can distinguish retryable contention from permanent authorization or validation failures.

## 14. Transactional invariants

The implementation must preserve the following invariants:

1. at most one active, unexpired Claim exists per Task;
2. claim acquisition and any associated Task status transition are atomic;
3. claim-bound state transitions validate the Claim and update Task, Claim, and Change Log atomically;
4. expiry correctness does not depend on a background scheduler;
5. any query or mutation treats `expires_at <= now` as expired even if the persisted `state` has not yet been rewritten to `expired`;
6. a scheduler may normalize expired states for display or maintenance, but it is only an optimization;
7. an old `claimId` can never mutate a Task after a newer Claim has been acquired;
8. Task ownership is derived from the active Claim, not from `task.assignee = sessionId`.
9. `availableFor=work` treats a `doing` Task with an expired work Claim as reclaimable;
10. reclaiming an expired work Claim expires the old Claim and creates the new Claim atomically.
11. `claim_acceptance` on `in_review` creates the Acceptance Claim, moves the Task to `wait_accept`, and appends the direct-review Change Log entry atomically.

## 15. Explicit non-goals for the first implementation

Do not add the following as part of this specification:

- `claim_next_task`
- `claim_next_review`
- `list_claimable_tasks`
- Claim `phase`
- separate `acceptor` Role
- `reject_acceptance`
- agent-wide heartbeat or online status
- session-scoped current Role
- Wacha-managed Agent Run or Run Handle
- automatic Claim or Change Log deletion
- Wacha-owned task prioritization policy beyond deterministic result ordering
- Task-to-Task dependency modeling or dependency-based availability

## 16. Implementation sequence

Codex should implement in this order unless repository constraints require a safer dependency order:

1. introduce Principal and Project Role grants independent of MCP session state;
2. add Claim persistence and atomic exclusivity;
3. replace assignee/session ownership checks with Claim guards;
4. retain the existing six Task statuses and implement guarded transitions;
5. extend `list_tasks` with the mutually exclusive `status` and `availableFor` filters;
6. add worker, review, and acceptance Claim commands;
7. retain `reviewed_task`, add `accept_task`, and unify rejection under `reject_task`;
8. add Claim renewal and expiry handling without an agent heartbeat model;
9. record important state transitions in the Change Log;
10. migrate MCP handlers to request-scoped authentication and authorization;
11. update tests to cover contention, expiry, fencing, multiple Roles, self-review and self-acceptance policy, idempotency, and filter validation.

When existing code conflicts with this specification, do not silently preserve legacy session semantics. Record the conflict and modify the implementation toward this document unless another accepted design explicitly supersedes it.
