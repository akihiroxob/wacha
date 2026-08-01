import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { ListProjectGrantsUseCase } from "@application/usecase/grants/ListProjectGrantsUseCase.ts";
import { SQLiteProjectGrantRepository } from "@repository/SQLiteProjectGrantRepository.ts";

const repository = new SQLiteProjectGrantRepository();
const useCase = new ListProjectGrantsUseCase(repository);

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
