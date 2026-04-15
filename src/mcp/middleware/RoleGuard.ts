import type { ProjectRole } from "@constants/ProjectRole.ts";
import type { ToolContext } from "@domain/model/ToolContext.js";
import { membershipService } from "@container";
import { ProjectRole as ProjectRoleEnum } from "@constants/ProjectRole.ts";

export const canIssueTask = (roles: ProjectRole[], storyId?: string) => {
  if (roles.includes(ProjectRoleEnum.MANAGER)) {
    return true;
  }

  return !storyId && roles.includes(ProjectRoleEnum.REVIEWER);
};

export const withRoleGuard = <TArgs>(
  allowRoles: ProjectRole[],
  context: ToolContext,
  execute: any,
) => {
  return async (args: TArgs) => {
    const { sessionId } = context;
    if (!sessionId) {
      throw new Error("Unauthorized: No sessionId in context");
    }
    const roles = await membershipService.getRolesBySessionId(sessionId);
    const hasRole = roles.some((role) => allowRoles.includes(role));
    if (!hasRole) {
      throw new Error("Forbidden: Agent does not have required role");
    }

    return execute(args);
  };
};
