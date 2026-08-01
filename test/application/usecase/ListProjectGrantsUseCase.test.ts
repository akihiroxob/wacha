import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { ListProjectGrantsUseCase } from "@application/usecase/grants/ListProjectGrantsUseCase.ts";
import { GrantProjectRoleUseCase } from "@application/usecase/grants/GrantProjectRoleUseCase.ts";
import { RevokeProjectRoleUseCase } from "@application/usecase/grants/RevokeProjectRoleUseCase.ts";
import { SQLiteProjectGrantRepository } from "@repository/SQLiteProjectGrantRepository.ts";

const repository = new SQLiteProjectGrantRepository();
const useCase = new ListProjectGrantsUseCase(repository);
const grantUseCase = new GrantProjectRoleUseCase(repository);
const revokeUseCase = new RevokeProjectRoleUseCase(repository);

before(async () => initializeSchema());

beforeEach(async () => {
  await DatabaseClient.deleteFrom("command_receipt").execute();
  await DatabaseClient.deleteFrom("change_log").execute();
  await DatabaseClient.deleteFrom("task_comment").execute();
  await DatabaseClient.deleteFrom("task_claim").execute();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project_grant").execute();
  await DatabaseClient.deleteFrom("project").execute();
  await DatabaseClient.insertInto("project")
    .values({
      id: "project-1",
      name: "Project",
      description: null,
      basedir: "/tmp/project",
      created_at: 1,
      updated_at: 1,
    })
    .execute();
});

test("ListProjectGrantsUseCase lists durable Principal Role grants", async () => {
  await repository.grant("project-1", "agent-b", ProjectRole.WORKER);
  await repository.grant("project-1", "agent-a", ProjectRole.WORKER);
  await repository.grant("project-1", "agent-a", ProjectRole.MANAGER);

  const result = await useCase.execute("project-1");

  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.principals, 2);
  assert.deepEqual(
    result.grants.map(({ principalId, role }) => ({ principalId, role })),
    [
      { principalId: "agent-a", role: ProjectRole.MANAGER },
      { principalId: "agent-a", role: ProjectRole.WORKER },
      { principalId: "agent-b", role: ProjectRole.WORKER },
    ],
  );
});

test("GrantProjectRoleUseCase and RevokeProjectRoleUseCase manage a Project grant", async () => {
  await grantUseCase.execute("project-1", "agent-a", ProjectRole.REVIEWER);
  await grantUseCase.execute("project-1", "agent-a", ProjectRole.REVIEWER);

  assert.equal(await repository.hasRole("project-1", "agent-a", ProjectRole.REVIEWER), true);
  assert.equal((await repository.listByProjectId("project-1")).length, 1);

  await revokeUseCase.execute("project-1", "agent-a", ProjectRole.REVIEWER);

  assert.equal(await repository.hasRole("project-1", "agent-a", ProjectRole.REVIEWER), false);
});
