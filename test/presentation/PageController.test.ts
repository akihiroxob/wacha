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
  await DatabaseClient.deleteFrom("project_membership").execute();
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

  for (const key of ["project", "summary", "tasks", "comments", "stories", "agents", "agentSummary"]) {
    assert.ok(key in body, `response should contain ${key}`);
  }
  assert.equal(body.project.id, project.id);
  assert.equal(body.summary.total, 1);
  assert.equal(body.summary.byStatus.todo, 1);
  assert.equal(body.tasks.length, 1);
  assert.equal(body.comments.length, 1);
  assert.equal(body.stories.length, 1);
  assert.equal(body.agentSummary.total, 0);
});

test("GET /api/projects/:projectId returns 404 for unknown project", async () => {
  const res = await app.request("/api/projects/unknown");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.message, "Project not found");
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

test("DELETE /api/projects/:projectId/stories/:storyId deletes a story", async () => {
  const project = await projectRepository.create("Wacha", null, "repo/wacha");
  const story = await storyRepository.create(project.id, "Story A", null);

  const res = await app.request(
    `/api/projects/${project.id}/stories/${story.id}`,
    jsonInit("DELETE"),
  );
  assert.equal(res.status, 200);
  assert.equal(await storyRepository.findById(story.id), null);
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
    jsonInit("POST", { body: "looks good" }),
  );
  assert.equal(res.status, 201);

  const comments = await taskRepository.findCommentsByTaskId(task.id);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].body, "looks good");
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
