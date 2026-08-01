import type { ProjectGrantRepository } from "@domain/repository/ProjectGrantRepository.ts";

export class ListProjectGrantsUseCase {
  constructor(private readonly projectGrantRepository: ProjectGrantRepository) {}

  async execute(projectId: string) {
    const grants = await this.projectGrantRepository.listByProjectId(projectId);
    return {
      projectId,
      summary: {
        total: grants.length,
        principals: new Set(grants.map((grant) => grant.principalId)).size,
      },
      grants: grants.map((grant) => ({
        id: `${grant.projectId}:${grant.principalId}:${grant.role}`,
        ...grant,
      })),
    };
  }
}
