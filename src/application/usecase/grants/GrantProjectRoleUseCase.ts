import type { ProjectRole } from "@constants/ProjectRole.ts";
import type { ProjectGrantRepository } from "@domain/repository/ProjectGrantRepository.ts";

export class GrantProjectRoleUseCase {
  constructor(private readonly projectGrantRepository: ProjectGrantRepository) {}

  async execute(projectId: string, principalId: string, role: ProjectRole): Promise<void> {
    await this.projectGrantRepository.grant(projectId, principalId, role);
  }
}
