import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { CoordinationError } from "@application/error/CoordinationError.ts";
import { TaskCoordinationService } from "@application/service/TaskCoordinationService.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectGrantRepository } from "@repository/SQLiteProjectGrantRepository.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";

const projectRepository = new SQLiteProjectRepository();
const taskRepository = new SQLiteTaskRepository();
const grantRepository = new SQLiteProjectGrantRepository();

let now = 1_000;
let service = new TaskCoordinationService(() => now, 1_000);

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("change_log").execute();
  await DatabaseClient.deleteFrom("command_receipt").execute();
  await DatabaseClient.deleteFrom("task_comment").execute();
  await DatabaseClient.deleteFrom("task_claim").execute();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_grant").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
  now = 1_000;
  service = new TaskCoordinationService(() => now, 1_000);
});

const createProjectTask = async () => {
  const project = await projectRepository.create("Coordination", null, "repo/coordination");
  const task = await taskRepository.create("Task A", null, project.id);
  return { project, task };
};

const grant = (projectId: string, principalId: string, role: ProjectRole) =>
  grantRepository.grant(projectId, principalId, role);

const hasCode = (code: string) => (error: unknown) =>
  error instanceof CoordinationError && error.code === code;

test("worker, reviewer, and manager complete the guarded Claim lifecycle", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await grant(project.id, "reviewer-a", ProjectRole.REVIEWER);
  await grant(project.id, "manager-a", ProjectRole.MANAGER);

  const available = await service.listTasks("worker-a", project.id, { availableFor: "work" });
  assert.deepEqual(available.tasks.map((candidate) => candidate.id), [task.id]);

  const workClaim = await service.claimTask("worker-a", task.id, "claim-work");
  await service.addTaskComment(
    "worker-a",
    task.id,
    workClaim.claimId,
    "Implemented and tested",
    "comment-work",
  );
  await service.completeTask("worker-a", task.id, workClaim.claimId, "complete-work");

  const reviewClaim = await service.claimReview("reviewer-a", task.id, "claim-review");
  await service.reviewedTask("reviewer-a", task.id, reviewClaim.claimId, "review-task");

  const acceptanceClaim = await service.claimAcceptance(
    "manager-a",
    task.id,
    "claim-acceptance",
  );
  const accepted = await service.acceptTask(
    "manager-a",
    task.id,
    acceptanceClaim.claimId,
    "accept-task",
  );
  assert.equal(accepted.status, TaskStatus.ACCEPTED);

  const saved = await taskRepository.findById(task.id);
  assert.equal(saved?.status, TaskStatus.ACCEPTED);
  const comments = await service.listTaskComments("manager-a", task.id);
  assert.equal(comments.comments[0]?.principalId, "worker-a");
  assert.equal(comments.comments[0]?.claimId, workClaim.claimId);

  const changes = await service.listChanges("manager-a", project.id);
  assert.deepEqual(
    changes.changes.map((change) => change.type),
    ["TASK_CLAIMED", "TASK_COMPLETED", "TASK_CLAIMED", "TASK_REVIEWED", "TASK_CLAIMED", "TASK_ACCEPTED"],
  );
});

test("expired doing Claim is available for work and is atomically replaced", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await grant(project.id, "worker-b", ProjectRole.WORKER);

  const first = await service.claimTask("worker-a", task.id, "first-claim");
  now = first.expiresAt + 1;

  const available = await service.listTasks("worker-b", project.id, { availableFor: "work" });
  assert.equal(available.tasks[0]?.status, TaskStatus.DOING);
  assert.equal(available.tasks[0]?.reclaimable, true);

  const second = await service.claimTask("worker-b", task.id, "second-claim");
  assert.notEqual(second.claimId, first.claimId);
  const oldClaim = await DatabaseClient.selectFrom("task_claim")
    .selectAll()
    .where("id", "=", first.claimId)
    .executeTakeFirstOrThrow();
  assert.equal(oldClaim.state, "expired");
  await assert.rejects(
    () => service.renewClaim("worker-a", first.claimId),
    hasCode("CLAIM_EXPIRED"),
  );
});

test("renew_claim extends only the owned Task Claim lease", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await grant(project.id, "worker-b", ProjectRole.WORKER);
  const claim = await service.claimTask("worker-a", task.id, "claim");

  now = 1_500;
  const renewed = await service.renewClaim("worker-a", claim.claimId);
  assert.equal(renewed.expiresAt, 2_500);
  await assert.rejects(
    () => service.renewClaim("worker-b", claim.claimId),
    hasCode("CLAIM_NOT_OWNED"),
  );

  now = claim.expiresAt + 1;
  await service.addTaskComment("worker-a", task.id, claim.claimId, "still working", "comment");
});

test("claim conflict is structured and idempotent retry returns the original Claim", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await grant(project.id, "worker-b", ProjectRole.WORKER);

  const first = await service.claimTask("worker-a", task.id, "same-request");
  const retry = await service.claimTask("worker-a", task.id, "same-request");
  assert.equal(retry.claimId, first.claimId);
  await assert.rejects(
    () => service.claimTask("worker-b", task.id, "other-request"),
    hasCode("CLAIM_CONFLICT"),
  );
});

test("concurrent work Claims produce one winner and one structured conflict", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await grant(project.id, "worker-b", ProjectRole.WORKER);

  const results = await Promise.allSettled([
    service.claimTask("worker-a", task.id, "race-a"),
    service.claimTask("worker-b", task.id, "race-b"),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(hasCode("CLAIM_CONFLICT")((rejected[0] as PromiseRejectedResult).reason));
  assert.equal(
    await DatabaseClient.selectFrom("task_claim")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("task_id", "=", task.id)
      .where("state", "=", "active")
      .executeTakeFirstOrThrow()
      .then((row) => Number(row.count)),
    1,
  );
});

test("requestId cannot be reused with different input", async () => {
  const { project, task } = await createProjectTask();
  const another = await taskRepository.create("Task B", null, project.id);
  await grant(project.id, "worker-a", ProjectRole.WORKER);

  await service.claimTask("worker-a", task.id, "reused-request");
  await assert.rejects(
    () => service.claimTask("worker-a", another.id, "reused-request"),
    hasCode("IDEMPOTENCY_CONFLICT"),
  );
});

test("idempotency compares object input independent of key order", async () => {
  const project = await projectRepository.create("Coordination", null, "repo/coordination");
  await grant(project.id, "manager-a", ProjectRole.MANAGER);

  const first = await service.issueStory(
    "manager-a",
    { projectId: project.id, title: "Story", description: "Description" },
    "same-story-request",
  );
  const retry = await service.issueStory(
    "manager-a",
    { description: "Description", title: "Story", projectId: project.id },
    "same-story-request",
  );

  assert.equal(retry.id, first.id);
});

test("released work Claim returns the Task to todo and fences the old Claim", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);

  const claim = await service.claimTask("worker-a", task.id, "claim");
  const released = await service.releaseClaim(
    "worker-a",
    claim.claimId,
    "pairing session ended",
    "release",
  );

  assert.equal(released.taskStatus, TaskStatus.TODO);
  assert.equal((await taskRepository.findById(task.id))?.status, TaskStatus.TODO);
  await assert.rejects(
    () => service.addTaskComment("worker-a", task.id, claim.claimId, "late", "late-comment"),
    hasCode("CLAIM_EXPIRED"),
  );
});

test("Manager cancellation releases and fences an active work Claim", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await grant(project.id, "manager-a", ProjectRole.MANAGER);
  const claim = await service.claimTask("worker-a", task.id, "claim");

  await service.cancelTask("manager-a", task.id, "no longer needed", "cancel");

  assert.equal((await taskRepository.findById(task.id))?.status, TaskStatus.CANCELED);
  await assert.rejects(
    () => service.addTaskComment("worker-a", task.id, claim.claimId, "late", "late-comment"),
    hasCode("CLAIM_EXPIRED"),
  );
});

test("self-review and self-acceptance compare Principal IDs", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "multi-role", ProjectRole.WORKER);
  await grant(project.id, "multi-role", ProjectRole.REVIEWER);
  await grant(project.id, "multi-role", ProjectRole.MANAGER);

  const claim = await service.claimTask("multi-role", task.id, "work");
  await service.addTaskComment("multi-role", task.id, claim.claimId, "verified", "comment");
  await service.completeTask("multi-role", task.id, claim.claimId, "complete");

  const reviewCandidates = await service.listTasks("multi-role", project.id, {
    availableFor: "review",
  });
  assert.deepEqual(reviewCandidates.tasks.map((candidate) => candidate.id), [task.id]);

  await assert.rejects(
    () => service.claimReview("multi-role", task.id, "review"),
    hasCode("SELF_REVIEW_NOT_ALLOWED"),
  );
  await assert.rejects(
    () => service.claimAcceptance("multi-role", task.id, "acceptance"),
    hasCode("SELF_ACCEPTANCE_NOT_ALLOWED"),
  );
});

test("Manager direct review moves in_review to wait_accept when acceptance is claimed", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await grant(project.id, "manager-a", ProjectRole.MANAGER);

  const work = await service.claimTask("worker-a", task.id, "work");
  await service.addTaskComment("worker-a", task.id, work.claimId, "verified", "comment");
  await service.completeTask("worker-a", task.id, work.claimId, "complete");

  const acceptance = await service.claimAcceptance("manager-a", task.id, "direct-review");
  assert.equal(acceptance.taskStatus, TaskStatus.WAIT_ACCEPT);
  assert.equal((await taskRepository.findById(task.id))?.status, TaskStatus.WAIT_ACCEPT);

  const changes = await service.listChanges("manager-a", project.id);
  const claimed = changes.changes.at(-1);
  assert.equal(claimed?.payload.path, "manager_direct_review");
});

test("Task Comment requires the current owned Claim", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await grant(project.id, "worker-b", ProjectRole.WORKER);
  const claim = await service.claimTask("worker-a", task.id, "work");

  await assert.rejects(
    () => service.addTaskComment("worker-b", task.id, claim.claimId, "spoof", "comment"),
    hasCode("CLAIM_NOT_OWNED"),
  );
});

test("status and availableFor filters are mutually exclusive", async () => {
  const { project } = await createProjectTask();
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  await assert.rejects(
    () =>
      service.listTasks("worker-a", project.id, {
        status: [TaskStatus.TODO],
        availableFor: "work",
      }),
    hasCode("INVALID_FILTER_COMBINATION"),
  );
});

test("availableFor returns phase candidates independently of the Principal Role", async () => {
  const { project, task } = await createProjectTask();
  await grant(project.id, "manager-a", ProjectRole.MANAGER);

  const available = await service.listTasks("manager-a", project.id, {
    availableFor: "work",
  });

  assert.deepEqual(available.tasks.map((candidate) => candidate.id), [task.id]);
  await assert.rejects(
    () => service.claimTask("manager-a", task.id, "claim-without-worker-role"),
    hasCode("FORBIDDEN"),
  );
});

test("Task ordering uses parent Story sortOrder before Task sortOrder", async () => {
  const project = await projectRepository.create("Ordering", null, "repo/ordering");
  await grant(project.id, "manager-a", ProjectRole.MANAGER);
  await grant(project.id, "worker-a", ProjectRole.WORKER);
  const laterStory = await service.issueStory(
    "manager-a",
    { projectId: project.id, title: "Later" },
    "story-later",
  );
  const earlierStory = await service.issueStory(
    "manager-a",
    { projectId: project.id, title: "Earlier" },
    "story-earlier",
  );
  await service.editStory(
    "manager-a",
    { projectId: project.id, storyId: laterStory.id, title: laterStory.title, sortOrder: 20 },
    "order-later",
  );
  await service.editStory(
    "manager-a",
    { projectId: project.id, storyId: earlierStory.id, title: earlierStory.title, sortOrder: 10 },
    "order-earlier",
  );
  const laterTask = await service.issueTask(
    "manager-a",
    { projectId: project.id, storyId: laterStory.id, title: "Later Task" },
    "task-later",
  );
  const earlierTask = await service.issueTask(
    "manager-a",
    { projectId: project.id, storyId: earlierStory.id, title: "Earlier Task" },
    "task-earlier",
  );

  const result = await service.listTasks("worker-a", project.id, { availableFor: "work" });

  assert.deepEqual(
    result.tasks.map((task) => task.id),
    [earlierTask.id, laterTask.id],
  );
});

test("Manager cannot attach a Task to a Story from another Project", async () => {
  const first = await projectRepository.create("First", null, "repo/first");
  const second = await projectRepository.create("Second", null, "repo/second");
  await grant(first.id, "manager-a", ProjectRole.MANAGER);
  await grant(second.id, "manager-a", ProjectRole.MANAGER);
  const foreignStory = await service.issueStory(
    "manager-a",
    { projectId: second.id, title: "Foreign Story" },
    "foreign-story",
  );

  await assert.rejects(
    () =>
      service.issueTask(
        "manager-a",
        { projectId: first.id, storyId: foreignStory.id, title: "Invalid Task" },
        "invalid-task",
      ),
    hasCode("INVALID_INPUT"),
  );
});
