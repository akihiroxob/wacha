import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { ListProjectAgentsUseCase } from "@application/usecase/project/ListProjectAgentsUseCase.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";

class InMemoryProjectMembershipRepository implements ProjectMembershipRepository {
  constructor(private memberships: ProjectMembership[]) {}

  async findByProjectId(projectId: string): Promise<ProjectMembership[]> {
    return this.memberships.filter((membership) => membership.projectId === projectId);
  }

  async findByProjectIdAndWorkerId(projectId: string, workerId: string): Promise<ProjectMembership[]> {
    return this.memberships.filter(
      (membership) => membership.projectId === projectId && membership.workerId === workerId,
    );
  }

  async findByProjectIdWorkerIdAndRole(
    projectId: string,
    workerId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership | null> {
    return (
      this.memberships.find(
        (membership) =>
          membership.projectId === projectId &&
          membership.workerId === workerId &&
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
}

test("ListProjectAgentsUseCase merges memberships with current session state", async () => {
  const useCase = new ListProjectAgentsUseCase(
    new InMemoryProjectMembershipRepository([
      new ProjectMembership(
        "membership-1",
        "project-1",
        "worker-2",
        ProjectRole.WORKER,
        2000,
        1000,
        2000,
      ),
      new ProjectMembership(
        "membership-2",
        "project-1",
        "worker-1",
        ProjectRole.MANAGER,
        3000,
        1000,
        3000,
      ),
      new ProjectMembership(
        "membership-3",
        "project-2",
        "worker-9",
        ProjectRole.REVIEWER,
        4000,
        1000,
        4000,
      ),
    ]),
    (workerId) => (workerId === "worker-1" ? "session-1" : undefined),
  );

  const result = await useCase.execute("project-1");

  assert.deepEqual(result.summary, {
    total: 2,
    online: 1,
    offline: 1,
  });
  assert.deepEqual(result.agents, [
    {
      membershipId: "membership-2",
      projectId: "project-1",
      workerId: "worker-1",
      role: ProjectRole.MANAGER,
      sessionId: "session-1",
      online: true,
      lastHeartbeatAt: 3000,
      createdAt: 1000,
      updatedAt: 3000,
    },
    {
      membershipId: "membership-1",
      projectId: "project-1",
      workerId: "worker-2",
      role: ProjectRole.WORKER,
      sessionId: null,
      online: false,
      lastHeartbeatAt: 2000,
      createdAt: 1000,
      updatedAt: 2000,
    },
  ]);
});
