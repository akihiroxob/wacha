import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { SkillRepository } from "@repository/SkillRepository.ts";

const repository = new SkillRepository();

test("SkillRepository.list returns all skills", async () => {
  const skills = await repository.list();
  console.log(skills);
  assert.ok(skills.length > 0);
});
