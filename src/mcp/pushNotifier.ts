import { ProjectRole } from "@constants/ProjectRole.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { Story } from "@domain/model/Story.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { SQLiteProjectMembershipRepository } from "@repository/SQLiteProjectMembershipRepository.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { getSessionByWorkerId } from "@mcp/sessionRegistry.ts";

type PushNotifierDeps = {
  projectMembershipRepository: ProjectMembershipRepository;
  taskRepository: TaskRepository;
};

const defaultDeps: PushNotifierDeps = {
  projectMembershipRepository: new SQLiteProjectMembershipRepository(),
  taskRepository: new SQLiteTaskRepository(),
};

class PushNotifier {
  constructor(private deps: PushNotifierDeps = defaultDeps) {}

  async notifyManagersStoryCreated(story: Story): Promise<void> {
    const memberships = await this.deps.projectMembershipRepository.findByProjectId(
      story.projectId,
    );
    const managerWorkerIds = memberships
      .filter((membership) => membership.role === ProjectRole.MANAGER)
      .map((membership) => membership.workerId);

    await this.sendToWorkers(managerWorkerIds, {
      level: "info",
      logger: "wacha.push",
      data: {
        event: "story.created",
        projectId: story.projectId,
        storyId: story.id,
        title: story.title,
        status: story.status,
        message: `New story requires manager triage: ${story.title}`,
      },
    });
  }

  async notifyReviewersTaskInReview(taskId: string): Promise<void> {
    const task = await this.deps.taskRepository.findById(taskId);
    if (!task) return;

    const memberships = await this.deps.projectMembershipRepository.findByProjectId(task.projectId);
    const reviewerWorkerIds = memberships
      .filter((membership) => membership.role === ProjectRole.REVIEWER)
      .map((membership) => membership.workerId);

    await this.sendToWorkers(reviewerWorkerIds, {
      level: "info",
      logger: "wacha.push",
      data: {
        event: "task.in_review",
        projectId: task.projectId,
        taskId: task.id,
        title: task.title,
        assignee: task.assignee,
        status: task.status,
        message: `Task is ready for review: ${task.title}`,
      },
    });
  }

  async notifyWorkerTaskRejected(taskId: string): Promise<void> {
    const task = await this.deps.taskRepository.findById(taskId);
    if (!task?.assignee) return;

    await this.sendToWorkers([task.assignee], {
      level: "warning",
      logger: "wacha.push",
      data: {
        event: "task.rejected",
        projectId: task.projectId,
        taskId: task.id,
        title: task.title,
        assignee: task.assignee,
        rejectReason: task.rejectReason,
        status: task.status,
        message: `Task was rejected and needs rework: ${task.title}`,
      },
    });
  }

  private async sendToWorkers(
    workerIds: string[],
    params: { level: "info" | "warning"; logger: string; data: Record<string, unknown> },
  ): Promise<void> {
    const uniqueWorkerIds = [...new Set(workerIds)];

    await Promise.all(
      uniqueWorkerIds.flatMap((workerId) =>
        getSessionByWorkerId(workerId)?.mapcancel_storycancel_story(async (session) => {
          try {
            await session.server.sendLoggingMessage(params, session.transport.sessionId);
          } catch (error) {
            console.error("Failed to send MCP push notification", error);
          }
        }),
      ),
    );
  }
}

export const pushNotifier = new PushNotifier();
