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

async function tableExists(table: string): Promise<boolean> {
  const result = await sql<{ name: string }>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${table}
  `.execute(DatabaseClient);
  return result.rows.length > 0;
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
      .createTable("project_grant")
      .ifNotExists()
      .addColumn("project_id", "text", (col) => col.notNull())
      .addColumn("principal_id", "text", (col) => col.notNull())
      .addColumn("role", "text", (col) => col.notNull())
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addPrimaryKeyConstraint("project_grant_pk", ["project_id", "principal_id", "role"])
      .addForeignKeyConstraint(
        "project_grant_project_fk",
        ["project_id"],
        "project",
        ["id"],
        (constraint) => constraint.onDelete("cascade"),
      )
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
      .addColumn("principal_id", "text")
      .addColumn("claim_id", "text")
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addForeignKeyConstraint("task_comment_task_fk", ["task_id"], "task", ["id"])
      .execute();

    // 既存DBへの後方互換カラム追加(列が既にある場合のエラーは無視する)
    await addColumnIfMissing("task_comment", "session_id", "text");
    await addColumnIfMissing("task_comment", "principal_id", "text");
    await addColumnIfMissing("task_comment", "claim_id", "text");

    await DatabaseClient.schema
      .createTable("task_claim")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("task_id", "text", (col) => col.notNull())
      .addColumn("principal_id", "text", (col) => col.notNull())
      .addColumn("state", "text", (col) => col.notNull())
      .addColumn("acquired_at", "integer", (col) => col.notNull())
      .addColumn("renewed_at", "integer")
      .addColumn("expires_at", "integer", (col) => col.notNull())
      .addColumn("released_at", "integer")
      .addColumn("release_reason", "text")
      .addForeignKeyConstraint(
        "task_claim_task_fk",
        ["task_id"],
        "task",
        ["id"],
        (constraint) => constraint.onDelete("cascade"),
      )
      .execute();

    await DatabaseClient.schema
      .createTable("command_receipt")
      .ifNotExists()
      .addColumn("principal_id", "text", (col) => col.notNull())
      .addColumn("tool_name", "text", (col) => col.notNull())
      .addColumn("request_id", "text", (col) => col.notNull())
      .addColumn("input_json", "text", (col) => col.notNull())
      .addColumn("result_json", "text", (col) => col.notNull())
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addPrimaryKeyConstraint("command_receipt_pk", ["principal_id", "tool_name", "request_id"])
      .execute();

    await DatabaseClient.schema
      .createTable("change_log")
      .ifNotExists()
      .addColumn("cursor", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("project_id", "text", (col) => col.notNull())
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("entity_id", "text", (col) => col.notNull())
      .addColumn("principal_id", "text", (col) => col.notNull())
      .addColumn("claim_id", "text")
      .addColumn("payload", "text", (col) => col.notNull())
      .addColumn("occurred_at", "integer", (col) => col.notNull())
      .addForeignKeyConstraint(
        "change_log_project_fk",
        ["project_id"],
        "project",
        ["id"],
        (constraint) => constraint.onDelete("cascade"),
      )
      .execute();

    // 一度きりの破壊的移行: session 所有権を廃止し、旧 doing を再 Claim 可能に戻す。
    // membership 表の存在を migration marker とし、再起動のたびに doing を戻さない。
    if (await tableExists("project_membership")) {
      await DatabaseClient.transaction().execute(async (db) => {
        const doingTasks = await db
          .selectFrom("task")
          .select(["id", "project_id"])
          .where("status", "=", "doing")
          .execute();
        const activeClaims = await db
          .selectFrom("task_claim")
          .select("task_id")
          .where("state", "=", "active")
          .execute();
        const activeTaskIds = new Set(activeClaims.map((claim) => claim.task_id));
        const resetTasks = doingTasks.filter((task) => !activeTaskIds.has(task.id));
        const occurredAt = Date.now();

        if (resetTasks.length > 0) {
          await db
            .insertInto("change_log")
            .values(
              resetTasks.map((task) => ({
                project_id: task.project_id,
                type: "TASK_MIGRATED",
                entity_id: task.id,
                principal_id: "system:migration",
                claim_id: null,
                payload: JSON.stringify({
                  fromStatus: "doing",
                  toStatus: "todo",
                  reason: "legacy_session_ownership_removed",
                }),
                occurred_at: occurredAt,
              })),
            )
            .execute();
          await db
            .updateTable("task")
            .set({
              status: "todo",
              assignee: null,
              resume_source_status: null,
              updated_at: occurredAt,
            })
            .where(
              "id",
              "in",
              resetTasks.map((task) => task.id),
            )
            .execute();
        }

        await db.updateTable("task").set({ assignee: null }).execute();
        await sql`DROP TABLE project_membership`.execute(db);
      });
    }

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

    await DatabaseClient.schema
      .createIndex("idx_project_grant_principal")
      .ifNotExists()
      .on("project_grant")
      .columns(["principal_id", "project_id"])
      .execute();

    await DatabaseClient.schema
      .createIndex("idx_task_claim_task_state")
      .ifNotExists()
      .on("task_claim")
      .columns(["task_id", "state"])
      .execute();

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_task_claim_active_task
      ON task_claim(task_id)
      WHERE state = 'active'
    `.execute(DatabaseClient);

    await DatabaseClient.schema
      .createIndex("idx_change_log_project_cursor")
      .ifNotExists()
      .on("change_log")
      .columns(["project_id", "cursor"])
      .execute();
  })();

  return initializePromise;
}
