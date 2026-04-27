import { z } from "zod";
import { getSkillContextUseCase } from "@container";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type GetSkillContextInput = {
  skillName: string;
};

export const GetSkillContextTool = {
  config: {
    title: "Get Skill Context",
    description: "Get a skill and its required knowledge context by skill name.",
    inputSchema: {
      skillName: z.string().min(1).describe("Skill name to load"),
    },
  },
  execute: async ({ skillName }: GetSkillContextInput) => {
    const result = await getSkillContextUseCase.execute({ skillName });
    return toTextResult(result, `Returned skill context for ${result.skill.name}.`);
  },
};
