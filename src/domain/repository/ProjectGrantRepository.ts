import type { ProjectRole } from "@constants/ProjectRole.ts";
import type { ProjectGrant } from "@domain/model/ProjectGrant.ts";

export interface ProjectGrantRepository {
  grant(projectId: string, principalId: string, role: ProjectRole): Promise<void>;
  revoke(projectId: string, principalId: string, role: ProjectRole): Promise<void>;
  hasRole(projectId: string, principalId: string, role: ProjectRole): Promise<boolean>;
  listRoles(projectId: string, principalId: string): Promise<ProjectRole[]>;
  listByProjectId(projectId: string): Promise<ProjectGrant[]>;
}
