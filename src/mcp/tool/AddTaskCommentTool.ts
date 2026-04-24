import { z } from "zod";
import { addTaskCommentUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type AddTaskCommentInput = {
  taskId: string;
  body: string;
  author?: string | null;
};

export const AddTaskCommentTool = {
  config: {
    title: "Add Task Comment",
    description: "Add a worker note or implementation comment to a task.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
      body: z.string().min(1).describe("Comment body"),
      author: z.string().optional().describe("Comment author"),
    },
  },
  execute: async ({ taskId, body, author }: AddTaskCommentInput) => {
    const comment = await addTaskCommentUseCase.execute(taskId, body, author ?? null);
    return toTextResult({ comment }, `Added comment ${comment.id} to task ${taskId}.`);
  },
};
