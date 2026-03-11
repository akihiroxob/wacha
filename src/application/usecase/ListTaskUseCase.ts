import { Task } from "@domain/model/Task.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { ListTaskUseCaseResult } from "@application/usecase/ListTaskUseCaseResult.ts";

export class ListTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(): Promise<ListTaskUseCaseResult> {
    const tasks = await this.taskRepository.findAll();
    const sortedTasks = [...tasks].sort((a: Task, b: Task) => b.updatedAt - a.updatedAt);

    return {
      summary: {
        total: sortedTasks.length,
        byStatus: {
          [TaskStatus.TODO]: sortedTasks.filter((task) => task.status === TaskStatus.TODO).length,
          [TaskStatus.DOING]: sortedTasks.filter((task) => task.status === TaskStatus.DOING).length,
          [TaskStatus.IN_REVIEW]: sortedTasks.filter(
            (task) => task.status === TaskStatus.IN_REVIEW,
          ).length,
          [TaskStatus.ACCEPTED]: sortedTasks.filter(
            (task) => task.status === TaskStatus.ACCEPTED,
          ).length,
          [TaskStatus.REJECTED]: sortedTasks.filter(
            (task) => task.status === TaskStatus.REJECTED,
          ).length,
        },
        lastUpdatedAt: sortedTasks[0]?.updatedAt ?? null,
      },
      tasks: sortedTasks,
    };
  }
}
