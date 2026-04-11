import { z } from "zod";
import { instructionService } from "@container";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

type GetRoleInstructionsInput = {
  role: string;
  includeShared?: boolean;
};

export const GetRoleInstructionsTool = {
  config: {
    title: "Get Role Instructions",
    description: "Get instructions for a specific project role.",
    inputSchema: {
      role: z.string().min(1).describe("Project role to get instructions for"),
      includeShared: z.boolean().optional().describe("Whether to include shared instructions"),
    },
  },
  execute: async ({ role, includeShared = false }: GetRoleInstructionsInput) => {
    const projectRole = role as ProjectRole;
    const roleContent = await instructionService.getInstructionContent(projectRole);
    const policyContent = includeShared
      ? await instructionService.getInstructionContent("role-policy")
      : null;
    return toTextResult({
      role,
      includeShared,
      files: [
        {
          path: "agent/role-policy.md",
          kind: "shared",
          content: policyContent,
        },
        {
          path: `agent/${projectRole}.md`,
          kind: "role",
          content: roleContent,
        },
      ],
    });
  },
};
