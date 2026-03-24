import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";

export interface ProjectMembershipRepository {
  findByProjectId(projectId: string): Promise<ProjectMembership[]>;
  findByProjectIdAndWorkerId(projectId: string, workerId: string): Promise<ProjectMembership[]>;
  findByProjectIdWorkerIdAndRole(
    projectId: string,
    workerId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership | null>;
  create(projectId: string, workerId: string, role: ProjectRole): Promise<ProjectMembership>;
  save(projectMembership: ProjectMembership): Promise<void>;
  delete(projectMembershipId: string): Promise<void>;
}
