import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as container from "container.ts";

export const TaskListTool = (server: McpServer) =>
  server.registerTool(
    "task_list",
    {
      title: "List Tasks",
      description: "List all tasks with summary information.",
    },
    async () => {
      const result = await container.listTaskUseCase.execute();
      return {
        content: [
          {
            type: "text" as const,
            text: `Returned ${result.summary.total} tasks with status summary.`,
          },
        ],
        structuredContent: result as Record<string, any>,
      };
    },
  );
