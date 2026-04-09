import type { ProjectRole } from "@constants/ProjectRole.ts";
import type { ToolContext } from "@domain/model/ToolContext.js";
import { membershipService } from "@container";

export const withRoleGuard = <TArgs>(
  allowRoles: ProjectRole[],
  context: ToolContext,
  execute: any,
) => {
  return async (args: TArgs) => {
    const { workerId, sessionId } = context;
    if (!workerId || !sessionId) {
      throw new Error("Unauthorized: No workerId or sessionId in context");
    }
    const roles = await membershipService.getRolesByWorkerId(workerId);
    const hasRole = roles.some((role) => allowRoles.includes(role));
    if (!hasRole) {
      throw new Error("Forbidden: Agent does not have required role");
    }

    return execute(args);
  };
};
