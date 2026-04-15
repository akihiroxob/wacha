import { z } from "zod";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { acceptTaskUseCase } from "@container";

type AcceptTaskInput = {
  taskId: string;
};

export const AcceptTaskTool = {
  config: {
    title: "Accept Task",
    description: "Move a wait_accept task to accepted as the final manager decision.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId }: AcceptTaskInput) => {
    await acceptTaskUseCase.execute(taskId);
    return toTextResult(
      { taskId, status: "accepted" },
      `Accepted task ${taskId} as the final manager decision.`,
    );
  },
};
