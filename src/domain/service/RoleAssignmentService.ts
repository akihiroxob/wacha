import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";

const SINGLE_ASSIGNMENT_ROLES: ProjectRole[] = [ProjectRole.MANAGER, ProjectRole.REVIEWER];
const RECOMMENDED_ROLE_ORDER: ProjectRole[] = [
  ProjectRole.MANAGER,
  ProjectRole.REVIEWER,
  ProjectRole.WORKER,
];

// 専有席の生死判定に使う文脈。未指定なら席の明け渡しは行わない(全席を生存扱い)
export type SeatLiveness = {
  isSessionLive: (sessionId: string) => boolean;
  now: number;
  staleThresholdMs: number;
};

export class RoleAssignmentService {
  suggestRole(
    projectMemberships: ProjectMembership[],
    sessionId: string,
    liveness?: SeatLiveness,
  ): ProjectRole {
    for (const role of RECOMMENDED_ROLE_ORDER) {
      if (this.workerAlreadyHasRole(projectMemberships, sessionId, role)) {
        continue;
      }
      if (this.isRoleAvailable(projectMemberships, role, liveness)) {
        return role;
      }
    }

    throw new Error("No available role for sessionId: " + sessionId);
  }

  resolveRequestedRole(
    projectMemberships: ProjectMembership[],
    sessionId: string,
    requestedRole: ProjectRole,
    liveness?: SeatLiveness,
  ): ProjectRole {
    if (this.workerAlreadyHasRole(projectMemberships, sessionId, requestedRole)) {
      return requestedRole;
    }

    if (!this.isRoleAvailable(projectMemberships, requestedRole, liveness)) {
      throw new Error(
        `Requested role(${requestedRole}) is not available for sessionId: ${sessionId}`,
      );
    }

    return requestedRole;
  }

  /**
   * 指定ロールの席のうち、明け渡し可能な(セッションが死んでいる、または heartbeat が失効した)
   * membership を返す。解放の永続化は呼び出し側が行う。要求されたロールの席だけが対象で、
   * 無関係なロールの席には触れない。
   */
  findReleasableSeatHolders(
    projectMemberships: ProjectMembership[],
    role: ProjectRole,
    liveness: SeatLiveness,
  ): ProjectMembership[] {
    if (!SINGLE_ASSIGNMENT_ROLES.includes(role)) {
      return [];
    }
    return projectMemberships.filter(
      (projectMembership) =>
        projectMembership.role === role && this.isSeatReleasable(projectMembership, liveness),
    );
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

  private isRoleAvailable(
    projectMemberships: ProjectMembership[],
    role: ProjectRole,
    liveness?: SeatLiveness,
  ): boolean {
    if (!SINGLE_ASSIGNMENT_ROLES.includes(role)) {
      return true;
    }

    // 席を持つ全員が明け渡し可能なら、その席は空きとして扱う
    return projectMemberships
      .filter((projectMembership) => projectMembership.role === role)
      .every(
        (projectMembership) =>
          liveness !== undefined && this.isSeatReleasable(projectMembership, liveness),
      );
  }

  private isSeatReleasable(
    projectMembership: ProjectMembership,
    liveness: SeatLiveness,
  ): boolean {
    return (
      !liveness.isSessionLive(projectMembership.sessionId) ||
      projectMembership.lastHeartbeatAt === null ||
      liveness.now - projectMembership.lastHeartbeatAt > liveness.staleThresholdMs
    );
  }
}
