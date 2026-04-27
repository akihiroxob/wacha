import { z } from "zod";
import { listSkillUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

export const ListSkillsTool = {
  config: {
    title: "List Skills",
    description: "List all available skills.",
    inputSchema: {},
  },
  execute: async (_input: z.infer<z.ZodObject<{}>>) => {
    const result = await listSkillUseCase.execute();
    return toTextResult(result, `Returned ${result.skills.length} skills.`);
  },
};
