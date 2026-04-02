import test from "node:test";
import assert from "node:assert/strict";

import { Story } from "@domain/model/Story.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { ListStoryUseCase } from "@application/usecase/stories/ListStoryUseCase.ts";
import { IssueStoryUseCase } from "@application/usecase/stories/IssueStoryUseCase.ts";
import { ClaimStoryUseCase } from "@application/usecase/stories/ClaimStoryUseCase.ts";
import { CompleteStoryUseCase } from "@application/usecase/stories/CompleteStoryUseCase.ts";
import { CancelStoryUseCase } from "@application/usecase/stories/CancelStoryUseCase.ts";

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
