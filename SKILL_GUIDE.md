# Skill Guide

## Positioning

Skill is a reusable execution pattern for agents.

It complements existing role instructions.

```txt
Role = who is responsible
Task = what to do
Skill = how to do it
Tool = executable action
```

## Why Skill is Needed

Current system:

- role instructions exist (`agent/*.md`)
- tasks exist
- tools exist

Missing:

- reusable execution patterns across tasks

## Skill Definition

A Skill must define:

- clear input
- clear output
- repeatable steps
- success criteria

## Example Skill

### Task Implementation Skill

```txt
input:
  - Task description

steps:
  1. read task
  2. identify files
  3. write failing test (if possible)
  4. implement
  5. validate

successCriteria:
  - task acceptance criteria satisfied
  - no regression
```

## Skill Lifecycle

1. discovered during repeated work
2. documented
3. reused
4. improved via review feedback

## Skill → MCP Tool Evolution (重要)

Once stable, a Skill can become an MCP Tool.

Example:

```txt
Skill: run tests
→ MCP Tool: run_tests

Skill: apply patch
→ MCP Tool: apply_patch

Skill: create task from story
→ MCP Tool: decompose_story
```

## Design Rule

- Skill is descriptive
- Tool is executable

Do not mix them.

## Storage

Future:

- store skill in DB or artifact
- version skill
- allow agent to propose skill updates

## Warning

Bad Skill:

- vague
- too big
- not reusable

Good Skill:

- small
- repeatable
- measurable
