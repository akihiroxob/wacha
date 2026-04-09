import test from "node:test";
import assert from "node:assert/strict";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { McpSession } from "@domain/model/McpSession.ts";
import { Task } from "@domain/model/Task.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { SessionRepository } from "@domain/repository/SessionRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { PushNotifier } from "@mcp/pushNotifier.ts";

class InMemoryProjectMembershipRepository implements ProjectMembershipRepository {
  constructor(private memberships: ProjectMembership[]) {}

  async findByProjectId(projectId: string): Promise<ProjectMembership[]> {
    return this.memberships.filter((membership) => membership.projectId === projectId);
  }

  async findByProjectIdAndSessionId(
    projectId: string,
    sessionId: string,
  ): Promise<ProjectMembership[]> {
    return this.memberships.filter(
      (membership) => membership.projectId === projectId && membership.sessionId === sessionId,
    );
  }

  async findBySessionId(sessionId: string): Promise<ProjectMembership[]> {
    return this.memberships.filter((membership) => membership.sessionId === sessionId);
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

class InMemorySessionRepository implements SessionRepository {
  private sessions = new Map<string, McpSession>();

  registerSession(sessionId: string, entry: McpSession): void {
    this.sessions.set(sessionId, entry);
  }

  getSessionBySessionId(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  removeSessionBySessionId(sessionId: string): void {
    this.sessions.delete(sessionId);
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
  const sessionRepository = new InMemorySessionRepository();
  sessionRepository.registerSession("session-1", {
    sessionId: "session-1",
    transport: { sessionId: "transport-1" } as never,
    server: {
      sendLoggingMessage: async (params: unknown, sessionId: string) => {
        sent.push({ params, sessionId });
      },
    } as never,
  });

  const notifier = new PushNotifier(
    new InMemoryProjectMembershipRepository([
      new ProjectMembership(
        "membership-1",
        "project-1",
        "session-1",
        ProjectRole.REVIEWER,
        null,
        1000,
        1000,
      ),
      new ProjectMembership(
        "membership-2",
        "project-1",
        "session-1",
        ProjectRole.REVIEWER,
        null,
        1000,
        1000,
      ),
      new ProjectMembership(
        "membership-3",
        "project-1",
        "session-9",
        ProjectRole.MANAGER,
        null,
        1000,
        1000,
      ),
    ]),
    new InMemoryTaskRepository([
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
    sessionRepository,
  );

  await notifier.notifyReviewersTaskInReview("task-1");

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
  const notifier = new PushNotifier(
    new InMemoryProjectMembershipRepository([]),
    new InMemoryTaskRepository([
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
    new InMemorySessionRepository(),
  );

  await assert.doesNotReject(() => notifier.notifyWorkerTaskRejected("task-1"));
});
