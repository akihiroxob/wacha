import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { rejectTaskUseCase } from "@container";

type RejectTaskInput = {
  taskId: string;
  reason: string;
};

export const RejectTaskTool = {
  config: {
    title: "Reject Task",
    description:
      "Move an in_review or wait_accept task to rejected with a reason for rework or requirement mismatch.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
      reason: z.string().min(1).describe("Reject reason"),
    },
  },
  execute: async ({ taskId, reason }: RejectTaskInput) => {
    await rejectTaskUseCase.execute(taskId, reason);
    return toTextResult(
      { taskId, status: "rejected", rejectReason: reason },
      `Rejected task ${taskId} with a reason for follow-up.`,
    );
  },
};
