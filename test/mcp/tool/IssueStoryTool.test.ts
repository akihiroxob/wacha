import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { IssueStoryTool } from "@mcp/tool/IssueStoryTool.ts";

const projectRepository = new SQLiteProjectRepository();

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_membership").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("IssueStoryTool returns requiredNextTool while preserving created story fields", async () => {
  const project = await projectRepository.create(
    "IssueStoryTool Test",
    null,
    "test/mcp/tool/issue-story",
  );
  const result = await IssueStoryTool.execute({
    projectId: project.id,
    title: "New Story",
    description: "details",
  });

  assert.equal(result.content[0]?.type, "text");
  assert.match(result.content[0]?.text ?? "", /Created story /);

  assert.equal(result.structuredContent.projectId, project.id);
  assert.equal(result.structuredContent.title, "New Story");
  assert.equal(result.structuredContent.description, "details");
  assert.equal(result.structuredContent.status, "todo");
  assert.equal(result.structuredContent.requiredNextTool, "issue_task");
  assert.equal(typeof result.structuredContent.id, "string");
  assert.equal(typeof result.structuredContent.createdAt, "number");
  assert.equal(typeof result.structuredContent.updatedAt, "number");
});
