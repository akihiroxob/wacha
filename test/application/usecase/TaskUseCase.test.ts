import test from "node:test";
import assert from "node:assert/strict";

import { Task } from "@domain/model/Task.ts";
import { Story } from "@domain/model/Story.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { TaskComment } from "@domain/model/TaskComment.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { ListTaskUseCase } from "@application/usecase/tasks/ListTaskUseCase.ts";
import { IssueTaskUseCase } from "@application/usecase/tasks/IssueTaskUseCase.ts";
import { ClaimTaskUseCase } from "@application/usecase/tasks/ClaimTaskUseCase.ts";
import { CompleteTaskUseCase } from "@application/usecase/tasks/CompleteTaskUseCase.ts";
import { ReviewedTaskUseCase } from "@application/usecase/tasks/ReviewedTaskUseCase.ts";
import { AcceptTaskUseCase } from "@application/usecase/tasks/AcceptTaskUseCase.ts";
import { RejectTaskUseCase } from "@application/usecase/tasks/RejectTaskUseCase.ts";

class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>();
  comments: TaskComment[] = [];

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

  async addComment(taskId: string, body: string, author?: string | null): Promise<TaskComment> {
    const comment = new TaskComment(
      `comment-${this.comments.length + 1}`,
      taskId,
      body,
      author ?? null,
      1000 + this.comments.length,
    );
    this.comments.push(comment);
    return comment;
  }

  async findCommentsByTaskId(taskId: string): Promise<TaskComment[]> {
    return this.comments.filter((comment) => comment.taskId === taskId);
  }

  async findCommentsByTaskIds(taskIds: string[]): Promise<TaskComment[]> {
    return this.comments.filter((comment) => taskIds.includes(comment.taskId));
  }

  async delete(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
  }

  async deleteByStoryId(storyId: string): Promise<void> {
    for (const task of this.tasks.values()) {
      if (task.storyId === storyId) this.tasks.delete(task.id);
    }
  }
}

class InMemoryStoryRepository implements StoryRepository {
  private stories = new Map<string, Story>();

  constructor(seed: Story[] = []) {
    seed.forEach((story) => this.stories.set(story.id, story));
  }

  async findAll(): Promise<Story[]> {
    return [...this.stories.values()];
  }

  async findById(storyId: string): Promise<Story | null> {
    return this.stories.get(storyId) ?? null;
  }

  async findByProjectId(projectId: string): Promise<Story[]> {
    return [...this.stories.values()].filter((story) => story.projectId === projectId);
  }

  async create(projectId: string, title: string, description: string | null): Promise<Story> {
    const story = new Story(
      `story-${this.stories.size + 1}`,
      projectId,
      title,
      description,
      StoryStatus.TODO,
      1000,
      1000,
    );
    this.stories.set(story.id, story);
    return story;
  }

  async save(story: Story): Promise<void> {
    this.stories.set(story.id, story);
  }

  async delete(storyId: string): Promise<void> {
    this.stories.delete(storyId);
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

function createStory(status: StoryStatus = StoryStatus.TODO) {
  return new Story("story-1", "project-1", "Story 1", "desc", status, 1000, 1000);
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
      TaskStatus.WAIT_ACCEPT,
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
  assert.equal(result.summary.byStatus[TaskStatus.WAIT_ACCEPT], 0);
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

test("ClaimTaskUseCase moves the linked story to doing on first claim", async () => {
  const task = new Task(
    "task-1",
    "project-1",
    "story-1",
    "Task 1",
    "desc",
    TaskStatus.TODO,
    null,
    null,
    null,
    1000,
    1000,
  );
  const taskRepo = new InMemoryTaskRepository([task]);
  const storyRepo = new InMemoryStoryRepository([createStory(StoryStatus.TODO)]);

  await new ClaimTaskUseCase(taskRepo, storyRepo).execute(task.id, "worker-1");

  const savedStory = await storyRepo.findById("story-1");
  assert.equal(savedStory?.status, StoryStatus.DOING);
});

test("ClaimTaskUseCase keeps a manually claimed story in doing", async () => {
  const task = new Task(
    "task-1",
    "project-1",
    "story-1",
    "Task 1",
    "desc",
    TaskStatus.TODO,
    null,
    null,
    null,
    1000,
    1000,
  );
  const taskRepo = new InMemoryTaskRepository([task]);
  const storyRepo = new InMemoryStoryRepository([createStory(StoryStatus.DOING)]);

  await new ClaimTaskUseCase(taskRepo, storyRepo).execute(task.id, "worker-1");

  const savedStory = await storyRepo.findById("story-1");
  assert.equal(savedStory?.status, StoryStatus.DOING);
});

test("CompleteTaskUseCase completes a doing task", async () => {
  const task = createTask(TaskStatus.DOING);
  const repo = new InMemoryTaskRepository([task]);

  await new CompleteTaskUseCase(repo).execute(task.id);

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.IN_REVIEW);
});

test("ReviewedTaskUseCase moves an in_review task to wait_accept", async () => {
  const task = createTask(TaskStatus.IN_REVIEW);
  const repo = new InMemoryTaskRepository([task]);

  await new ReviewedTaskUseCase(repo).execute(task.id);

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.WAIT_ACCEPT);
});

test("AcceptTaskUseCase accepts a wait_accept task", async () => {
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
  const repo = new InMemoryTaskRepository([task]);

  await new AcceptTaskUseCase(repo).execute(task.id);

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.ACCEPTED);
});

test("AcceptTaskUseCase accepts an in_review task", async () => {
  const task = createTask(TaskStatus.IN_REVIEW);
  const repo = new InMemoryTaskRepository([task]);

  await new AcceptTaskUseCase(repo).execute(task.id);

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.ACCEPTED);
});

test("AcceptTaskUseCase completes the linked story when all story tasks are accepted", async () => {
  const acceptedTask = new Task(
    "task-1",
    "project-1",
    "story-1",
    "Task 1",
    "desc",
    TaskStatus.ACCEPTED,
    null,
    null,
    null,
    1000,
    1000,
  );
  const reviewTask = new Task(
    "task-2",
    "project-1",
    "story-1",
    "Task 2",
    "desc",
    TaskStatus.WAIT_ACCEPT,
    null,
    null,
    null,
    1000,
    1000,
  );
  const taskRepo = new InMemoryTaskRepository([acceptedTask, reviewTask]);
  const storyRepo = new InMemoryStoryRepository([createStory(StoryStatus.DOING)]);

  await new AcceptTaskUseCase(taskRepo, storyRepo).execute(reviewTask.id);

  const savedStory = await storyRepo.findById("story-1");
  assert.equal(savedStory?.status, StoryStatus.DONE);
});

test("AcceptTaskUseCase does not complete a story while another task is still waiting", async () => {
  const doingTask = new Task(
    "task-1",
    "project-1",
    "story-1",
    "Task 1",
    "desc",
    TaskStatus.DOING,
    null,
    null,
    null,
    1000,
    1000,
  );
  const reviewTask = new Task(
    "task-2",
    "project-1",
    "story-1",
    "Task 2",
    "desc",
    TaskStatus.WAIT_ACCEPT,
    null,
    null,
    null,
    1000,
    1000,
  );
  const taskRepo = new InMemoryTaskRepository([doingTask, reviewTask]);
  const storyRepo = new InMemoryStoryRepository([createStory(StoryStatus.DOING)]);

  await new AcceptTaskUseCase(taskRepo, storyRepo).execute(reviewTask.id);

  const savedStory = await storyRepo.findById("story-1");
  assert.equal(savedStory?.status, StoryStatus.DOING);
});

test("RejectTaskUseCase rejects an in_review task", async () => {
  const task = createTask(TaskStatus.IN_REVIEW);
  const repo = new InMemoryTaskRepository([task]);

  await new RejectTaskUseCase(repo).execute(task.id, "Need tests");

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.REJECTED);
  assert.equal(savedTask?.rejectReason, "Need tests");
});

test("RejectTaskUseCase rejects a wait_accept task", async () => {
  const task = createTask(TaskStatus.WAIT_ACCEPT);
  const repo = new InMemoryTaskRepository([task]);

  await new RejectTaskUseCase(repo).execute(task.id, "Need manager follow-up");

  const savedTask = await repo.findById(task.id);
  assert.equal(savedTask?.status, TaskStatus.REJECTED);
  assert.equal(savedTask?.rejectReason, "Need manager follow-up");
});

test("CompleteTaskUseCase throws when task is missing", async () => {
  const repo = new InMemoryTaskRepository();

  await assert.rejects(() => new CompleteTaskUseCase(repo).execute("missing-task"), /not exists/);
});
