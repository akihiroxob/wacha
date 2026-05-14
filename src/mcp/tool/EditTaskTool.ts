import { z } from "zod";
import { editTaskUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type EditTaskInput = {
  projectId: string;
  taskId: string;
  title: string;
  description?: string;
};

export const EditTaskTool = {
  config: {
    title: "Edit Task",
    description: "Update an existing task title and description.",
    inputSchema: {
      projectId: z.string().min(1).describe("Project ID"),
      taskId: z.string().min(1).describe("Task ID"),
      title: z.string().min(1).describe("Updated task title"),
      description: z.string().optional().describe("Updated task description"),
    },
  },
  execute: async ({ projectId, taskId, title, description }: EditTaskInput) => {
    const task = await editTaskUseCase.execute(projectId, taskId, title, description ?? null);
    return toTextResult(task, `Updated task ${task.id}.`);
  },
};
