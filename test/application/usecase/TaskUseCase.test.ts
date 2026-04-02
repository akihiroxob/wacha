import test from "node:test";
import assert from "node:assert/strict";

import { Task } from "@domain/model/Task.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { ListTaskUseCase } from "@application/usecase/task/ListTaskUseCase.ts";
import { IssueTaskUseCase } from "@application/usecase/task/IssueTaskUseCase.ts";
import { ClaimTaskUseCase } from "@application/usecase/task/ClaimTaskUseCase.ts";
import { CompleteTaskUseCase } from "@application/usecase/task/CompleteTaskUseCase.ts";
import { AcceptTaskUseCase } from "@application/usecase/task/AcceptTaskUseCase.ts";
import { RejectTaskUseCase } from "@application/usecase/task/RejectTaskUseCase.ts";

class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>();

  constructor(seed: Task[] = []) {
    seed.forEach((task) => this.tasks.set(task.id, task));
  }

  async findByProjectId(projectId: string): Promise<Task[]> {
    return [...this.tasks.values()].filter((task) => task.projectId === projectId);
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return [...this.tasks.values()].filter((task) => task.status === status);
  }

  async findById(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) ?? null;
  }

  async create(
    title: string,
    description: string | null,
    projectId: string,
    storyId?: string,
  ): Promise<Task> {
    const task = new Task(
      `task-${this.tasks.size + 1}`,
      projectId,
      storyId ?? null,
      title,
      description,
      TaskStatus.TODO,
      null,
      null,
      null,
      1000,
      1000,
    );
    this.tasks.set(task.id, task);
    return task;
  }

  async save(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
  }
}

function createTask(status: TaskStatus = TaskStatus.TODO) {
  return new Task(
    "task-1",
    "project-1",
    null,
    "Sample Task",
    "desc",
    status,
    null,
    null,
    null,
    1000,
    1000,
  );
}

test("ListTaskUseCase returns tasks for the specified project", async () => {
  const repo = new InMemoryTaskRepository([
    new Task(
      "task-1",
      "project-1",
      null,
      "Task 1",
      "desc",
      TaskStatus.TODO,
      null,
      null,
      null,
      1000,
      1500,
    ),
    new Task(
      "task-2",
      "project-1",
      "story-1",
      "Task 2",
      null,
      TaskStatus.DOING,
      "worker-1",
      null,
      TaskStatus.TODO,
      1000,
      2000,
    ),
    new Task(
      "task-3",
      "project-2",
      null,
      "Task 3",
      null,
      TaskStatus.ACCEPTED,
      null,
      null,
      null,
      1000,
      2500,
    ),
  ]);

  const result = await new ListTaskUseCase(repo).execute("project-1");

  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.byStatus[TaskStatus.TODO], 1);
  assert.equal(result.summary.byStatus[TaskStatus.DOING], 1);
  assert.equal(result.summary.lastUpdatedAt, 2000);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks[0]?.id, "task-2");
});

test("IssueTaskUseCase creates a todo task", async () => {
  const repo = new InMemoryTaskRepository();

  const task = await new IssueTaskUseCase(repo).execute("New Task", "details", "project-1");

  assert.equal(task.title, "New Task");
  assert.equal(task.description, "details");
  assert.equal(task.projectId, "project-1");
  assert.equal(task.status, TaskStatus.TODO);
});

test("ClaimTaskUseCase claims a todo task", async () => {
  const task = createTask(TaskStatus.TODO);
  const repo = new InMemoryTaskRepository([task]);

  await new ClaimTaskUseCase(repo).execute(task.id, "worker-1");

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.DOING);
  assert.equal(savedTask?.assignee, "worker-1");
  assert.equal(savedTask?.resumeSourceStatus, TaskStatus.TODO);
});

test("CompleteTaskUseCase completes a doing task", async () => {
  const task = createTask(TaskStatus.DOING);
  const repo = new InMemoryTaskRepository([task]);

  await new CompleteTaskUseCase(repo).execute(task.id);

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.IN_REVIEW);
});

test("AcceptTaskUseCase accepts an in_review task", async () => {
  const task = new Task(
    "task-1",
    "project-1",
    null,
    "Sample Task",
    "desc",
    TaskStatus.IN_REVIEW,
    null,
    "Need tests",
    TaskStatus.REJECTED,
    1000,
    1000,
  );
  const repo = new InMemoryTaskRepository([task]);

  await new AcceptTaskUseCase(repo).execute(task.id);

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.ACCEPTED);
});

test("RejectTaskUseCase rejects an in_review task", async () => {
  const task = createTask(TaskStatus.IN_REVIEW);
  const repo = new InMemoryTaskRepository([task]);

  await new RejectTaskUseCase(repo).execute(task.id, "Need tests");

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.REJECTED);
  assert.equal(savedTask?.rejectReason, "Need tests");
});

test("CompleteTaskUseCase throws when task is missing", async () => {
  const repo = new InMemoryTaskRepository();

  await assert.rejects(() => new CompleteTaskUseCase(repo).execute("missing-task"), /not exists/);
});
