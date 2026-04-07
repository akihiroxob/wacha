import test from "node:test";
import assert from "node:assert/strict";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";

import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { Story } from "@domain/model/Story.ts";
import { Task } from "@domain/model/Task.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import {
  ensureManagerRole,
  managerGuardHeader,
  resolveProjectIdFromProjectArgs,
  resolveProjectIdFromStoryArgs,
  resolveProjectIdFromTaskArgs,
} from "@mcp/managerGuard.ts";

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

class InMemoryStoryRepository implements StoryRepository {
  constructor(private stories: Story[]) {}

  async findAll(): Promise<Story[]> {
    return this.stories;
  }

  async findById(storyId: string): Promise<Story | null> {
    return this.stories.find((story) => story.id === storyId) ?? null;
  }

  async findByProjectId(projectId: string): Promise<Story[]> {
    return this.stories.filter((story) => story.projectId === projectId);
  }

  async create(): Promise<Story> {
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

const createExtra = (workerId?: string): RequestHandlerExtra<ServerRequest, ServerNotification> => ({
  signal: new AbortController().signal,
  requestId: "request-1",
  requestInfo: {
    headers: workerId ? { [managerGuardHeader]: workerId } : {},
  },
  sendNotification: async () => {},
  sendRequest: async () => {
    throw new Error("not implemented");
  },
});

test("ensureManagerRole allows a manager to call a guarded project tool", async () => {
  const deps = {
    projectMembershipRepository: new InMemoryProjectMembershipRepository([
      new ProjectMembership(
        "membership-1",
        "project-1",
        "worker-1",
        ProjectRole.MANAGER,
        null,
        1000,
        1000,
      ),
    ]),
    storyRepository: new InMemoryStoryRepository([]),
    taskRepository: new InMemoryTaskRepository([]),
  };

  await assert.doesNotReject(() =>
    ensureManagerRole(
      "issue_story",
      { projectId: "project-1" },
      createExtra("worker-1"),
      resolveProjectIdFromProjectArgs,
      deps,
    ),
  );
});

test("ensureManagerRole rejects when worker header is missing", async () => {
  const deps = {
    projectMembershipRepository: new InMemoryProjectMembershipRepository([]),
    storyRepository: new InMemoryStoryRepository([]),
    taskRepository: new InMemoryTaskRepository([]),
  };

  await assert.rejects(
    () => ensureManagerRole("issue_story", { projectId: "project-1" }, createExtra(), resolveProjectIdFromProjectArgs, deps),
    /Missing x-wacha-worker-id header/,
  );
});

test("ensureManagerRole rejects a non-manager caller", async () => {
  const deps = {
    projectMembershipRepository: new InMemoryProjectMembershipRepository([
      new ProjectMembership(
        "membership-1",
        "project-1",
        "worker-1",
        ProjectRole.WORKER,
        null,
        1000,
        1000,
      ),
    ]),
    storyRepository: new InMemoryStoryRepository([]),
    taskRepository: new InMemoryTaskRepository([]),
  };

  await assert.rejects(
    () =>
      ensureManagerRole(
        "issue_story",
        { projectId: "project-1" },
        createExtra("worker-1"),
        resolveProjectIdFromProjectArgs,
        deps,
      ),
    /not allowed to call issue_story/,
  );
});

test("resolveProjectIdFromStoryArgs reads the project from story", async () => {
  const deps = {
    projectMembershipRepository: new InMemoryProjectMembershipRepository([]),
    storyRepository: new InMemoryStoryRepository([
      new Story("story-1", "project-1", "Story 1", null, StoryStatus.TODO, 1000, 1000),
    ]),
    taskRepository: new InMemoryTaskRepository([]),
  };

  const projectId = await resolveProjectIdFromStoryArgs({ storyId: "story-1" }, deps);

  assert.equal(projectId, "project-1");
});

test("resolveProjectIdFromTaskArgs reads the project from task", async () => {
  const deps = {
    projectMembershipRepository: new InMemoryProjectMembershipRepository([]),
    storyRepository: new InMemoryStoryRepository([]),
    taskRepository: new InMemoryTaskRepository([
      new Task(
        "task-1",
        "project-1",
        null,
        "Task 1",
        null,
        TaskStatus.IN_REVIEW,
        null,
        null,
        null,
        1000,
        1000,
      ),
    ]),
  };

  const projectId = await resolveProjectIdFromTaskArgs({ taskId: "task-1" }, deps);

  assert.equal(projectId, "project-1");
});
