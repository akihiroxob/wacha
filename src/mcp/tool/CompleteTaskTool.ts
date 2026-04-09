import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { completeTaskUseCase, pushNotifier } from "@container";

type CompleteTaskInput = {
  taskId: string;
};

export const CompleteTaskTool = {
  config: {
    title: "Complete Task",
    description: "Move a doing task to in_review.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId }: CompleteTaskInput) => {
    await completeTaskUseCase.execute(taskId);
    await pushNotifier.notifyReviewersTaskInReview(taskId);
    return toTextResult({ taskId, status: "in_review" }, `Completed task ${taskId}.`);
  },
};
