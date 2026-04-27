import test from "node:test";
import assert from "node:assert/strict";

import { Skill } from "@domain/model/Skill.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { SkillStatus } from "@constants/SkillStatus.ts";
import { SkillRepository } from "@domain/repository/SkillRepository.ts";
import { KnowledgeRepository } from "@domain/repository/KnowledgeRepository.ts";
import { GetSkillContextUseCase } from "@application/usecase/skills/GetSkillContextUseCase.ts";

class InMemorySkillRepository implements SkillRepository {
  constructor(private readonly skills: Skill[]) {}

  async list(): Promise<Skill[]> {
    return this.skills;
  }

  async findByName(name: string): Promise<Skill | undefined> {
    return this.skills.find((skill) => skill.name === name);
  }
}

class InMemoryKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly entries: Record<string, string>) {}

  async getContent(path: string): Promise<string | undefined> {
    return this.entries[path];
  }
}

test("GetSkillContextUseCase returns a skill with resolved knowledge", async () => {
  const useCase = new GetSkillContextUseCase(
    new InMemorySkillRepository([
      new Skill(
        "implement-task",
        "Implement task",
        SkillStatus.ACTIVE,
        1,
        [ProjectRole.WORKER],
        ["tips/task-writing.md", "principles/development-principles.md"],
        ["complete_task"],
        "skill body",
      ),
    ]),
    new InMemoryKnowledgeRepository({
      "principles/development-principles.md": "development principles",
      "tips/task-writing.md": "task writing",
    }),
  );

  const result = await useCase.execute({ name: "implement-task" });

  assert.equal(result.skill.name, "implement-task");
  assert.deepEqual(result.knowledge, [
    {
      path: "principles/development-principles.md",
      content: "development principles",
    },
    {
      path: "tips/task-writing.md",
      content: "task writing",
    },
  ]);
});

test("GetSkillContextUseCase throws when skill is missing", async () => {
  const useCase = new GetSkillContextUseCase(
    new InMemorySkillRepository([]),
    new InMemoryKnowledgeRepository({}),
  );

  await assert.rejects(() => useCase.execute({ name: "missing-skill" }), /Skill not found/);
});

test("GetSkillContextUseCase throws when required knowledge is missing", async () => {
  const useCase = new GetSkillContextUseCase(
    new InMemorySkillRepository([
      new Skill(
        "implement-task",
        "Implement task",
        SkillStatus.ACTIVE,
        1,
        [ProjectRole.WORKER],
        ["tips/task-writing.md"],
        ["complete_task"],
        "skill body",
      ),
    ]),
    new InMemoryKnowledgeRepository({}),
  );

  await assert.rejects(
    () => useCase.execute({ name: "implement-task" }),
    /Knowledge not found: tips\/task-writing.md/,
  );
});
