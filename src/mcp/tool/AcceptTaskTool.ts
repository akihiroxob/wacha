import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { acceptTaskUseCase } from "@container";

type AcceptTaskInput = {
  taskId: string;
};

export const AcceptTaskTool = {
  config: {
    title: "Accept Task",
    description: "Move an in_review task to accepted.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId }: AcceptTaskInput) => {
    await acceptTaskUseCase.execute(taskId);
    return toTextResult({ taskId, status: "accepted" }, `Accepted task ${taskId}.`);
  },
};
