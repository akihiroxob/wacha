import test from "node:test";
import assert from "node:assert/strict";

import { ListSkillUseCase } from "@application/usecase/skills/ListSkillUseCase.ts";
import { Skill } from "@domain/model/Skill.ts";
import { SkillRepository } from "@domain/repository/SkillRepository.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { SkillStatus } from "@constants/SkillStatus.ts";

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
      new Skill(
        "review-task",
        "Review task",
        SkillStatus.ACTIVE,
        1,
        [ProjectRole.REVIEWER],
        [],
        [],
        "review",
      ),
      new Skill(
        "decompose-story",
        "Decompose story",
        SkillStatus.ACTIVE,
        1,
        [ProjectRole.MANAGER],
        [],
        [],
        "story",
      ),
      new Skill(
        "implement-task",
        "Implement task",
        SkillStatus.DRAFT,
        2,
        [ProjectRole.WORKER],
        [],
        [],
        "implement",
      ),
    ]),
  );

  const result = await useCase.execute();

  assert.deepEqual(
    result.skills.map((skill) => skill.name),
    ["decompose-story", "implement-task", "review-task"],
  );
});

test("ListSkillUseCase filters skills by status and role", async () => {
  const useCase = new ListSkillUseCase(
    new InMemorySkillRepository([
      new Skill(
        "review-task",
        "Review task",
        SkillStatus.ACTIVE,
        1,
        [ProjectRole.REVIEWER, ProjectRole.MANAGER],
        [],
        [],
        "review",
      ),
      new Skill(
        "decompose-story",
        "Decompose story",
        SkillStatus.ACTIVE,
        1,
        [ProjectRole.MANAGER],
        [],
        [],
        "story",
      ),
      new Skill(
        "implement-task",
        "Implement task",
        SkillStatus.DEPRECATED,
        3,
        [ProjectRole.WORKER],
        [],
        [],
        "implement",
      ),
    ]),
  );

  const result = await useCase.execute({
    status: SkillStatus.ACTIVE,
    role: ProjectRole.MANAGER,
  });

  assert.deepEqual(
    result.skills.map((skill) => skill.name),
    ["decompose-story", "review-task"],
  );
});
