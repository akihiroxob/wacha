import test from "node:test";
import assert from "node:assert/strict";

import { FileSkillRepository } from "@repository/FileSkillRepository.ts";
import { SkillStatus } from "@constants/SkillStatus.ts";
import { ProjectRole, type ProjectRole as ProjectRoleValue } from "@constants/ProjectRole.ts";

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
  assert.ok(typeof skill.version === "number");
  assert.deepEqual(skill.allowRoles, ["worker"]);
});

test("FileSkillRepository.findByName returns manager acceptance skill", async () => {
  const skill = await repository.findByName("accept-task");

  assert.ok(skill);
  assert.equal(skill.status, SkillStatus.ACTIVE);
  assert.deepEqual(skill.allowRoles, ["manager"]);
  assert.ok(skill.requiredKnowledge.includes("tips/acceptance.md"));
  assert.ok(skill.requiredTools.includes("claim_acceptance"));
  assert.ok(skill.requiredTools.includes("accept_task"));
  assert.ok(skill.requiredTools.includes("reject_task"));
});

test("active Skill requiredTools are available to every allowed Role", async () => {
  const common = [
    "list_projects",
    "list_stories",
    "list_tasks",
    "list_task_comments",
    "list_changes",
    "list_skills",
    "get_skill_context",
    "get_role_instructions",
    "issue_task",
    "renew_claim",
    "release_claim",
    "add_task_comment",
  ];
  const allowedTools: Record<ProjectRoleValue, Set<string>> = {
    [ProjectRole.MANAGER]: new Set([
      ...common,
      "issue_story",
      "edit_story",
      "complete_story",
      "cancel_story",
      "edit_task",
      "cancel_task",
      "claim_acceptance",
      "accept_task",
      "reject_task",
    ]),
    [ProjectRole.REVIEWER]: new Set([
      ...common,
      "claim_review",
      "reviewed_task",
      "reject_task",
    ]),
    [ProjectRole.WORKER]: new Set([...common, "claim_task", "complete_task"]),
  };

  const skills = await repository.list();
  for (const skill of skills.filter((candidate) => candidate.status === SkillStatus.ACTIVE)) {
    for (const role of skill.allowRoles) {
      for (const tool of skill.requiredTools) {
        assert.ok(
          allowedTools[role].has(tool),
          `${skill.name} requires ${tool}, which is unavailable to ${role}`,
        );
      }
    }
  }
});
