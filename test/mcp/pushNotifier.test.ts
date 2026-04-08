import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { Task } from "@domain/model/Task.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { PushNotifier } from "@mcp/pushNotifier.ts";
import { registerSession, removeSession } from "@mcp/sessionRegistry.ts";

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

class InMemoryTaskRepository implements TaskRepository {
  constructor(private tasks: Task[]) {}

  async findByProjectId(projectId: string): Promise<Task[]> {
    return this.tasks.filter((task) => task.projectId === projectId);
  }

  async findByStatus(): Promise<Task[]> {
    throw new Error("not implemented");
  }

  async findById(taskId: string): Promise<Task | null> {
    return this.tasks.find((task) => task.id === taskId) ?? null;
  }

  async create(): Promise<Task> {
    throw new Error("not implemented");
  }

  async save(): Promise<void> {
    throw new Error("not implemented");
  }

  async delete(): Promise<void> {
    throw new Error("not implemented");
  }

  async deleteByStoryId(): Promise<void> {
    throw new Error("not implemented");
  }
}

test("PushNotifier notifies unique reviewers for in-review task", async () => {
  const sent: Array<{ params: unknown; sessionId: string }> = [];
  registerSession("session-1", {
    workerId: "reviewer-1",
    sessionId: "session-1",
    transport: { sessionId: "transport-1" } as never,
    server: {
      sendLoggingMessage: async (params: unknown, sessionId: string) => {
        sent.push({ params, sessionId });
      },
    } as never,
  });

  const notifier = new PushNotifier({
    projectMembershipRepository: new InMemoryProjectMembershipRepository([
      new ProjectMembership(
        "membership-1",
        "project-1",
        "reviewer-1",
        ProjectRole.REVIEWER,
        null,
        1000,
        1000,
      ),
      new ProjectMembership(
        "membership-2",
        "project-1",
        "reviewer-1",
        ProjectRole.REVIEWER,
        null,
        1000,
        1000,
      ),
      new ProjectMembership(
        "membership-3",
        "project-1",
        "manager-1",
        ProjectRole.MANAGER,
        null,
        1000,
        1000,
      ),
    ]),
    taskRepository: new InMemoryTaskRepository([
      new Task(
        "task-1",
        "project-1",
        null,
        "Review me",
        null,
        TaskStatus.IN_REVIEW,
        "worker-1",
        null,
        null,
        1000,
        1000,
      ),
    ]),
  });

  try {
    await notifier.notifyReviewersTaskInReview("task-1");
  } finally {
    removeSession("session-1");
  }

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.sessionId, "transport-1");
  assert.deepEqual(sent[0]?.params, {
    level: "info",
    logger: "wacha.push",
    data: {
      event: "task.in_review",
      projectId: "project-1",
      taskId: "task-1",
      title: "Review me",
      assignee: "worker-1",
      status: TaskStatus.IN_REVIEW,
      message: "Task is ready for review: Review me",
    },
  });
});

test("PushNotifier skips rejected-task notification when assignee session is absent", async () => {
  const notifier = new PushNotifier({
    projectMembershipRepository: new InMemoryProjectMembershipRepository([]),
    taskRepository: new InMemoryTaskRepository([
      new Task(
        "task-1",
        "project-1",
        null,
        "Needs rework",
        null,
        TaskStatus.REJECTED,
        "worker-1",
        "Fix it",
        null,
        1000,
        1000,
      ),
    ]),
  });

  await assert.doesNotReject(() => notifier.notifyWorkerTaskRejected("task-1"));
});
