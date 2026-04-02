import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { SQLiteProjectMembershipRepository } from "@repository/SQLiteProjectMembershipRepository.ts";
import { SQLiteStoryRepository } from "@repository/SQLiteStoryRepository.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";

const WORKER_ID_HEADER = "x-wacha-worker-id";

type ManagerGuardExtra = {
  requestInfo?: Request;
};

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
  const workerId = extra?.requestInfo?.headers.get(WORKER_ID_HEADER)?.trim();
  if (!workerId) {
    throw new Error(`Missing ${WORKER_ID_HEADER} header for ${toolName}`);
  }

  const projectId = await resolveProjectId(args, deps);
  const membership = await deps.projectMembershipRepository.findByProjectIdWorkerIdAndRole(
    projectId,
    workerId,
    ProjectRole.MANAGER,
  );

  if (!membership) {
    throw new Error(`Worker ${workerId} is not allowed to call ${toolName} for project ${projectId}`);
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

export const managerGuardHeader = WORKER_ID_HEADER;
