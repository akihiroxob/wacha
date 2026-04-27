import { z } from "zod";
import { listSkillUseCase } from "@container";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { SkillStatus } from "@constants/SkillStatus.ts";
import { toTextResult } from "@mcp/utils/mcpUtils.ts";

const statusValues = [SkillStatus.DRAFT, SkillStatus.ACTIVE, SkillStatus.DEPRECATED] as const;
const roleValues = [
  ProjectRole.MANAGER,
  ProjectRole.REVIEWER,
  ProjectRole.WORKER,
  ProjectRole.VIEWER,
] as const;

type ListSkillsInput = {
  status?: (typeof statusValues)[number];
  role?: (typeof roleValues)[number];
};

export const ListSkillsTool = {
  config: {
    title: "List Skills",
    description: "List available skills, optionally filtered by status and project role.",
    inputSchema: {
      status: z.enum(statusValues).optional().describe("Optional skill status to filter by"),
      role: z.enum(roleValues).optional().describe("Optional project role to filter by"),
    },
  },
  execute: async ({ status, role }: ListSkillsInput) => {
    const result = await listSkillUseCase.execute({ status, role });
    const summarySkills = result.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      status: skill.status,
      version: skill.version,
      allowRoles: skill.allowRoles,
      requiredKnowledge: skill.requiredKnowledge,
      requiredTools: skill.requiredTools,
    }));

    return toTextResult(
      {
        filters: { status: status ?? null, role: role ?? null },
        skills: summarySkills,
      },
      `Returned ${result.skills.length} skills.`,
    );
  },
};
