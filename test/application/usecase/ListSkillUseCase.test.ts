import test from "node:test";
import assert from "node:assert/strict";

import { ListSkillUseCase } from "@application/usecase/skills/ListSkillUseCase.ts";
import { Skill } from "@domain/model/Skill.ts";
import { SkillRepository } from "@domain/repository/SkillRepository.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";

class InMemorySkillRepository implements SkillRepository {
  constructor(private readonly skills: Skill[]) {}

  async list(): Promise<Skill[]> {
    return this.skills;
  }

  async findByName(name: string): Promise<Skill | undefined> {
    return this.skills.find((skill) => skill.name === name);
  }
}

test("ListSkillUseCase returns skills sorted by name", async () => {
  const useCase = new ListSkillUseCase(
    new InMemorySkillRepository([
      new Skill("review-task", "Review task", [ProjectRole.REVIEWER], [], [], "review"),
      new Skill("decompose-story", "Decompose story", [ProjectRole.MANAGER], [], [], "story"),
      new Skill("implement-task", "Implement task", [ProjectRole.WORKER], [], [], "implement"),
    ]),
  );

  const result = await useCase.execute();

  assert.deepEqual(
    result.skills.map((skill) => skill.name),
    ["decompose-story", "implement-task", "review-task"],
  );
});
