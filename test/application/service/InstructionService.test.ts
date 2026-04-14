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
});

test("InstructionService can get worker instruction", async () => {
  const instructionService = new InstructionService();
  const content = await instructionService.getInstructionContent(ProjectRole.WORKER);
  assert.ok(content.includes("Worker Role"));
});

test("InstructionService can get role-policy instruction", async () => {
  const instructionService = new InstructionService();
  const content = await instructionService.getInstructionContent("role-policy");
  assert.ok(content.includes("Role Policy"));
});
