import type { ProjectRole } from "@constants/ProjectRole.ts";
import type { ProjectGrantRepository } from "@domain/repository/ProjectGrantRepository.ts";

export class RevokeProjectRoleUseCase {
  constructor(private readonly projectGrantRepository: ProjectGrantRepository) {}

  async execute(projectId: string, principalId: string, role: ProjectRole): Promise<void> {
    await this.projectGrantRepository.revoke(projectId, principalId, role);
  }
}
