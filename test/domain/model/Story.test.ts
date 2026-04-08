import test from "node:test";
import assert from "node:assert/strict";

import { Story } from "@domain/model/Story.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";

function createStory(status: StoryStatus = StoryStatus.TODO) {
  return new Story("story-1", "project-1", "Refactor MCP", "desc", status, 1000, 1000);
}

test("Story belongs to a project and can be completed", () => {
  const story = createStory(StoryStatus.DOING);

  story.complete();

  assert.equal(story.projectId, "project-1");
  assert.equal(story.status, StoryStatus.DONE);
});

test("Story.claim changes status from todo to doing", () => {
  const story = createStory(StoryStatus.TODO);

  story.claim();

  assert.equal(story.status, StoryStatus.DOING);
});

test("Story.cancel changes status from doing to canceled", () => {
  const story = createStory(StoryStatus.DOING);

  story.cancel();

  assert.equal(story.status, StoryStatus.CANCELED);
});

test("Story.claim throws when status is not todo", () => {
  const story = createStory(StoryStatus.DOING);

  assert.throws(() => story.claim(), /todo status/);
});

test("Story.complete throws when status is not doing", () => {
  const story = createStory(StoryStatus.TODO);

  assert.throws(() => story.complete(), /doing status/);
});

test("Story.cancel throws when status is not doing", () => {
  const story = createStory(StoryStatus.TODO);

  assert.throws(() => story.cancel(), /doing status/);
});

test("Story can clear its description", () => {
  const story = createStory();

  story.changeDescription("");

  assert.equal(story.description, null);
});
