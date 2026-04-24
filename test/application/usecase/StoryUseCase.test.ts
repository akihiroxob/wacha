import test from "node:test";
import assert from "node:assert/strict";

import { Story } from "@domain/model/Story.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { ListStoryUseCase } from "@application/usecase/stories/ListStoryUseCase.ts";
import { IssueStoryUseCase } from "@application/usecase/stories/IssueStoryUseCase.ts";
import { EditStoryUseCase } from "@application/usecase/stories/EditStoryUseCase.ts";
import { ClaimStoryUseCase } from "@application/usecase/stories/ClaimStoryUseCase.ts";
import { CompleteStoryUseCase } from "@application/usecase/stories/CompleteStoryUseCase.ts";
import { CancelStoryUseCase } from "@application/usecase/stories/CancelStoryUseCase.ts";
import { DeleteStoryUseCase } from "@application/usecase/stories/DeleteStoryUseCase.ts";
import { Task } from "@domain/model/Task.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { TaskComment } from "@domain/model/TaskComment.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";

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
      1000 + this.stories.size,
      1000 + this.stories.size,
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

  async addComment(taskId: string, body: string, author?: string | null): Promise<TaskComment> {
    return new TaskComment("comment-1", taskId, body, author ?? null, 1000);
  }

  async findCommentsByTaskId(_taskId: string): Promise<TaskComment[]> {
    return [];
  }

  async findCommentsByTaskIds(_taskIds: string[]): Promise<TaskComment[]> {
    return [];
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

function createStory(
  id: string,
  status: StoryStatus,
  createdAt: number,
  projectId = "project-1",
) {
  return new Story(id, projectId, `Story ${id}`, "desc", status, createdAt, createdAt);
}

test("ListStoryUseCase returns project stories in created order", async () => {
  const repo = new InMemoryStoryRepository([
    createStory("story-2", StoryStatus.TODO, 2000),
    createStory("story-1", StoryStatus.TODO, 1000),
    createStory("story-3", StoryStatus.TODO, 1500, "project-2"),
  ]);

  const result = await new ListStoryUseCase(repo).execute("project-1");

  assert.equal(result.stories.length, 2);
  assert.equal(result.stories[0]?.id, "story-1");
  assert.equal(result.stories[1]?.id, "story-2");
});

test("ListStoryUseCase filters stories by status", async () => {
  const repo = new InMemoryStoryRepository([
    createStory("story-1", StoryStatus.TODO, 1000),
    createStory("story-2", StoryStatus.DOING, 2000),
    createStory("story-3", StoryStatus.TODO, 3000),
  ]);

  const result = await new ListStoryUseCase(repo).execute("project-1", StoryStatus.TODO);

  assert.equal(result.stories.length, 2);
  assert.equal(result.stories[0]?.id, "story-1");
  assert.equal(result.stories[1]?.id, "story-3");
});

test("IssueStoryUseCase creates a todo story", async () => {
  const repo = new InMemoryStoryRepository();

  const story = await new IssueStoryUseCase(repo).execute("project-1", "New Story", "details");

  assert.equal(story.projectId, "project-1");
  assert.equal(story.title, "New Story");
  assert.equal(story.description, "details");
  assert.equal(story.status, StoryStatus.TODO);
});

test("EditStoryUseCase updates title and description", async () => {
  const story = createStory("story-1", StoryStatus.TODO, 1000);
  const repo = new InMemoryStoryRepository([story]);

  const updated = await new EditStoryUseCase(repo).execute("project-1", story.id, "Updated Story", "new details");

  assert.equal(updated.title, "Updated Story");
  assert.equal(updated.description, "new details");
  assert.ok(updated.updatedAt >= story.updatedAt);
});

test("ClaimStoryUseCase moves a todo story to doing", async () => {
  const story = createStory("story-1", StoryStatus.TODO, 1000);
  const repo = new InMemoryStoryRepository([story]);

  await new ClaimStoryUseCase(repo).execute(story.id);

  const savedStory = await repo.findById(story.id);
  assert.equal(savedStory?.status, StoryStatus.DOING);
});

test("CompleteStoryUseCase moves a doing story to done", async () => {
  const story = createStory("story-1", StoryStatus.DOING, 1000);
  const repo = new InMemoryStoryRepository([story]);

  await new CompleteStoryUseCase(repo).execute(story.id);

  const savedStory = await repo.findById(story.id);
  assert.equal(savedStory?.status, StoryStatus.DONE);
});

test("CancelStoryUseCase moves a doing story to canceled", async () => {
  const story = createStory("story-1", StoryStatus.DOING, 1000);
  const repo = new InMemoryStoryRepository([story]);

  await new CancelStoryUseCase(repo).execute(story.id);

  const savedStory = await repo.findById(story.id);
  assert.equal(savedStory?.status, StoryStatus.CANCELED);
});

test("ClaimStoryUseCase throws when story is missing", async () => {
  const repo = new InMemoryStoryRepository();

  await assert.rejects(() => new ClaimStoryUseCase(repo).execute("missing-story"), /Story not found/);
});

test("EditStoryUseCase throws when story is missing", async () => {
  const repo = new InMemoryStoryRepository();

  await assert.rejects(
    () => new EditStoryUseCase(repo).execute("project-1", "missing-story", "Updated Story", "details"),
    /Story not found/,
  );
});

test("EditStoryUseCase throws when project does not match", async () => {
  const story = createStory("story-1", StoryStatus.TODO, 1000, "project-2");
  const repo = new InMemoryStoryRepository([story]);

  await assert.rejects(
    () => new EditStoryUseCase(repo).execute("project-1", story.id, "Updated Story", "details"),
    /specified project/,
  );
});

test("CompleteStoryUseCase throws when story is not doing", async () => {
  const story = createStory("story-1", StoryStatus.TODO, 1000);
  const repo = new InMemoryStoryRepository([story]);

  await assert.rejects(() => new CompleteStoryUseCase(repo).execute(story.id), /doing status/);
});

test("CancelStoryUseCase throws when story is not doing", async () => {
  const story = createStory("story-1", StoryStatus.TODO, 1000);
  const repo = new InMemoryStoryRepository([story]);

  await assert.rejects(() => new CancelStoryUseCase(repo).execute(story.id), /doing status/);
});

test("DeleteStoryUseCase deletes a todo story and its tasks", async () => {
  const story = createStory("story-1", StoryStatus.TODO, 1000);
  const storyRepo = new InMemoryStoryRepository([story]);
  const taskRepo = new InMemoryTaskRepository([
    new Task("task-1", "project-1", "story-1", "Task 1", "desc", TaskStatus.TODO, null, null, null, 1000, 1000),
  ]);

  await new DeleteStoryUseCase(storyRepo, taskRepo).execute(story.id);

  assert.equal(await storyRepo.findById(story.id), null);
  assert.equal(await taskRepo.findById("task-1"), null);
});

test("DeleteStoryUseCase deletes a canceled story", async () => {
  const story = createStory("story-1", StoryStatus.CANCELED, 1000);
  const storyRepo = new InMemoryStoryRepository([story]);
  const taskRepo = new InMemoryTaskRepository();

  await new DeleteStoryUseCase(storyRepo, taskRepo).execute(story.id);

  assert.equal(await storyRepo.findById(story.id), null);
});

test("DeleteStoryUseCase rejects statuses other than todo or canceled", async () => {
  const story = createStory("story-1", StoryStatus.DOING, 1000);
  const storyRepo = new InMemoryStoryRepository([story]);
  const taskRepo = new InMemoryTaskRepository();

  await assert.rejects(
    () => new DeleteStoryUseCase(storyRepo, taskRepo).execute(story.id),
    /Only todo or canceled story can be deleted/,
  );
});
