import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { SQLiteProjectMembershipRepository } from "@repository/SQLiteProjectMembershipRepository.ts";
import { SQLiteStoryRepository } from "@repository/SQLiteStoryRepository.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { MCP_HEADER } from "@constants/McpHeader.ts";

export type ManagerGuardExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

type ManagerGuardDeps = {
  projectMembershipRepository: ProjectMembershipRepository;
  storyRepository: StoryRepository;
  taskRepository: TaskRepository;
};

type ResolveProjectId<TArgs> = (args: TArgs, deps: ManagerGuardDeps) => Promise<string>;

const defaultDeps: ManagerGuardDeps = {
  projectMembershipRepository: new SQLiteProjectMembershipRepository(),
  storyRepository: new SQLiteStoryRepository(),
  taskRepository: new SQLiteTaskRepository(),
};

export async function ensureManagerRole<TArgs>(
  toolName: string,
  args: TArgs,
  extra: ManagerGuardExtra | undefined,
  resolveProjectId: ResolveProjectId<TArgs>,
  deps: ManagerGuardDeps = defaultDeps,
): Promise<void> {
  const rawWorkerId = extra?.requestInfo?.headers[MCP_HEADER.WACHA_WORKER_ID];
  const workerId =
    typeof rawWorkerId === "string"
      ? rawWorkerId.trim()
      : Array.isArray(rawWorkerId)
        ? rawWorkerId[0]?.trim()
        : undefined;
  if (!workerId) {
    throw new Error(`Missing ${MCP_HEADER.WACHA_WORKER_ID} header for ${toolName}`);
  }

  const projectId = await resolveProjectId(args, deps);
  const membership = await deps.projectMembershipRepository.findByProjectIdWorkerIdAndRole(
    projectId,
    workerId,
    ProjectRole.MANAGER,
  );

  if (!membership) {
    throw new Error(
      `Worker ${workerId} is not allowed to call ${toolName} for project ${projectId}`,
    );
  }
}

export function withManagerRoleGuard<TArgs>(
  toolName: string,
  execute: (args: TArgs, extra?: ManagerGuardExtra) => Promise<unknown>,
  resolveProjectId: ResolveProjectId<TArgs>,
  deps: ManagerGuardDeps = defaultDeps,
) {
  return async (args: TArgs, extra?: ManagerGuardExtra) => {
    await ensureManagerRole(toolName, args, extra, resolveProjectId, deps);
    return execute(args, extra);
  };
}

export const resolveProjectIdFromProjectArgs = async <TArgs extends { projectId: string }>(
  args: TArgs,
): Promise<string> => args.projectId;

export const resolveProjectIdFromStoryArgs = async <TArgs extends { storyId: string }>(
  args: TArgs,
  deps: ManagerGuardDeps,
): Promise<string> => {
  const story = await deps.storyRepository.findById(args.storyId);
  if (!story) {
    throw new Error("Story not found");
  }

  return story.projectId;
};

export const resolveProjectIdFromTaskArgs = async <TArgs extends { taskId: string }>(
  args: TArgs,
  deps: ManagerGuardDeps,
): Promise<string> => {
  const task = await deps.taskRepository.findById(args.taskId);
  if (!task) {
    throw new Error("Task not found");
  }

  return task.projectId;
};
