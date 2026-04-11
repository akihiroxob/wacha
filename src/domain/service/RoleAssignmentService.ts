import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";

const SINGLE_ASSIGNMENT_ROLES: ProjectRole[] = [ProjectRole.MANAGER, ProjectRole.REVIEWER];
const RECOMMENDED_ROLE_ORDER: ProjectRole[] = [
  ProjectRole.MANAGER,
  ProjectRole.REVIEWER,
  ProjectRole.WORKER,
];

export class RoleAssignmentService {
  suggestRole(projectMemberships: ProjectMembership[], sessionId: string): ProjectRole {
    for (const role of RECOMMENDED_ROLE_ORDER) {
      if (this.workerAlreadyHasRole(projectMemberships, sessionId, role)) {
        continue;
      }
      if (this.isRoleAvailable(projectMemberships, role)) {
        return role;
      }
    }

    throw new Error("No available role for sessionId: " + sessionId);
  }

  resolveRequestedRole(
    projectMemberships: ProjectMembership[],
    sessionId: string,
    requestedRole: ProjectRole,
  ): ProjectRole {
    if (this.workerAlreadyHasRole(projectMemberships, sessionId, requestedRole)) {
      return requestedRole;
    }

    if (!this.isRoleAvailable(projectMemberships, requestedRole)) {
      throw new Error(
        `Requested role(${requestedRole}) is not available for sessionId: ${sessionId}`,
      );
    }

    return requestedRole;
  }

  private workerAlreadyHasRole(
    projectMemberships: ProjectMembership[],
    sessionId: string,
    role: ProjectRole,
  ): boolean {
    return projectMemberships.some(
      (projectMembership) =>
        projectMembership.sessionId === sessionId && projectMembership.role === role,
    );
  }

  private isRoleAvailable(projectMemberships: ProjectMembership[], role: ProjectRole): boolean {
    if (!SINGLE_ASSIGNMENT_ROLES.includes(role)) {
      return true;
    }

    return !projectMemberships.some((projectMembership) => projectMembership.role === role);
  }
}
