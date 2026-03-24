import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { Story } from "@domain/model/Story.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteStoryRepository } from "@repository/SQLiteStoryRepository.ts";

const projectRepository = new SQLiteProjectRepository();
const storyRepository = new SQLiteStoryRepository();

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_membership").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();

  await projectRepository.create("Wacha", null, "repo/wacha");
});

test("SQLiteStoryRepository.create persists a story", async () => {
  const [project] = await projectRepository.findAll();
  const story = await storyRepository.create(project.id, "MCP support", "Add task tools");

  const savedStory = await storyRepository.findById(story.id);

  assert.equal(savedStory?.projectId, project.id);
  assert.equal(savedStory?.title, "MCP support");
  assert.equal(savedStory?.status, StoryStatus.TODO);
});

test("SQLiteStoryRepository.findByProjectId returns project stories", async () => {
  const [project] = await projectRepository.findAll();
  await storyRepository.create(project.id, "Story 1", null);
  await storyRepository.create(project.id, "Story 2", null);

  const stories = await storyRepository.findByProjectId(project.id);

  assert.equal(stories.length, 2);
});

test("SQLiteStoryRepository.save updates an existing story", async () => {
  const [project] = await projectRepository.findAll();
  const story = await storyRepository.create(project.id, "Story 1", null);
  story.changeTitle("Story 1 updated");
  story.claim();

  await storyRepository.save(story);

  const savedStory = await storyRepository.findById(story.id);
  assert.equal(savedStory?.title, "Story 1 updated");
  assert.equal(savedStory?.status, StoryStatus.DOING);
});

test("SQLiteStoryRepository.save throws for a missing story", async () => {
  const story = new Story(
    "missing-story",
    "project-1",
    "Missing",
    null,
    StoryStatus.TODO,
    1000,
    1000,
  );

  await assert.rejects(() => storyRepository.save(story), /Story not found/);
});
