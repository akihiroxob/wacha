import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { reviewedTaskUseCase } from "@container";

type ReviewedTaskInput = {
  taskId: string;
};

export const ReviewedTaskTool = {
  config: {
    title: "Reviewed Task",
    description: "Move an in_review task to wait_accept.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId }: ReviewedTaskInput) => {
    await reviewedTaskUseCase.execute(taskId);
    return toTextResult({ taskId, status: "wait_accept" }, `Reviewed task ${taskId}.`);
  },
};
