import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { InstructionService } from "@application/service/InstructionService.ts";

test("InstructionService can get manager instruction", async () => {
  const instructionService = new InstructionService();
  const content = await instructionService.getInstructionContent(ProjectRole.MANAGER);
  assert.ok(content.includes("Manager Role"));
  assert.ok(content.includes("Story は SMART を使って整理する。"));
  assert.ok(content.includes("Task の完了条件は Gherkin 形式で書く。"));
});

test("InstructionService can get reviewer instruction", async () => {
  const instructionService = new InstructionService();
  const content = await instructionService.getInstructionContent(ProjectRole.REVIEWER);
  assert.ok(content.includes("Reviewer Role"));
  assert.ok(content.includes("`reviewed_task`"));
  assert.ok(content.includes("`wait_accept`"));
});

test("InstructionService can get worker instruction", async () => {
  const instructionService = new InstructionService();
  const content = await instructionService.getInstructionContent(ProjectRole.WORKER);
  assert.ok(content.includes("Worker Role"));
  assert.ok(content.includes("同時に着手する Task は 1 つに絞る"));
  assert.ok(content.includes("TDD を基本フローとして進める"));
  assert.ok(content.includes("`rejected` は特定 worker に固定されない"));
});

test("InstructionService can get role-policy instruction", async () => {
  const instructionService = new InstructionService();
  const content = await instructionService.getInstructionContent("role-policy");
  assert.ok(content.includes("Role Policy"));
});
