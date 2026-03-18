import { z } from "zod";
import { toTextResult } from "@utils/mcpUtils.ts";
import { rejectTaskUseCase } from "@container";

type RejectTaskInput = {
  taskId: string;
};

export const RejectTaskTool = {
  config: {
    title: "Reject Task",
    description: "Move an in_review task to rejected.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId }: RejectTaskInput) => {
    await rejectTaskUseCase.execute(taskId);
    return toTextResult({ taskId, status: "rejected" }, `Rejected task ${taskId}.`);
  },
};
