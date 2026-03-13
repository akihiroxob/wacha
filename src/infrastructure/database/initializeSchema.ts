import { DatabaseClient } from "@database/SQLiteClient.ts";

let initializePromise: Promise<void> | null = null;

export function initializeSchema(): Promise<void> {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    await DatabaseClient.schema
      .createTable("project")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("basedir", "text", (col) => col.notNull())
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addColumn("updated_at", "integer", (col) => col.notNull())
      .execute();

    await DatabaseClient.schema
      .createTable("story")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("project_id", "text", (col) => col.notNull())
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addColumn("updated_at", "integer", (col) => col.notNull())
      .addForeignKeyConstraint("story_project_fk", ["project_id"], "project", ["id"])
      .execute();

    await DatabaseClient.schema
      .createTable("task")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("project_id", "text", (col) => col.notNull())
      .addColumn("story_id", "text")
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("assignee", "text")
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addColumn("updated_at", "integer", (col) => col.notNull())
      .addForeignKeyConstraint("task_project_fk", ["project_id"], "project", ["id"])
      .addForeignKeyConstraint("task_story_fk", ["story_id"], "story", ["id"])
      .execute();

    await DatabaseClient.schema
      .createIndex("idx_story_project_id")
      .ifNotExists()
      .on("story")
      .column("project_id")
      .execute();

    await DatabaseClient.schema
      .createIndex("idx_task_project_id")
      .ifNotExists()
      .on("task")
      .column("project_id")
      .execute();

    await DatabaseClient.schema
      .createIndex("idx_task_story_id")
      .ifNotExists()
      .on("task")
      .column("story_id")
      .execute();
  })();

  return initializePromise;
}
