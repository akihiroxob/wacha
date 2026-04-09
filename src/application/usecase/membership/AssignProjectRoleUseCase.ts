import { ProjectRole } from "@constants/ProjectRole.ts";
import { Project } from "@domain/model/Project.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { ProjectRepository } from "@domain/repository/ProjectRepository.ts";
import { RoleAssignmentService } from "@domain/service/RoleAssignmentService.ts";

type AssignProjectRoleInput = {
  baseDir: string;
  projectName: string;
  description?: string | null;
  sessionId: string;
  requestedRole?: ProjectRole;
};

type AssignProjectRoleResult = {
  project: Project;
  projectMembership: ProjectMembership;
  createdProject: boolean;
  createdProjectMembership: boolean;
};

export class AssignProjectRoleUseCase {
  constructor(
    private projectRepository: ProjectRepository,
    private projectMembershipRepository: ProjectMembershipRepository,
    private roleAssignmentService: RoleAssignmentService,
  ) {}

  async execute(input: AssignProjectRoleInput): Promise<AssignProjectRoleResult> {
    const existingProject = await this.projectRepository.findByBaseDir(input.baseDir);
    const project =
      existingProject ??
      (await this.projectRepository.create(
        input.projectName,
        input.description ?? null,
        input.baseDir,
      ));

    const projectMemberships = await this.projectMembershipRepository.findByProjectId(project.id);
    const role = input.requestedRole
      ? this.roleAssignmentService.resolveRequestedRole(
          projectMemberships,
          input.sessionId,
          input.requestedRole,
        )
      : this.roleAssignmentService.suggestRole(projectMemberships, input.sessionId);

    const existingMembership =
      await this.projectMembershipRepository.findByProjectIdSessionIdAndRole(
        project.id,
        input.sessionId,
        role,
      );

    if (existingMembership) {
      return {
        project,
        projectMembership: existingMembership,
        createdProject: existingProject === null,
        createdProjectMembership: false,
      };
    }

    const projectMembership = await this.projectMembershipRepository.create(
      project.id,
      input.sessionId,
      role,
    );

    return {
      project,
      projectMembership,
      createdProject: existingProject === null,
      createdProjectMembership: true,
    };
  }
}
