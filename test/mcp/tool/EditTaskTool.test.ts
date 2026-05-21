import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { EditTaskTool } from "@mcp/tool/EditTaskTool.ts";

const projectRepository = new SQLiteProjectRepository();
const taskRepository = new SQLiteTaskRepository();

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("project_membership").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("EditTaskTool returns the updated task", async () => {
  const project = await projectRepository.create(
    "Task Edit Tool Test",
    null,
    "test/mcp/tool/edit-task",
  );
  const task = await taskRepository.create("Initial Task", "before", project.id);

  const result = await EditTaskTool.execute({
    projectId: project.id,
    taskId: task.id,
    title: "Updated Task",
    description: "after",
  });

  assert.match(result.content[0]?.text ?? "", /Updated task /);
  assert.equal(result.structuredContent.id, task.id);
  assert.equal(result.structuredContent.projectId, project.id);
  assert.equal(result.structuredContent.title, "Updated Task");
  assert.equal(result.structuredContent.description, "after");
  assert.equal(result.structuredContent.status, "todo");
});
