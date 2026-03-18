import * as container from "@container";
import { toTextResult } from "@utils/mcpUtils.ts";

export const ListTaskTool = {
  config: {
    title: "List Tasks",
    description: "List all tasks with summary information.",
  },
  execute: async () => {
    const result = await container.listTaskUseCase.execute();
    return toTextResult(result, `Returned ${result.summary.total} tasks with status summary.`);
  },
};
