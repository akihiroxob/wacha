import { z } from "zod";
import { listProjectUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

export const ListProjectTool = {
  config: {
    title: "List Projects",
    description: "List all projects.",
    inputSchema: {},
  },
  execute: async (_input: z.infer<z.ZodObject<{}>>) => {
    const result = await listProjectUseCase.execute();
    return toTextResult(result, `Returned ${result.projects.length} projects.`);
  },
};
