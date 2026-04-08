import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { rejectTaskUseCase } from "@container";
import { pushNotifier } from "@mcp/pushNotifier.ts";

type RejectTaskInput = {
  taskId: string;
  reason: string;
};

export const RejectTaskTool = {
  config: {
    title: "Reject Task",
    description: "Move an in_review task to rejected.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
      reason: z.string().min(1).describe("Reject reason"),
    },
  },
  execute: async ({ taskId, reason }: RejectTaskInput) => {
    await rejectTaskUseCase.execute(taskId, reason);
    await pushNotifier.notifyWorkerTaskRejected(taskId);
    return toTextResult(
      { taskId, status: "rejected", rejectReason: reason },
      `Rejected task ${taskId}.`,
    );
  },
};
