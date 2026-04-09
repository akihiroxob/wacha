import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";

export class MembershipService {
  constructor(private projectMembershipRepository: ProjectMembershipRepository) {}

  async getMembershipsByProjectId(projectId: string) {
    return await this.projectMembershipRepository.findByProjectId(projectId);
  }

  async getRolesBySessionId(sessionId: string): Promise<ProjectRole[]> {
    const memberships = await this.projectMembershipRepository.findBySessionId(sessionId);
    return memberships.map((membership) => membership.role);
  }

  async removeMembershipBySessionId(sessionId: string): Promise<void> {
    await this.projectMembershipRepository.deleteBySessionId(sessionId);
  }

  async clear(): Promise<void> {
    await this.projectMembershipRepository.clear();
  }
}
