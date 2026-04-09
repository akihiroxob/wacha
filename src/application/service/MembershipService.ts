import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";

export class MembershipService {
  constructor(private projectMembershipRepository: ProjectMembershipRepository) {}

  async getMembershipsByProjectId(projectId: string) {
    return await this.projectMembershipRepository.findByProjectId(projectId);
  }

  async getRolesByWorkerId(workerId: string): Promise<ProjectRole[]> {
    const memberships = await this.projectMembershipRepository.findByWorkerId(workerId);
    return memberships.map((membership) => membership.role);
  }

  async removeMembershipByWorkerId(workerId: string): Promise<void> {
    await this.projectMembershipRepository.deleteByWorkerId(workerId);
  }

  async clear(): Promise<void> {
    await this.projectMembershipRepository.clear();
  }
}
