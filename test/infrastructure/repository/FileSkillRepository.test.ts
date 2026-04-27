import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { FileSkillRepository } from "@repository/FileSkillRepository.ts";

const repository = new FileSkillRepository();

test("FileSkillRepository.list returns all skills", async () => {
  const skills = await repository.list();
  console.log(skills);
  assert.ok(skills.length > 0);
});
