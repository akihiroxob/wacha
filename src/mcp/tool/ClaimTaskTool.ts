import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { claimTaskUseCase } from "@container";

type ClaimTaskInput = {
  taskId: string;
  sessionId: string;
};

export const ClaimTaskTool = {
  config: {
    title: "Claim Task",
    description: "Assign a todo task to a worker and move it to doing.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId, sessionId }: ClaimTaskInput) => {
    await claimTaskUseCase.execute(taskId, sessionId);
    return toTextResult({ taskId, sessionId, status: "doing" }, `Claimed task ${taskId}.`);
  },
};
