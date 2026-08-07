import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteStoryRepository } from "@repository/SQLiteStoryRepository.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { createApp } from "../../src/app.ts";

const app = createApp();
const projectRepository = new SQLiteProjectRepository();
const storyRepository = new SQLiteStoryRepository();
const taskRepository = new SQLiteTaskRepository();

const jsonInit = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task_comment").execute();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("GET /api/projects returns project list", async () => {
  await projectRepository.create("Wacha", "Task hub", "repo/wacha");

  const res = await app.request("/api/projects");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.projects.length, 1);
  assert.equal(body.projects[0].name, "Wacha");
});

test("GET /api/projects/:projectId returns the aggregate detail", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const story = await storyRepository.create(project.id, "Story A", null);
  const task = await taskRepository.create("Task A", null, project.id, story.id);
  await taskRepository.addComment(task.id, "note");

  const res = await app.request(`/api/projects/${project.id}`);
  assert.equal(res.status, 200);
  const body = await res.json();

  for (const key of ["project", "summary", "tasks", "comments", "stories", "grants", "grantSummary"]) {
    assert.ok(key in body, `response should contain ${key}`);
  }
  assert.equal(body.project.id, project.id);
  assert.equal(body.summary.total, 1);
  assert.equal(body.summary.byStatus.todo, 1);
  assert.equal(body.tasks.length, 1);
  assert.equal(body.comments.length, 1);
  assert.equal(body.stories.length, 1);
  assert.equal(body.grantSummary.total, 0);
});

test("GET /api/projects/:projectId returns 404 for unknown project", async () => {
  const res = await app.request("/api/projects/unknown");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.message, "Project not found");
});

test("GET /api/projects/:projectId/activity returns current Claims, unattended Doing, and changes", async () => {
  const now = Date.now();
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const activeTask = await taskRepository.create("Active task", null, project.id);
  const expiredTask = await taskRepository.create("Expired task", null, project.id);
  activeTask.status = TaskStatus.DOING;
  expiredTask.status = TaskStatus.DOING;
  await taskRepository.save(activeTask);
  await taskRepository.save(expiredTask);

  await DatabaseClient.insertInto("task_claim")
    .values([
      {
        id: "active-claim",
        task_id: activeTask.id,
        principal_id: "worker-active",
        state: "active",
        acquired_at: now - 10_000,
        renewed_at: null,
        expires_at: now + 60_000,
        released_at: null,
        release_reason: null,
      },
      {
        id: "expired-claim",
        task_id: expiredTask.id,
        principal_id: "worker-expired",
        state: "active",
        acquired_at: now - 120_000,
        renewed_at: null,
        expires_at: now - 60_000,
        released_at: null,
        release_reason: null,
      },
    ])
    .execute();
  await DatabaseClient.insertInto("change_log")
    .values([
      {
        project_id: project.id,
        type: "TASK_CLAIMED",
        entity_id: activeTask.id,
        principal_id: "worker-active",
        claim_id: "active-claim",
        payload: JSON.stringify({ fromStatus: "todo", toStatus: "doing" }),
        occurred_at: now - 10_000,
      },
      {
        project_id: project.id,
        type: "CLAIM_EXPIRED",
        entity_id: expiredTask.id,
        principal_id: "system:test",
        claim_id: "expired-claim",
        payload: JSON.stringify({ expiresAt: now - 60_000 }),
        occurred_at: now,
      },
    ])
    .execute();

  const res = await app.request(`/api/projects/${project.id}/activity?limit=1`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.activeClaims.length, 1);
  assert.equal(body.activeClaims[0].principalId, "worker-active");
  assert.equal(body.unclaimedDoingTasks.length, 1);
  assert.equal(body.unclaimedDoingTasks[0].taskId, expiredTask.id);
  assert.equal(body.unclaimedDoingTasks[0].lastPrincipalId, "worker-expired");
  assert.equal(body.changes.length, 1);
  assert.equal(body.changes[0].type, "CLAIM_EXPIRED");
  assert.equal(body.changes[0].entityTitle, "Expired task");
  assert.equal(body.hasMoreChanges, true);
});

test("GET /api/projects/:projectId/activity validates the change limit", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const res = await app.request(`/api/projects/${project.id}/activity?limit=201`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.message, "limit must be an integer between 1 and 200");
});

test("Project Role Grant can be issued and revoked from the REST API", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const grantInput = { principalId: "E2EWorker", role: "worker" };

  const createRes = await app.request(
    `/api/projects/${project.id}/grants`,
    jsonInit("POST", grantInput),
  );
  assert.equal(createRes.status, 201);

  const detailRes = await app.request(`/api/projects/${project.id}`);
  const detail = await detailRes.json();
  assert.deepEqual(
    detail.grants.map((grant: { principalId: string; role: string }) => ({
      principalId: grant.principalId,
      role: grant.role,
    })),
    [grantInput],
  );

  const revokeRes = await app.request(
    `/api/projects/${project.id}/grants`,
    jsonInit("DELETE", grantInput),
  );
  assert.equal(revokeRes.status, 200);

  const afterRevokeRes = await app.request(`/api/projects/${project.id}`);
  const afterRevoke = await afterRevokeRes.json();
  assert.equal(afterRevoke.grants.length, 0);
});

test("Project Role Grant API rejects empty Agent names and unsupported Roles", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");

  const emptyAgentRes = await app.request(
    `/api/projects/${project.id}/grants`,
    jsonInit("POST", { principalId: "  ", role: "worker" }),
  );
  assert.equal(emptyAgentRes.status, 400);

  const invalidRoleRes = await app.request(
    `/api/projects/${project.id}/grants`,
    jsonInit("POST", { principalId: "agent-a", role: "owner" }),
  );
  assert.equal(invalidRoleRes.status, 400);
});

test("POST /api/projects/:projectId/stories creates a story", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");

  const res = await app.request(
    `/api/projects/${project.id}/stories`,
    jsonInit("POST", { title: "New Story", description: "details" }),
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.story.title, "New Story");
  assert.equal(body.story.description, "details");
  assert.equal(body.story.status, "todo");
});

test("POST /api/projects/:projectId/stories/:storyId/move swaps priority with the neighbor", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const storyA = await storyRepository.create(project.id, "Story A", null);
  const storyB = await storyRepository.create(project.id, "Story B", null);

  const res = await app.request(
    `/api/projects/${project.id}/stories/${storyB.id}/move`,
    jsonInit("POST", { direction: "up" }),
  );
  assert.equal(res.status, 200);

  const detailRes = await app.request(`/api/projects/${project.id}`);
  const detail = await detailRes.json();
  assert.deepEqual(
    detail.stories.map((story: { id: string }) => story.id),
    [storyB.id, storyA.id],
  );
});

test("POST move works even when adjacent stories share the same sortOrder", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const storyA = await storyRepository.create(project.id, "Story A", null);
  const storyB = await storyRepository.create(project.id, "Story B", null);

  // edit_story 相当の操作で同順位が発生した状態を作る
  await app.request(
    `/api/projects/${project.id}/stories/${storyB.id}`,
    jsonInit("PUT", { title: "Story B", sortOrder: storyA.sortOrder }),
  );

  const res = await app.request(
    `/api/projects/${project.id}/stories/${storyB.id}/move`,
    jsonInit("POST", { direction: "up" }),
  );
  assert.equal(res.status, 200);

  const detailRes = await app.request(`/api/projects/${project.id}`);
  const detail = await detailRes.json();
  assert.deepEqual(
    detail.stories.map((story: { id: string }) => story.id),
    [storyB.id, storyA.id],
  );
});

test("POST move at the top edge is a no-op", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const storyA = await storyRepository.create(project.id, "Story A", null);
  await storyRepository.create(project.id, "Story B", null);

  const res = await app.request(
    `/api/projects/${project.id}/stories/${storyA.id}/move`,
    jsonInit("POST", { direction: "up" }),
  );
  assert.equal(res.status, 200);

  const detailRes = await app.request(`/api/projects/${project.id}`);
  const detail = await detailRes.json();
  assert.equal(detail.stories[0].id, storyA.id);
});

test("POST move with invalid direction returns 400", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const story = await storyRepository.create(project.id, "Story A", null);

  const res = await app.request(
    `/api/projects/${project.id}/stories/${story.id}/move`,
    jsonInit("POST", { direction: "sideways" }),
  );
  assert.equal(res.status, 400);
});

test("POST /api/projects/:projectId/stories without title returns 400", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");

  const res = await app.request(
    `/api/projects/${project.id}/stories`,
    jsonInit("POST", { title: "", description: "details" }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(typeof body.error.message, "string");
});

test("PUT /api/projects/:projectId/stories/:storyId updates a story", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const story = await storyRepository.create(project.id, "Story A", null);

  const res = await app.request(
    `/api/projects/${project.id}/stories/${story.id}`,
    jsonInit("PUT", { title: "Story A2", description: "updated" }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  const saved = await storyRepository.findById(story.id);
  assert.equal(saved?.title, "Story A2");
  assert.equal(saved?.description, "updated");
});

test("DELETE /api/projects/:projectId/stories/:storyId deletes a doing story and its Task data", async () => {
  const now = Date.now();
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const story = await storyRepository.create(project.id, "Story A", null);
  story.claim();
  await storyRepository.save(story);
  const task = await taskRepository.create("Task A", null, project.id, story.id);
  task.status = TaskStatus.DOING;
  await taskRepository.save(task);
  await taskRepository.addComment(task.id, "work in progress", "worker-a");
  await DatabaseClient.insertInto("task_claim")
    .values({
      id: "story-delete-claim",
      task_id: task.id,
      principal_id: "worker-a",
      state: "active",
      acquired_at: now,
      renewed_at: null,
      expires_at: now + 60_000,
      released_at: null,
      release_reason: null,
    })
    .execute();
  await DatabaseClient.insertInto("change_log")
    .values({
      project_id: project.id,
      type: "TASK_CLAIMED",
      entity_id: task.id,
      principal_id: "worker-a",
      claim_id: "story-delete-claim",
      payload: JSON.stringify({ fromStatus: "todo", toStatus: "doing" }),
      occurred_at: now,
    })
    .execute();

  const res = await app.request(
    `/api/projects/${project.id}/stories/${story.id}`,
    jsonInit("DELETE"),
  );
  assert.equal(res.status, 200);
  assert.equal(await storyRepository.findById(story.id), null);
  assert.equal(await taskRepository.findById(task.id), null);
  assert.equal(
    Number(
      (await DatabaseClient.selectFrom("task_comment").select(({ fn }) => fn.countAll().as("count")).executeTakeFirstOrThrow()).count,
    ),
    0,
  );
  assert.equal(
    Number(
      (await DatabaseClient.selectFrom("task_claim").select(({ fn }) => fn.countAll().as("count")).executeTakeFirstOrThrow()).count,
    ),
    0,
  );
  assert.equal(
    Number(
      (await DatabaseClient.selectFrom("change_log").select(({ fn }) => fn.countAll().as("count")).executeTakeFirstOrThrow()).count,
    ),
    1,
  );
});

test("PUT /api/projects/:projectId/tasks/:taskId updates a task", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const task = await taskRepository.create("Task A", null, project.id);

  const res = await app.request(
    `/api/projects/${project.id}/tasks/${task.id}`,
    jsonInit("PUT", { title: "Task A2" }),
  );
  assert.equal(res.status, 200);

  const saved = await taskRepository.findById(task.id);
  assert.equal(saved?.title, "Task A2");
});

test("DELETE /api/projects/:projectId/tasks/:taskId deletes a doing Task", async () => {
  const now = Date.now();
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const task = await taskRepository.create("Task A", null, project.id);
  task.status = TaskStatus.DOING;
  await taskRepository.save(task);
  await taskRepository.addComment(task.id, "work in progress", "worker-a");
  await DatabaseClient.insertInto("task_claim")
    .values({
      id: "task-delete-claim",
      task_id: task.id,
      principal_id: "worker-a",
      state: "active",
      acquired_at: now,
      renewed_at: null,
      expires_at: now + 60_000,
      released_at: null,
      release_reason: null,
    })
    .execute();

  const res = await app.request(
    `/api/projects/${project.id}/tasks/${task.id}`,
    jsonInit("DELETE"),
  );

  assert.equal(res.status, 200);
  assert.equal(await taskRepository.findById(task.id), null);
  assert.equal(
    Number(
      (await DatabaseClient.selectFrom("task_comment").select(({ fn }) => fn.countAll().as("count")).executeTakeFirstOrThrow()).count,
    ),
    0,
  );
  assert.equal(
    Number(
      (await DatabaseClient.selectFrom("task_claim").select(({ fn }) => fn.countAll().as("count")).executeTakeFirstOrThrow()).count,
    ),
    0,
  );
});

test("POST /api/projects/:projectId/tasks/:taskId/accept accepts an in_review task", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const task = await taskRepository.create("Task A", null, project.id);
  task.status = TaskStatus.IN_REVIEW;
  await taskRepository.save(task);

  const res = await app.request(
    `/api/projects/${project.id}/tasks/${task.id}/accept`,
    jsonInit("POST", {}),
  );
  assert.equal(res.status, 200);

  const saved = await taskRepository.findById(task.id);
  assert.equal(saved?.status, TaskStatus.ACCEPTED);
});

test("POST reject without reason returns 400", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const task = await taskRepository.create("Task A", null, project.id);
  task.status = TaskStatus.IN_REVIEW;
  await taskRepository.save(task);

  const res = await app.request(
    `/api/projects/${project.id}/tasks/${task.id}/reject`,
    jsonInit("POST", { reason: "" }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.message, "Reject reason is required");
});

test("POST reject with reason moves the task to rejected", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const task = await taskRepository.create("Task A", null, project.id);
  task.status = TaskStatus.WAIT_ACCEPT;
  await taskRepository.save(task);

  const res = await app.request(
    `/api/projects/${project.id}/tasks/${task.id}/reject`,
    jsonInit("POST", { reason: "needs more tests" }),
  );
  assert.equal(res.status, 200);

  const saved = await taskRepository.findById(task.id);
  assert.equal(saved?.status, TaskStatus.REJECTED);
  assert.equal(saved?.rejectReason, "needs more tests");
});

test("POST cancel without reason returns 400", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const task = await taskRepository.create("Task A", null, project.id);

  const res = await app.request(
    `/api/projects/${project.id}/tasks/${task.id}/cancel`,
    jsonInit("POST", {}),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.message, "Cancel reason is required");
});

test("POST /api/projects/:projectId/tasks/:taskId/comments creates a comment", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const task = await taskRepository.create("Task A", null, project.id);

  const res = await app.request(
    `/api/projects/${project.id}/tasks/${task.id}/comments`,
    jsonInit("POST", { body: "looks good", author: "PdM" }),
  );
  assert.equal(res.status, 201);

  const comments = await taskRepository.findCommentsByTaskId(task.id);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].body, "looks good");
  assert.equal(comments[0].author, "PdM");
});

test("unknown /api path returns REST-style 404", async () => {
  const res = await app.request("/api/nope");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.message, "Not Found");
});

test("POST /mcp error responses keep the JSON-RPC shape", async () => {
  const res = await app.request("/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json",
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.jsonrpc, "2.0");
  assert.equal(typeof body.error.code, "number");
  assert.equal(typeof body.error.message, "string");
});
