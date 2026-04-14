import test from "node:test";
import assert from "node:assert/strict";

import { Task } from "@domain/model/Task.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";

function createTask(status: TaskStatus = TaskStatus.TODO) {
  return new Task("task-1", "project-1", null, "Sample Task", "desc", status, null, null, null, 1000, 1000);
}

test("Task.claim changes status to doing and sets assignee", () => {
  const task = createTask();

  task.claim("worker-1");

  assert.equal(task.status, TaskStatus.DOING);
  assert.equal(task.assignee, "worker-1");
  assert.equal(task.resumeSourceStatus, TaskStatus.TODO);
  assert.ok(task.updatedAt >= 1000);
});

test("Task.claim from rejected keeps rejected as resume source", () => {
  const task = createTask(TaskStatus.REJECTED);

  task.claim("worker-1");

  assert.equal(task.status, TaskStatus.DOING);
  assert.equal(task.resumeSourceStatus, TaskStatus.REJECTED);
});

test("Task.complete changes status from doing to in_review", () => {
  const task = createTask(TaskStatus.DOING);

  task.complete();

  assert.equal(task.status, TaskStatus.IN_REVIEW);
});

test("Task.reviewed changes status from in_review to wait_accept", () => {
  const task = createTask(TaskStatus.IN_REVIEW);

  task.reviewed();

  assert.equal(task.status, TaskStatus.WAIT_ACCEPT);
});

test("Task.accept changes status from wait_accept to accepted", () => {
  const task = new Task(
    "task-1",
    "project-1",
    null,
    "Sample Task",
    "desc",
    TaskStatus.WAIT_ACCEPT,
    null,
    "Need tests",
    TaskStatus.REJECTED,
    1000,
    1000,
  );

  task.accept();

  assert.equal(task.status, TaskStatus.ACCEPTED);
  assert.equal(task.rejectReason, null);
  assert.equal(task.resumeSourceStatus, null);
});

test("Task.reject changes status from in_review to rejected", () => {
  const task = createTask(TaskStatus.IN_REVIEW);

  task.reject("Need tests");

  assert.equal(task.status, TaskStatus.REJECTED);
  assert.equal(task.rejectReason, "Need tests");
  assert.equal(task.resumeSourceStatus, null);
});

test("Task.reject changes status from wait_accept to rejected", () => {
  const task = createTask(TaskStatus.WAIT_ACCEPT);

  task.reject("Need final adjustment");

  assert.equal(task.status, TaskStatus.REJECTED);
  assert.equal(task.rejectReason, "Need final adjustment");
  assert.equal(task.resumeSourceStatus, null);
});

test("Task.claim throws when status is not todo", () => {
  const task = createTask(TaskStatus.DOING);

  assert.throws(() => task.claim("worker-1"), /already claimed/);
});

test("Task.complete throws when status is not doing", () => {
  const task = createTask(TaskStatus.TODO);

  assert.throws(() => task.complete(), /not in doing status/);
});

test("Task.reviewed throws when status is not in_review", () => {
  const task = createTask(TaskStatus.DOING);

  assert.throws(() => task.reviewed(), /not in in_review status/);
});

test("Task.accept throws when status is not in wait_accept", () => {
  const task = createTask(TaskStatus.DOING);

  assert.throws(() => task.accept(), /not in wait_accept status/);
});

test("Task.reject throws when status is neither in_review nor wait_accept", () => {
  const task = createTask(TaskStatus.DOING);

  assert.throws(() => task.reject("Need tests"), /not in reviewable status/);
});

test("Task.reject throws when reason is empty", () => {
  const task = createTask(TaskStatus.IN_REVIEW);

  assert.throws(() => task.reject(" "), /reject reason cannot be empty/);
});
