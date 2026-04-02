import { Project } from "@domain/model/Project.ts";
import { ProjectRepository } from "@domain/repository/ProjectRepository.ts";

interface ListProjectUseCaseResult {
  projects: Project[];
}

export class ListProjectUseCase {
  constructor(private projectRepository: ProjectRepository) {}

  async execute(): Promise<ListProjectUseCaseResult> {
    const projects = await this.projectRepository.findAll();
    return { projects: projects.sort((a, b) => b.createdAt - a.createdAt) };
  }
}
