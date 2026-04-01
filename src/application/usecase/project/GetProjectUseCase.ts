import { Project } from "@domain/model/Project.ts";
import { ProjectRepository } from "@domain/repository/ProjectRepository.ts";

export class GetProjectUseCase {
  constructor(private projectRepository: ProjectRepository) {}

  async execute(projectId: string): Promise<Project | null> {
    const project = await this.projectRepository.findById(projectId);
    return project ?? null;
  }
}
