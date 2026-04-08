import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { claimTaskUseCase } from "@container";

type ClaimTaskInput = {
  taskId: string;
  workerId: string;
};

export const ClaimTaskTool = {
  config: {
    title: "Claim Task",
    description: "Assign a todo task to a worker and move it to doing.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
      workerId: z.string().min(1).describe("Worker ID"),
    },
  },
  execute: async ({ taskId, workerId }: ClaimTaskInput) => {
    await claimTaskUseCase.execute(taskId, workerId);
    return toTextResult({ taskId, workerId, status: "doing" }, `Claimed task ${taskId}.`);
  },
};
