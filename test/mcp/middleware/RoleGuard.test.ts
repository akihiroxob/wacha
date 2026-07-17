import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { withRoleGuard } from "@mcp/middleware/RoleGuard.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteProjectMembershipRepository } from "@repository/SQLiteProjectMembershipRepository.ts";

const projectRepository = new SQLiteProjectRepository();
const membershipRepository = new SQLiteProjectMembershipRepository();

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task_comment").execute();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_membership").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("withRoleGuard allows worker sessions to run worker-only tools", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  await membershipRepository.create(project.id, "worker-session", ProjectRole.WORKER);

  const guarded = withRoleGuard(
    [ProjectRole.WORKER],
    { sessionId: "worker-session" },
    async () => "executed",
  );

  assert.equal(await guarded({}), "executed");
});

test("withRoleGuard rejects manager sessions for worker-only tools like claim_task / complete_task", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  await membershipRepository.create(project.id, "manager-session", ProjectRole.MANAGER);

  const guarded = withRoleGuard(
    [ProjectRole.WORKER],
    { sessionId: "manager-session" },
    async () => "executed",
  );

  await assert.rejects(() => guarded({}), /Forbidden: Agent does not have required role/);
});

test("withRoleGuard rejects reviewer sessions for worker-only tools", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  await membershipRepository.create(project.id, "reviewer-session", ProjectRole.REVIEWER);

  const guarded = withRoleGuard(
    [ProjectRole.WORKER],
    { sessionId: "reviewer-session" },
    async () => "executed",
  );

  await assert.rejects(() => guarded({}), /Forbidden: Agent does not have required role/);
});
