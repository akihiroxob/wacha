import type { ProjectRole } from "@constants/ProjectRole.ts";
import type { ToolContext } from "./types/ToolContext.ts";

export const withRoleGuard = <TArgs>(
  allowRoles: ProjectRole[],
  contexts: ToolContext,
  execute: any,
) => {
  return async (args: TArgs) => {
    return execute(args);
  };
};
