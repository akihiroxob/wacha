import { z } from "zod";
import { listTaskRejectUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type ListTaskRejectInput = {
  taskId: string;
};

export const ListTaskRejectTool = {
  config: {
    title: "List Task Rejects",
    description: "List all reject records for a task.",
    inputSchema: {
      taskId: z.string().min(1).describe("Task ID"),
    },
  },
  execute: async ({ taskId }: ListTaskRejectInput) => {
    const result = await listTaskRejectUseCase.execute(taskId);
    return toTextResult(result, `Found ${result.rejects.length} reject records.`);
  },
};
