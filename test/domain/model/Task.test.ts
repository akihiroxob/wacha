import test from "node:test";
import assert from "node:assert/strict";

import { Task } from "@domain/model/Task.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";

function createTask(status: TaskStatus = TaskStatus.TODO) {
  return new Task("task-1", "project-1", null, "Sample Task", "desc", status, null, 1000, 1000);
}

test("Task.claim changes status to doing and sets assignee", () => {
  const task = createTask();

  task.claim("worker-1");

  assert.equal(task.status, TaskStatus.DOING);
  assert.equal(task.assignee, "worker-1");
  assert.ok(task.updatedAt >= 1000);
});

test("Task.complete changes status from doing to in_review", () => {
  const task = createTask(TaskStatus.DOING);

  task.complete();

  assert.equal(task.status, TaskStatus.IN_REVIEW);
});

test("Task.accept changes status from in_review to accepted", () => {
  const task = createTask(TaskStatus.IN_REVIEW);

  task.accept();

  assert.equal(task.status, TaskStatus.ACCEPTED);
});

test("Task.reject changes status from in_review to rejected", () => {
  const task = createTask(TaskStatus.IN_REVIEW);

  task.reject();

  assert.equal(task.status, TaskStatus.REJECTED);
});

test("Task.claim throws when status is not todo", () => {
  const task = createTask(TaskStatus.DOING);

  assert.throws(() => task.claim("worker-1"), /already claimed/);
});

test("Task.complete throws when status is not doing", () => {
  const task = createTask(TaskStatus.TODO);

  assert.throws(() => task.complete(), /not in doing status/);
});

test("Task.accept throws when status is not in_review", () => {
  const task = createTask(TaskStatus.DOING);

  assert.throws(() => task.accept(), /not in in_review status/);
});

test("Task.reject throws when status is not in_review", () => {
  const task = createTask(TaskStatus.DOING);

  assert.throws(() => task.reject(), /not in in_review status/);
});
