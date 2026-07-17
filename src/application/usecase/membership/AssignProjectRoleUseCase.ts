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

type AssignProjectRoleOptions = {
  isSessionLive: (sessionId: string) => boolean;
  seatStaleMs: number;
};

// options 未指定時は席の解放を行わない(全セッションを生存扱いにする)
const NO_SEAT_RELEASE_OPTIONS: AssignProjectRoleOptions = {
  isSessionLive: () => true,
  seatStaleMs: Number.MAX_SAFE_INTEGER,
};

export class AssignProjectRoleUseCase {
  constructor(
    private projectRepository: ProjectRepository,
    private projectMembershipRepository: ProjectMembershipRepository,
    private roleAssignmentService: RoleAssignmentService,
    private options: AssignProjectRoleOptions = NO_SEAT_RELEASE_OPTIONS,
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

    const allMemberships = await this.projectMembershipRepository.findByProjectId(project.id);
    const releasableMemberships = this.roleAssignmentService.findReleasableExclusiveMemberships(
      allMemberships,
      input.sessionId,
      this.options.isSessionLive,
      Date.now(),
      this.options.seatStaleMs,
    );
    for (const releasableMembership of releasableMemberships) {
      await this.projectMembershipRepository.delete(releasableMembership.id);
    }
    const projectMemberships = allMemberships.filter(
      (membership) => !releasableMemberships.includes(membership),
    );
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
