import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { TaskCoordinationService } from "@application/service/TaskCoordinationService.ts";
import { CoordinationError } from "@application/error/CoordinationError.ts";
import type { PullRequestSnapshot } from "@domain/model/PullRequest.ts";
import { DatabaseClient as db } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { SQLiteProjectGrantRepository } from "@repository/SQLiteProjectGrantRepository.ts";

const projects = new SQLiteProjectRepository();
const tasks = new SQLiteTaskRepository();
const grants = new SQLiteProjectGrantRepository();
const sha = "a".repeat(40), merge = "b".repeat(40);
let snapshot: PullRequestSnapshot;
let calls = 0;
const service = new TaskCoordinationService(() => 1000, 60_000, {
  async getPullRequest(repository, number) { calls++; return { ...snapshot, repository, number }; },
});
const code = (expected: string) => (error: unknown) => error instanceof CoordinationError && error.code === expected;

beforeEach(async () => {
  await initializeSchema();
  for (const table of ["change_log", "command_receipt", "task_comment", "task_claim", "task", "project_grant", "story", "project"] as const) {
    await db.deleteFrom(table).execute();
  }
  calls = 0;
  snapshot = { number: 1, url: "https://github.com/org/repo/pull/1", repository: "org/repo", baseBranch: "main",
    headBranch: "ralph/task", headSha: sha, author: "worker", state: "open", draft: false, mergeSha: null,
    reviewEvidence: [], checks: [{ name: "verify", state: "pending" }] };
});

async function setup(requiredChecks = ["verify"]) {
  const project = await projects.create("GitHub", null, "/repo");
  await service.configureRepositoryWorkflow(project.id, { repository: "org/repo", baseBranch: "main", requiredChecks });
  const task = await tasks.create("Task", "AC", project.id);
  for (const role of ["worker", "reviewer", "manager"] as const) await grants.grant(project.id, role, role);
  const work = await service.claimTask("worker", task.id, "work");
  await service.addTaskComment("worker", task.id, work.claimId, "Implementation verified", "notes");
  return { project, task, work };
}
async function submit(requiredChecks = ["verify"]) {
  const context = await setup(requiredChecks);
  await service.registerTaskPullRequest("worker", context.task.id, context.work.claimId, 1, "register");
  await service.completeTask("worker", context.task.id, context.work.claimId, "complete");
  return context;
}
async function reviewed() {
  const context = await submit();
  const review = await service.claimReview("reviewer", context.task.id, "review");
  snapshot = { ...snapshot, state: "merged", mergeSha: merge, reviewEvidence: [], checks: [{ name: "verify", state: "success" }] };
  snapshot.reviewEvidence = [{ id: 42, url: "https://github.com/org/repo/pull/1#issuecomment-42", author: "same-account", headSha: sha, taskId: context.task.id, claimId: review.claimId, decision: "approve" }];
  await service.reviewedTask("reviewer", context.task.id, review.claimId, "reviewed", sha, 42);
  return { ...context, review };
}

test("GitHub Task requires a registered PR and prevents direct Manager review", async () => {
  const { project, task, work } = await setup();
  await assert.rejects(service.completeTask("worker", task.id, work.claimId, "complete"), code("PULL_REQUEST_REQUIRED"));
  await service.registerTaskPullRequest("worker", task.id, work.claimId, 1, "register");
  await service.completeTask("worker", task.id, work.claimId, "complete");
  assert.equal((await service.listTasks("manager", project.id, { availableFor: "acceptance" })).tasks.length, 0);
  await assert.rejects(service.claimAcceptance("manager", task.id, "acceptance"), code("PULL_REQUEST_NOT_READY"));
  await assert.rejects(service.acceptTaskAsOperator("system:web-ui", task.id), code("PULL_REQUEST_NOT_READY"));
});

test("review gate verifies merged PR, Claim-bound comment, CI and exact reviewed head", async () => {
  const { task } = await submit();
  const review = await service.claimReview("reviewer", task.id, "review");
  await assert.rejects(service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", sha, 42), code("PULL_REQUEST_NOT_READY"));
  snapshot = { ...snapshot, state: "merged", mergeSha: merge, reviewEvidence: [] };
  await assert.rejects(service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", sha, 42), code("PULL_REQUEST_NOT_READY"));
  snapshot.checks = [{ name: "verify", state: "success" }];
  await assert.rejects(service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", "c".repeat(40), 42), code("PULL_REQUEST_NOT_READY"));
  snapshot.reviewEvidence = [];
  await assert.rejects(service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", sha, 42), code("PULL_REQUEST_NOT_READY"));
  snapshot.reviewEvidence = [{ id: 42, url: "https://github.com/org/repo/pull/1#issuecomment-42", author: "same-account", headSha: sha, taskId: task.id, claimId: "wrong-claim", decision: "approve" }];
  await assert.rejects(service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", sha, 42), code("PULL_REQUEST_NOT_READY"));
  snapshot.reviewEvidence[0]!.claimId = review.claimId;
  assert.equal((await service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", sha, 42)).status, "wait_accept");
});

test("acceptance records evidence on the reviewed merge SHA and supports lost-response retry", async () => {
  const { task, review } = await reviewed();
  const before = calls;
  await service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", sha, 42);
  assert.equal(calls, before, "receipt replay must not depend on GitHub availability");
  const claim = await service.claimAcceptance("manager", task.id, "acceptance");
  await assert.rejects(service.acceptTask("manager", task.id, claim.claimId, "accepted"), code("PULL_REQUEST_NOT_READY"));
  await assert.rejects(service.acceptTask("manager", task.id, claim.claimId, "accepted", { mergeSha: sha, evidence: "AC passed" }), code("PULL_REQUEST_NOT_READY"));
  const verification = { mergeSha: merge, evidence: "AC1: integrated behavior verified" };
  await service.acceptTask("manager", task.id, claim.claimId, "accepted", verification);
  const history = (await service.listTaskPullRequests("manager", task.id)).pullRequests;
  assert.equal(history[0]?.acceptedMergeSha, merge);
  assert.equal(history[0]?.acceptanceEvidence, verification.evidence);
  const count = calls;
  await service.acceptTask("manager", task.id, claim.claimId, "accepted", verification);
  assert.equal(calls, count);
  await assert.rejects(service.acceptTask("manager", task.id, claim.claimId, "accepted", { ...verification, evidence: "different" }), code("IDEMPOTENCY_CONFLICT"));
});

test("review rejection reuses open PR; Manager rejection requires a new PR and keeps history", async () => {
  const { task } = await submit();
  const review = await service.claimReview("reviewer", task.id, "review");
  await service.rejectTask("reviewer", task.id, review.claimId, "Missing test", "reject-review");
  const work = await service.claimTask("worker", task.id, "work-again");
  await service.registerTaskPullRequest("worker", task.id, work.claimId, 1, "register-again");
  assert.equal((await service.listTaskPullRequests("worker", task.id)).pullRequests.length, 1);
  await service.addTaskComment("worker", task.id, work.claimId, "Fixed tests", "notes-again");
  await service.completeTask("worker", task.id, work.claimId, "complete-again");
  const secondReview = await service.claimReview("reviewer", task.id, "review-again");
  snapshot = { ...snapshot, state: "merged", mergeSha: merge, reviewEvidence: [], checks: [{ name: "verify", state: "success" }] };
  snapshot.reviewEvidence = [{ id: 43, url: "https://github.com/org/repo/pull/1#issuecomment-43", author: "same-account", headSha: sha, taskId: task.id, claimId: secondReview.claimId, decision: "approve" }];
  await service.reviewedTask("reviewer", task.id, secondReview.claimId, "reviewed-again", sha, 43);
  const acceptance = await service.claimAcceptance("manager", task.id, "acceptance");
  await service.rejectTask("manager", task.id, acceptance.claimId, "AC failed in integrated behavior", "reject-ac");
  const thirdWork = await service.claimTask("worker", task.id, "work-third");
  await assert.rejects(service.registerTaskPullRequest("worker", task.id, thirdWork.claimId, 1, "register-third"), code("PULL_REQUEST_NOT_READY"));
  snapshot = { ...snapshot, state: "open", mergeSha: null };
  await service.registerTaskPullRequest("worker", task.id, thirdWork.claimId, 2, "register-third");
  assert.deepEqual((await service.listTaskPullRequests("worker", task.id)).pullRequests.map((pr) => pr.number), [1, 2]);
});

test("PR cannot be attached by another Principal, another Task, or with wrong base", async () => {
  const { project, task, work } = await setup();
  await assert.rejects(service.registerTaskPullRequest("reviewer", task.id, work.claimId, 1, "forged"), code("FORBIDDEN"));
  snapshot.baseBranch = "wrong";
  await assert.rejects(service.registerTaskPullRequest("worker", task.id, work.claimId, 1, "register"), code("PULL_REQUEST_NOT_READY"));
  snapshot.baseBranch = "main";
  await service.registerTaskPullRequest("worker", task.id, work.claimId, 1, "register");
  const other = await tasks.create("Other", null, project.id);
  const otherClaim = await service.claimTask("worker", other.id, "other-claim");
  await assert.rejects(service.registerTaskPullRequest("worker", other.id, otherClaim.claimId, 1, "other-register"), code("PULL_REQUEST_NOT_READY"));
});

test("GitHub failure rolls back transitions and leaves Claim recoverable", async () => {
  const { task, work } = await setup();
  await service.registerTaskPullRequest("worker", task.id, work.claimId, 1, "register");
  const failing = new TaskCoordinationService(() => 1000, 60_000, {
    async getPullRequest() { throw new CoordinationError("GITHUB_UNAVAILABLE", "Unavailable"); },
  });
  await assert.rejects(failing.completeTask("worker", task.id, work.claimId, "complete"), code("GITHUB_UNAVAILABLE"));
  assert.equal((await tasks.findById(task.id))?.status, "doing");
  assert.equal((await db.selectFrom("task_claim").selectAll().where("id", "=", work.claimId).executeTakeFirst())?.state, "active");
});

test("workflow changes are blocked during active Tasks", async () => {
  const { project } = await setup();
  await assert.rejects(service.configureRepositoryWorkflow(project.id, null), code("INVALID_TASK_STATUS"));
});


test("CI is optional; a merged PR with a Claim-bound comment can be reviewed without checks", async () => {
  const { project, task } = await submit([]);
  assert.deepEqual((await service.getRepositoryWorkflow(project.id))?.requiredChecks, []);
  const review = await service.claimReview("reviewer", task.id, "review");
  snapshot = { ...snapshot, state: "merged", mergeSha: merge, checks: [], reviewEvidence: [{
    id: 42, url: "https://github.com/org/repo/pull/1#issuecomment-42", author: "same-account",
    headSha: sha, taskId: task.id, claimId: review.claimId, decision: "approve",
  }] };
  assert.equal((await service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", sha, 42)).status, "wait_accept");
});

test("configured CI still blocks review when missing or failing", async () => {
  const { task } = await submit();
  const review = await service.claimReview("reviewer", task.id, "review");
  snapshot = { ...snapshot, state: "merged", mergeSha: merge, reviewEvidence: [{
    id: 42, url: "https://github.com/org/repo/pull/1#issuecomment-42", author: "same-account",
    headSha: sha, taskId: task.id, claimId: review.claimId, decision: "approve",
  }] };
  for (const checks of [[], [{ name: "verify", state: "failure" }]]) {
    snapshot.checks = checks;
    await assert.rejects(service.reviewedTask("reviewer", task.id, review.claimId, "reviewed", sha, 42), code("PULL_REQUEST_NOT_READY"));
  }
});
