import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteStoryRepository } from "@repository/SQLiteStoryRepository.ts";
import { EditStoryTool } from "@mcp/tool/EditStoryTool.ts";

const projectRepository = new SQLiteProjectRepository();
const storyRepository = new SQLiteStoryRepository();

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_membership").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("EditStoryTool returns the updated story", async () => {
  const project = await projectRepository.create(
    "Story Edit Tool Test",
    null,
    "test/mcp/tool/edit-story",
  );
  const story = await storyRepository.create(project.id, "Initial Story", "before");

  const result = await EditStoryTool.execute({
    projectId: project.id,
    storyId: story.id,
    title: "Updated Story",
    description: "after",
  });

  assert.match(result.content[0]?.text ?? "", /Updated story /);
  assert.equal(result.structuredContent.id, story.id);
  assert.equal(result.structuredContent.projectId, project.id);
  assert.equal(result.structuredContent.title, "Updated Story");
  assert.equal(result.structuredContent.description, "after");
  assert.equal(result.structuredContent.status, "todo");
});
