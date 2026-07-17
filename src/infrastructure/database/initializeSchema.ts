import { sql } from "kysely";
import { DatabaseClient } from "@database/SQLiteClient.ts";

let initializePromise: Promise<void> | null = null;

async function addColumnIfMissing(
  table: string,
  column: string,
  dataType: "text" | "integer",
  defaultTo?: number,
): Promise<boolean> {
  try {
    await DatabaseClient.schema
      .alterTable(table)
      .addColumn(column, dataType, (col) =>
        defaultTo === undefined ? col : col.notNull().defaultTo(defaultTo),
      )
      .execute();
    return true;
  } catch {
    // duplicate column name: 既に追加済み
    return false;
  }
}

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
      .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addColumn("updated_at", "integer", (col) => col.notNull())
      .addForeignKeyConstraint("story_project_fk", ["project_id"], "project", ["id"])
      .execute();

    await DatabaseClient.schema
      .createTable("project_membership")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("project_id", "text", (col) => col.notNull())
      .addColumn("session_id", "text", (col) => col.notNull())
      .addColumn("role", "text", (col) => col.notNull())
      .addColumn("last_heartbeat_at", "integer")
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addColumn("updated_at", "integer", (col) => col.notNull())
      .addForeignKeyConstraint("project_membership_project_fk", ["project_id"], "project", ["id"])
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
      .addColumn("reject_reason", "text")
      .addColumn("resume_source_status", "text")
      .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addColumn("updated_at", "integer", (col) => col.notNull())
      .addForeignKeyConstraint("task_project_fk", ["project_id"], "project", ["id"])
      .addForeignKeyConstraint("task_story_fk", ["story_id"], "story", ["id"])
      .execute();

    await DatabaseClient.schema
      .createTable("task_comment")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("task_id", "text", (col) => col.notNull())
      .addColumn("body", "text", (col) => col.notNull())
      .addColumn("author", "text")
      .addColumn("session_id", "text")
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addForeignKeyConstraint("task_comment_task_fk", ["task_id"], "task", ["id"])
      .execute();

    // 既存DBへの後方互換カラム追加(列が既にある場合のエラーは無視する)
    await addColumnIfMissing("task_comment", "session_id", "text");

    // sort_order: 追加直後の既存行は createdAt 順(同時刻は id 順)で 1 始まりに初期化する
    const addedStorySortOrder = await addColumnIfMissing("story", "sort_order", "integer", 0);
    if (addedStorySortOrder) {
      await sql`
        UPDATE story SET sort_order = (
          SELECT COUNT(*) FROM story AS s2
          WHERE s2.project_id = story.project_id
            AND (s2.created_at < story.created_at
              OR (s2.created_at = story.created_at AND s2.id <= story.id))
        )
      `.execute(DatabaseClient);
    }
    const addedTaskSortOrder = await addColumnIfMissing("task", "sort_order", "integer", 0);
    if (addedTaskSortOrder) {
      await sql`
        UPDATE task SET sort_order = (
          SELECT COUNT(*) FROM task AS t2
          WHERE t2.project_id = task.project_id
            AND (t2.created_at < task.created_at
              OR (t2.created_at = task.created_at AND t2.id <= task.id))
        )
      `.execute(DatabaseClient);
    }

    await DatabaseClient.schema
      .createIndex("idx_story_project_id")
      .ifNotExists()
      .on("story")
      .column("project_id")
      .execute();

    await DatabaseClient.schema
      .createIndex("idx_project_membership_project_id")
      .ifNotExists()
      .on("project_membership")
      .column("project_id")
      .execute();

    await DatabaseClient.schema
      .createIndex("idx_project_membership_session_id")
      .ifNotExists()
      .on("project_membership")
      .column("session_id")
      .execute();

    await DatabaseClient.schema
      .createIndex("uq_project_membership_project_session_role")
      .ifNotExists()
      .unique()
      .on("project_membership")
      .columns(["project_id", "session_id", "role"])
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

    await DatabaseClient.schema
      .createIndex("idx_task_comment_task_id")
      .ifNotExists()
      .on("task_comment")
      .column("task_id")
      .execute();
  })();

  return initializePromise;
}
