# Review Policy

## Positioning

Review is a first-class workflow in Wacha.

It is already encoded in TaskStatus transitions:

- `in_review`
- `wait_accept`
- `accepted`
- `rejected` fileciteturn14file0L3-L7

## Roles in Review

- worker: produces implementation
- reviewer: validates implementation
- manager: final acceptance

This is enforced in MCP tools via role guard fileciteturn6file0L55-L66

## Review Stages

### Stage 1: Worker

- moves task to `in_review`

### Stage 2: Reviewer

- validates implementation
- moves to `wait_accept` or `rejected`

### Stage 3: Manager

- decides final `accepted` or `rejected`

## Review Criteria

### Correctness

- does it meet task intent?

### Safety

- does it break existing behavior?

### Completeness

- are all acceptance criteria covered?

### Clarity

- is code understandable?

## Reject Rule

Reject must include:

- what is wrong
- why it matters
- what to fix

## Anti-Patterns

- approving incomplete work
- reviewer doing full implementation
- manager skipping review stage

## Feedback Loop

Important:

```txt
Review → Skill improvement
```

Repeated issues should update Skill definitions.

## Final Principle

Review is not optional.

A task is complete only after acceptance.
