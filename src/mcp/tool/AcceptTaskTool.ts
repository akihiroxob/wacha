import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { acceptTaskUseCase } from "@container";

type AcceptTaskInput = {
  taskId: string;
  sessionId: string;
};

export const AcceptTaskTool = {
  config: {
    title: "Accept Task",
    description: "Move an in_review or wait_accept task to accepted as the final manager decision.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId, sessionId }: AcceptTaskInput) => {
    await acceptTaskUseCase.execute(taskId, sessionId);
    return toTextResult(
      { taskId, status: "accepted" },
      `Accepted task ${taskId} as the final manager decision from review.`,
    );
  },
};
