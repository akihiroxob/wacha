import { Task } from "@domain/model/Task.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";

export interface ListTaskUseCaseResult {
  summary: {
    total: number;
    byStatus: Record<TaskStatus, number>;
    lastUpdatedAt: number | null;
  };
  tasks: Task[];
}
