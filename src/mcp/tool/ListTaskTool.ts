import * as container from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";
import { z } from "zod";

type ListTaskToolInput = {
  projectId: string;
};

export const ListTaskTool = {
  config: {
    title: "List Tasks",
    description:
      "List tasks for a project with summary counts for todo, doing, in_review, wait_accept, accepted, and rejected.",
    inputSchema: {
      projectId: z.string().min(1).describe("Project ID"),
    },
  },
  execute: async ({ projectId }: ListTaskToolInput) => {
    const result = await container.listTaskUseCase.execute(projectId);
    return toTextResult(result, `Returned ${result.summary.total} tasks with summary.`);
  },
};
