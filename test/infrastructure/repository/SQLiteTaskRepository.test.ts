import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { Task } from "@domain/model/Task.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";

const repository = new SQLiteTaskRepository();

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_membership").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();

  await DatabaseClient.insertInto("project")
    .values({
      id: "project-1",
      name: "Project 1",
      description: null,
      basedir: "repo/project-1",
      created_at: 1000,
      updated_at: 1000,
    })
    .execute();
});

test("SQLiteTaskRepository.create persists a task", async () => {
  const task = await repository.create("Created Task", "details", "project-1");

  const savedTask = await repository.findById(task.id);

  assert.equal(savedTask?.title, "Created Task");
  assert.equal(savedTask?.description, "details");
  assert.equal(savedTask?.projectId, "project-1");
  assert.equal(savedTask?.status, TaskStatus.TODO);
  assert.equal(savedTask?.rejectReason, null);
  assert.equal(savedTask?.resumeSourceStatus, null);
});

test("SQLiteTaskRepository.findAll returns persisted tasks", async () => {
  await repository.create("Task 1", null, "project-1");
  await repository.create("Task 2", null, "project-1");

  const tasks = await repository.findAll();

  assert.equal(tasks.length, 2);
});

test("SQLiteTaskRepository.findByStatus filters by status", async () => {
  const task = await repository.create("Task 1", null, "project-1");
  task.status = TaskStatus.DOING;
  task.assignee = "worker-1";
  task.resumeSourceStatus = TaskStatus.TODO;
  await repository.save(task);

  await repository.create("Task 2", null, "project-1");

  const tasks = await repository.findByStatus(TaskStatus.DOING);

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.id, task.id);
});

test("SQLiteTaskRepository.save updates an existing task", async () => {
  const task = await repository.create("Task 1", null, "project-1");
  task.title = "Updated Task";
  task.status = TaskStatus.ACCEPTED;

  await repository.save(task);

  const savedTask = await repository.findById(task.id);
  assert.equal(savedTask?.title, "Updated Task");
  assert.equal(savedTask?.status, TaskStatus.ACCEPTED);
});

test("SQLiteTaskRepository.save throws for a missing task", async () => {
  const task = new Task(
    "missing-task",
    "project-1",
    null,
    "Task 1",
    null,
    TaskStatus.TODO,
    null,
    null,
    null,
    1000,
    1000,
  );

  await assert.rejects(() => repository.save(task), /Task not found/);
});
