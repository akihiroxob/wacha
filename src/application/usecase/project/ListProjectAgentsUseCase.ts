import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";

export interface ProjectAgent {
  membershipId: string;
  projectId: string;
  workerId: string;
  role: ProjectRole;
  sessionId: string | null;
  online: boolean;
  lastHeartbeatAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface ListProjectAgentsUseCaseResult {
  projectId: string;
  summary: {
    total: number;
    online: number;
    offline: number;
  };
  agents: ProjectAgent[];
}

export class ListProjectAgentsUseCase {
  constructor(
    private projectMembershipRepository: ProjectMembershipRepository,
    private getSessionIdByWorkerId: (workerId: string) => string | undefined,
  ) {}

  async execute(projectId: string): Promise<ListProjectAgentsUseCaseResult> {
    const memberships = await this.projectMembershipRepository.findByProjectId(projectId);
    const agents = memberships
      .map((membership) => {
        const sessionId = this.getSessionIdByWorkerId(membership.workerId) ?? null;

        return {
          membershipId: membership.id,
          projectId: membership.projectId,
          workerId: membership.workerId,
          role: membership.role,
          sessionId,
          online: sessionId !== null,
          lastHeartbeatAt: membership.lastHeartbeatAt,
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        };
      })
      .sort((a, b) => {
        if (a.online !== b.online) return Number(b.online) - Number(a.online);
        if (a.role !== b.role) return a.role.localeCompare(b.role);
        return a.workerId.localeCompare(b.workerId);
      });

    const online = agents.filter((agent) => agent.online).length;

    return {
      projectId,
      summary: {
        total: agents.length,
        online,
        offline: agents.length - online,
      },
      agents,
    };
  }
}
