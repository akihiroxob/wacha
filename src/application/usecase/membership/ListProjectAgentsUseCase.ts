import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";

interface ListProjectAgentsUseCaseResult {
  projectId: string;
  summary: { total: number };
  agents: ProjectMembership[];
}

export class ListProjectAgentsUseCase {
  constructor(private projectMembershipRepository: ProjectMembershipRepository) {}

  async execute(projectId: string): Promise<ListProjectAgentsUseCaseResult> {
    const memberships = await this.projectMembershipRepository.findByProjectId(projectId);
    const agents = memberships.sort((a, b) => {
      if (a.role !== b.role) return a.role.localeCompare(b.role);
      return a.sessionId?.localeCompare(b.sessionId ?? "") ?? 0;
    });

    return {
      projectId,
      summary: { total: agents.length },
      agents,
    };
  }
}
