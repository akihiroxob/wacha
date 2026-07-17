import { Task } from "@domain/model/Task.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
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
  constructor(
    private taskRepository: TaskRepository,
    private storyRepository?: StoryRepository,
  ) {}

  async execute(projectId: string): Promise<ListTaskUseCaseResult> {
    const tasks = await this.taskRepository.findByProjectId(projectId);

    // 優先順位順: 親 story の sortOrder → task 自身の sortOrder。単発 task は末尾に自身の順で並ぶ
    const stories = this.storyRepository
      ? await this.storyRepository.findByProjectId(projectId)
      : [];
    const storySortOrders = new Map(stories.map((story) => [story.id, story.sortOrder]));
    const storyKeyOf = (task: Task) =>
      task.storyId !== null
        ? (storySortOrders.get(task.storyId) ?? Number.MAX_SAFE_INTEGER)
        : Number.MAX_SAFE_INTEGER;
    const sortedTasks = [...tasks].sort(
      (a: Task, b: Task) =>
        storyKeyOf(a) - storyKeyOf(b) || a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
    );
    const lastUpdatedAt = tasks.reduce<number | null>(
      (max, task) => (max === null || task.updatedAt > max ? task.updatedAt : max),
      null,
    );

    return {
      summary: {
        total: sortedTasks.length,
        byStatus: {
          [TaskStatus.TODO]: sortedTasks.filter((task) => task.status === TaskStatus.TODO).length,
          [TaskStatus.DOING]: sortedTasks.filter((task) => task.status === TaskStatus.DOING).length,
          [TaskStatus.CANCELED]: sortedTasks.filter((task) => task.status === TaskStatus.CANCELED)
            .length,
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
        lastUpdatedAt,
      },
      tasks: sortedTasks,
    };
  }
}
