import { z } from "zod";
import { listProjectAgentsUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type ListProjectAgentsInput = {
  projectId: string;
};

export const ListProjectAgentsTool = {
  config: {
    title: "List Project Agents",
    description: "List project agents with worker, role, and current MCP session status.",
    inputSchema: {
      projectId: z.string().min(1).describe("Project ID"),
    },
  },
  execute: async ({ projectId }: ListProjectAgentsInput) => {
    const result = await listProjectAgentsUseCase.execute(projectId);
    return toTextResult(
      result,
      `Returned ${result.summary.total} project agents (${result.summary.online} online).`,
    );
  },
};
