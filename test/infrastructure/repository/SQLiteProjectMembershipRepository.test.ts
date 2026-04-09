import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectMembershipRepository } from "@repository/SQLiteProjectMembershipRepository.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";

const projectRepository = new SQLiteProjectRepository();
const repository = new SQLiteProjectMembershipRepository();

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_membership").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("SQLiteProjectMembershipRepository.create persists membership", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");

  const membership = await repository.create(project.id, "worker-1", ProjectRole.MANAGER);

  const memberships = await repository.findByProjectId(project.id);

  assert.equal(memberships.length, 1);
  assert.equal(memberships[0]?.id, membership.id);
  assert.equal(memberships[0]?.workerId, "worker-1");
});

test("SQLiteProjectMembershipRepository.findByProjectIdAndWorkerId filters memberships", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  await repository.create(project.id, "worker-1", ProjectRole.MANAGER);
  await repository.create(project.id, "worker-1", ProjectRole.WORKER);
  await repository.create(project.id, "worker-2", ProjectRole.WORKER);

  const memberships = await repository.findByProjectIdAndWorkerId(project.id, "worker-1");

  assert.equal(memberships.length, 2);
});

test("SQLiteProjectMembershipRepository.deleteByWorkerId removes all memberships for worker", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  await repository.create(project.id, "worker-1", ProjectRole.MANAGER);
  await repository.create(project.id, "worker-1", ProjectRole.WORKER);
  await repository.create(project.id, "worker-2", ProjectRole.WORKER);

  await repository.deleteByWorkerId("worker-1");

  const worker1Memberships = await repository.findByWorkerId("worker-1");
  const worker2Memberships = await repository.findByWorkerId("worker-2");

  assert.equal(worker1Memberships.length, 0);
  assert.equal(worker2Memberships.length, 1);
});

test("SQLiteProjectMembershipRepository.save updates heartbeat", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const membership = await repository.create(project.id, "worker-1", ProjectRole.MANAGER);

  membership.heartbeat(2000);
  await repository.save(membership);

  const saved = await repository.findByProjectIdWorkerIdAndRole(
    project.id,
    "worker-1",
    ProjectRole.MANAGER,
  );
  assert.equal(saved?.lastHeartbeatAt, 2000);
});
