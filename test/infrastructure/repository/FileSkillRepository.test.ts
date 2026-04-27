import test from "node:test";
import assert from "node:assert/strict";

import { FileSkillRepository } from "@repository/FileSkillRepository.ts";
import { SkillStatus } from "@constants/SkillStatus.ts";

const repository = new FileSkillRepository();

test("FileSkillRepository.list returns all skills", async () => {
  const skills = await repository.list();
  assert.ok(skills.length > 0);
  assert.ok(skills.every((skill) => typeof skill.version === "number"));
  assert.ok(skills.every((skill) => Object.values(SkillStatus).includes(skill.status)));
});

test("FileSkillRepository.findByName returns parsed skill metadata", async () => {
  const skill = await repository.findByName("implement-task");

  assert.ok(skill);
  assert.equal(skill.status, SkillStatus.ACTIVE);
  assert.equal(skill.version, 1);
  assert.deepEqual(skill.allowRoles, ["worker"]);
});
