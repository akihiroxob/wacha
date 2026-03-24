import { z } from "zod";
import { assignProjectRoleUseCase } from "@container";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { toTextResult } from "@utils/mcpUtils.ts";

type AssignToolInput = {
  baseDir: string;
  projectName: string;
  description?: string;
  workerId: string;
  requestedRole?: ProjectRole;
};

export const AssignTool = {
  config: {
    title: "Assign Project Role",
    description:
      "Find or create a project, then assign the worker a requested or recommended role.",
    inputSchema: {
      baseDir: z.string().min(1).describe("Project base directory"),
      projectName: z.string().min(1).describe("Project name"),
      description: z.string().optional().describe("Optional project description"),
      workerId: z.string().min(1).describe("Worker identifier"),
      requestedRole: z
        .enum([ProjectRole.MANAGER, ProjectRole.REVIEWER, ProjectRole.WORKER])
        .optional()
        .describe("Optional requested role"),
    },
  },
  execute: async ({ baseDir, projectName, description, workerId, requestedRole }: AssignToolInput) => {
    const result = await assignProjectRoleUseCase.execute({
      baseDir,
      projectName,
      description: description ?? null,
      workerId,
      requestedRole,
    });

    return toTextResult({
      projectId: result.project.id,
      projectName: result.project.name,
      role: result.projectMembership.role,
      createdProject: result.createdProject,
      createdProjectMembership: result.createdProjectMembership,
    });
  },
};
