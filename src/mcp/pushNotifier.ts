import { ProjectRole } from "@constants/ProjectRole.ts";
import { Story } from "@domain/model/Story.ts";
import { ProjectMembershipRepository } from "@domain/repository/ProjectMembershipRepository.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { SessionRepository } from "@domain/repository/SessionRepository.ts";

export class PushNotifier {
  constructor(
    private projectMembershipRepository: ProjectMembershipRepository,
    private taskRepository: TaskRepository,
    private sessionRepository: SessionRepository,
  ) {}

  async notifyManagersStoryCreated(story: Story): Promise<void> {
    const memberships = await this.projectMembershipRepository.findByProjectId(story.projectId);
    const managerSessionIds = memberships
      .filter((membership) => membership.role === ProjectRole.MANAGER)
      .map((membership) => membership.sessionId);

    await this.sendToWorkers(managerSessionIds, {
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
    const task = await this.taskRepository.findById(taskId);
    if (!task) return;

    const memberships = await this.projectMembershipRepository.findByProjectId(task.projectId);
    const reviewerSessionIds = memberships
      .filter((membership) => membership.role === ProjectRole.REVIEWER)
      .map((membership) => membership.sessionId);

    await this.sendToWorkers(reviewerSessionIds, {
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
    const task = await this.taskRepository.findById(taskId);
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
    sessionIds: string[],
    params: { level: "info" | "warning"; logger: string; data: Record<string, unknown> },
  ): Promise<void> {
    const uniqueSessionIds = [...new Set(sessionIds)];

    await Promise.all(
      uniqueSessionIds.flatMap((sessionId) => {
        const session = this.sessionRepository.getSessionBySessionId(sessionId);
        if (!session) return [];

        return [
          (async () => {
            try {
              await session.server.sendLoggingMessage(params, session.transport.sessionId);
            } catch (error) {
              console.error("Failed to send MCP push notification", error);
            }
          })(),
        ];
      }),
    );
  }
}
