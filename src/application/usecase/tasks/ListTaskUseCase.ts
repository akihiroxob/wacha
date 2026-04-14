import { Task } from "@domain/model/Task.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";

interface ListTaskUseCaseResult {
  summary: {
    total: number;
    byStatus: Record<TaskStatus, number>;
    lastUpdatedAt: number | null;
  };
  tasks: Task[];
}

export class ListTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(projectId: string): Promise<ListTaskUseCaseResult> {
    const tasks = await this.taskRepository.findByProjectId(projectId);
    const sortedTasks = [...tasks].sort((a: Task, b: Task) => b.updatedAt - a.updatedAt);

    return {
      summary: {
        total: sortedTasks.length,
        byStatus: {
          [TaskStatus.TODO]: sortedTasks.filter((task) => task.status === TaskStatus.TODO).length,
          [TaskStatus.DOING]: sortedTasks.filter((task) => task.status === TaskStatus.DOING).length,
          [TaskStatus.IN_REVIEW]: sortedTasks.filter((task) => task.status === TaskStatus.IN_REVIEW)
            .length,
          [TaskStatus.WAIT_ACCEPT]: sortedTasks.filter(
            (task) => task.status === TaskStatus.WAIT_ACCEPT,
          ).length,
          [TaskStatus.ACCEPTED]: sortedTasks.filter((task) => task.status === TaskStatus.ACCEPTED)
            .length,
          [TaskStatus.REJECTED]: sortedTasks.filter((task) => task.status === TaskStatus.REJECTED)
            .length,
        },
        lastUpdatedAt: sortedTasks[0]?.updatedAt ?? null,
      },
      tasks: sortedTasks,
    };
  }
}
