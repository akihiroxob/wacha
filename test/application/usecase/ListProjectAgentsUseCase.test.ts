import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { ListProjectAgentsUseCase } from "@application/usecase/membership/ListProjectAgentsUseCase.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";

class InMemoryProjectMembershipRepository implements ProjectMembershipRepository {
  constructor(private memberships: ProjectMembership[]) {}

  async findByProjectId(projectId: string): Promise<ProjectMembership[]> {
    return this.memberships.filter((membership) => membership.projectId === projectId);
  }

  async findBySessionId(sessionId: string): Promise<ProjectMembership[]> {
    return this.memberships.filter((membership) => membership.sessionId === sessionId);
  }

  async findByProjectIdAndSessionId(
    projectId: string,
    sessionId: string,
  ): Promise<ProjectMembership[]> {
    return this.memberships.filter(
      (membership) => membership.projectId === projectId && membership.sessionId === sessionId,
    );
  }

  async findByProjectIdSessionIdAndRole(
    projectId: string,
    sessionId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership | null> {
    return (
      this.memberships.find(
        (membership) =>
          membership.projectId === projectId &&
          membership.sessionId === sessionId &&
          membership.role === role,
      ) ?? null
    );
  }

  async create(): Promise<ProjectMembership> {
    throw new Error("not implemented");
  }

  async save(): Promise<void> {
    throw new Error("not implemented");
  }

  async delete(): Promise<void> {
    throw new Error("not implemented");
  }

  async deleteBySessionId(): Promise<void> {
    throw new Error("not implemented");
  }

  async clear(): Promise<void> {
    throw new Error("not implemented");
  }
}

test("ListProjectAgentsUseCase returns sorted memberships for project", async () => {
  const useCase = new ListProjectAgentsUseCase(
    new InMemoryProjectMembershipRepository([
      new ProjectMembership(
        "membership-1",
        "project-1",
        "session-2",
        ProjectRole.WORKER,
        2000,
        1000,
        2000,
      ),
      new ProjectMembership(
        "membership-2",
        "project-1",
        "session-1",
        ProjectRole.MANAGER,
        3000,
        1000,
        3000,
      ),
      new ProjectMembership(
        "membership-3",
        "project-2",
        "session-9",
        ProjectRole.REVIEWER,
        4000,
        1000,
        4000,
      ),
    ]),
  );

  const result = await useCase.execute("project-1");

  assert.deepEqual(result.summary, { total: 2 });
  assert.deepEqual(result.agents, [
    new ProjectMembership("membership-2", "project-1", "session-1", ProjectRole.MANAGER, 3000, 1000, 3000),
    new ProjectMembership("membership-1", "project-1", "session-2", ProjectRole.WORKER, 2000, 1000, 2000),
  ]);
});
