import { Task } from "@domain/model/Task.ts";
import { TaskRepository } from "@domain/repository/TaskRepository.ts";

import { DatabaseClient } from "@database/SQLiteClient.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
export class SQLiteTaskRepository implements TaskRepository {
  async findAll(): Promise<Task[]> {
    const rows = await DatabaseClient.selectFrom("task").selectAll().execute();
    return rows.map(
      (row) =>
        new Task(
          row.id,
          row.project_id,
          row.story_id,
          row.title,
          row.description,
          row.status as TaskStatus,
          row.assignee,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    const rows = await DatabaseClient.selectFrom("task")
      .selectAll()
      .where("status", "=", status)
      .execute();
    return rows.map(
      (row) =>
        new Task(
          row.id,
          row.project_id,
          row.story_id,
          row.title,
          row.description,
          row.status as TaskStatus,
          row.assignee,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findById(taskId: string): Promise<Task | null> {
    const row = await DatabaseClient.selectFrom("task")
      .selectAll()
      .where("id", "=", taskId)
      .executeTakeFirst();
    if (!row) return null;
    return new Task(
      row.id,
      row.project_id,
      row.story_id,
      row.title,
      row.description,
      row.status as TaskStatus,
      row.assignee,
      row.created_at,
      row.updated_at,
    );
  }

  async create(title: string, description: string | null, projectId: string, storyId?: string) {
    const id = crypto.randomUUID();
    const now = Date.now();

    const task = await DatabaseClient.insertInto("task")
      .values({
        id,
        project_id: projectId,
        story_id: storyId ?? null,
        title,
        description: description ?? null,
        status: TaskStatus.TODO,
        assignee: null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Task(
      task.id,
      task.project_id,
      task.story_id,
      task.title,
      task.description,
      task.status as TaskStatus,
      task.assignee,
      task.created_at,
      task.updated_at,
    );
  }

  async save(task: Task) {
    const existingTask = await this.findById(task.id);
    if (!existingTask) throw new Error("Task not found");

    await DatabaseClient.updateTable("task")
      .set({
        title: task.title,
        description: task.description,
        status: task.status,
        assignee: task.assignee,
        updated_at: Date.now(),
      })
      .where("id", "=", task.id)
      .execute();
  }

  async deleteTask(taskId: string) {
    await DatabaseClient.deleteFrom("task").where("id", "=", taskId).execute();
  }
}
