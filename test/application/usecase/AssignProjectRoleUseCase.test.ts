import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { AssignProjectRoleUseCase } from "@application/usecase/AssignProjectRoleUseCase.ts";
import { Project } from "@domain/model/Project.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { ProjectRepository } from "@domain/repository/ProjectRepository.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { RoleAssignmentService } from "@domain/service/RoleAssignmentService.ts";

class InMemoryProjectRepository implements ProjectRepository {
  private projects = new Map<string, Project>();

  async findAll(): Promise<Project[]> {
    return [...this.projects.values()];
  }

  async findById(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) ?? null;
  }

  async findByBaseDir(baseDir: string): Promise<Project | null> {
    return [...this.projects.values()].find((project) => project.baseDir === baseDir) ?? null;
  }

  async create(name: string, description: string | null, baseDir: string): Promise<Project> {
    const project = new Project(`project-${this.projects.size + 1}`, name, description, baseDir, 1000, 1000);
    this.projects.set(project.id, project);
    return project;
  }

  async save(project: Project): Promise<void> {
    this.projects.set(project.id, project);
  }
}

class InMemoryProjectMembershipRepository implements ProjectMembershipRepository {
  private projectMemberships = new Map<string, ProjectMembership>();

  async findByProjectId(projectId: string): Promise<ProjectMembership[]> {
    return [...this.projectMemberships.values()].filter((membership) => membership.projectId === projectId);
  }

  async findByProjectIdAndWorkerId(
    projectId: string,
    workerId: string,
  ): Promise<ProjectMembership[]> {
    return [...this.projectMemberships.values()].filter(
      (membership) => membership.projectId === projectId && membership.workerId === workerId,
    );
  }

  async findByProjectIdWorkerIdAndRole(
    projectId: string,
    workerId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership | null> {
    return (
      [...this.projectMemberships.values()].find(
        (membership) =>
          membership.projectId === projectId &&
          membership.workerId === workerId &&
          membership.role === role,
      ) ?? null
    );
  }

  async create(projectId: string, workerId: string, role: ProjectRole): Promise<ProjectMembership> {
    const membership = new ProjectMembership(
      `membership-${this.projectMemberships.size + 1}`,
      projectId,
      workerId,
      role,
      1000,
      1000,
      1000,
    );
    this.projectMemberships.set(membership.id, membership);
    return membership;
  }

  async save(projectMembership: ProjectMembership): Promise<void> {
    this.projectMemberships.set(projectMembership.id, projectMembership);
  }

  async delete(projectMembershipId: string): Promise<void> {
    this.projectMemberships.delete(projectMembershipId);
  }
}

test("AssignProjectRoleUseCase creates project and assigns recommended manager role", async () => {
  const useCase = new AssignProjectRoleUseCase(
    new InMemoryProjectRepository(),
    new InMemoryProjectMembershipRepository(),
    new RoleAssignmentService(),
  );

  const result = await useCase.execute({
    baseDir: "repo/wacha",
    projectName: "Wacha",
    workerId: "worker-1",
  });

  assert.equal(result.project.baseDir, "repo/wacha");
  assert.equal(result.projectMembership.role, ProjectRole.MANAGER);
  assert.equal(result.createdProject, true);
  assert.equal(result.createdProjectMembership, true);
});

test("AssignProjectRoleUseCase reuses existing membership for same worker and role", async () => {
  const projectRepository = new InMemoryProjectRepository();
  const membershipRepository = new InMemoryProjectMembershipRepository();
  const roleAssignmentService = new RoleAssignmentService();
  const useCase = new AssignProjectRoleUseCase(
    projectRepository,
    membershipRepository,
    roleAssignmentService,
  );

  const first = await useCase.execute({
    baseDir: "repo/wacha",
    projectName: "Wacha",
    workerId: "worker-1",
    requestedRole: ProjectRole.MANAGER,
  });

  const second = await useCase.execute({
    baseDir: "repo/wacha",
    projectName: "Wacha",
    workerId: "worker-1",
    requestedRole: ProjectRole.MANAGER,
  });

  assert.equal(second.project.id, first.project.id);
  assert.equal(second.projectMembership.id, first.projectMembership.id);
  assert.equal(second.createdProject, false);
  assert.equal(second.createdProjectMembership, false);
});

test("AssignProjectRoleUseCase assigns next available recommended role", async () => {
  const projectRepository = new InMemoryProjectRepository();
  const membershipRepository = new InMemoryProjectMembershipRepository();
  const roleAssignmentService = new RoleAssignmentService();
  const useCase = new AssignProjectRoleUseCase(
    projectRepository,
    membershipRepository,
    roleAssignmentService,
  );

  await useCase.execute({
    baseDir: "repo/wacha",
    projectName: "Wacha",
    workerId: "worker-1",
  });

  const result = await useCase.execute({
    baseDir: "repo/wacha",
    projectName: "Wacha",
    workerId: "worker-2",
  });

  assert.equal(result.projectMembership.role, ProjectRole.REVIEWER);
});

test("AssignProjectRoleUseCase respects requested worker role", async () => {
  const useCase = new AssignProjectRoleUseCase(
    new InMemoryProjectRepository(),
    new InMemoryProjectMembershipRepository(),
    new RoleAssignmentService(),
  );

  const result = await useCase.execute({
    baseDir: "repo/wacha",
    projectName: "Wacha",
    workerId: "worker-1",
    requestedRole: ProjectRole.WORKER,
  });

  assert.equal(result.projectMembership.role, ProjectRole.WORKER);
});
