import { z } from "zod";
import { listTaskCommentUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type ListTaskCommentInput = {
  taskId: string;
};

export const ListTaskCommentTool = {
  config: {
    title: "List Task Comments",
    description: "List worker notes and implementation comments for a task.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId }: ListTaskCommentInput) => {
    const result = await listTaskCommentUseCase.execute(taskId);
    return toTextResult(result, `Found ${result.comments.length} task comments.`);
  },
};
