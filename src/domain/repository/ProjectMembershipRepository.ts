import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";

export interface ProjectMembershipRepository {
  findByProjectId(projectId: string): Promise<ProjectMembership[]>;
  findByProjectIdAndSessionId(projectId: string, sessionId: string): Promise<ProjectMembership[]>;
  findBySessionId(sessionId: string): Promise<ProjectMembership[]>;
  findByProjectIdSessionIdAndRole(
    projectId: string,
    sessionId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership | null>;
  create(projectId: string, sessionId: string, role: ProjectRole): Promise<ProjectMembership>;
  save(projectMembership: ProjectMembership): Promise<void>;
  delete(projectMembershipId: string): Promise<void>;
  deleteBySessionId(sessionId: string): Promise<void>;
  clear(): Promise<void>;
}
