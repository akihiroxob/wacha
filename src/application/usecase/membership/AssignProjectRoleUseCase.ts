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

    // 1セッション1プロジェクト1ロール: 自セッションの membership は常に1行に保つ
    const ownMemberships = projectMemberships.filter(
      (membership) => membership.sessionId === input.sessionId,
    );
    const otherMemberships = projectMemberships.filter(
      (membership) => membership.sessionId !== input.sessionId,
    );
    const createdProject = existingProject === null;

    // 要求ロールなしで既にロールを持つ場合、または同一ロールの再要求は現状維持
    const reusableMembership = input.requestedRole
      ? ownMemberships.find((membership) => membership.role === input.requestedRole)
      : ownMemberships[0];
    if (reusableMembership) {
      await this.pruneExtraMemberships(ownMemberships, reusableMembership);
      return {
        project,
        projectMembership: reusableMembership,
        createdProject,
        createdProjectMembership: false,
      };
    }

    // 空き判定は自セッションの席を除いて行う(置き換え時に自分の席と競合させない)
    const role = input.requestedRole
      ? this.roleAssignmentService.resolveRequestedRole(
          otherMemberships,
          input.sessionId,
          input.requestedRole,
        )
      : this.roleAssignmentService.suggestRole(otherMemberships, input.sessionId);

    const currentMembership = ownMemberships[0];
    if (currentMembership) {
      // 別ロールへの変更は行の追加ではなく置き換えにする
      currentMembership.changeRole(role);
      await this.projectMembershipRepository.save(currentMembership);
      await this.pruneExtraMemberships(ownMemberships, currentMembership);
      return {
        project,
        projectMembership: currentMembership,
        createdProject,
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
      createdProject,
      createdProjectMembership: true,
    };
  }

  // 旧仕様で複数行になっている membership を1行に掃除する
  private async pruneExtraMemberships(
    ownMemberships: ProjectMembership[],
    kept: ProjectMembership,
  ): Promise<void> {
    for (const membership of ownMemberships) {
      if (membership.id !== kept.id) {
        await this.projectMembershipRepository.delete(membership.id);
      }
    }
  }
}
