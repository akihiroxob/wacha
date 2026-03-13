import { Project } from "@domain/model/Project.ts";

export interface ProjectRepository {
  findAll(): Promise<Project[]>;
  findById(projectId: string): Promise<Project | null>;
  create(name: string, description: string | null, baseDir: string): Promise<Project>;
  save(project: Project): Promise<void>;
}
