import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { DataBase } from "./schema/index.ts";

const databasePath = process.env.WACHA_DB_PATH ?? "wacha.db";
const sqlite = new Database(databasePath);

export const DatabaseClient = new Kysely<DataBase>({
  dialect: new SqliteDialect({ database: sqlite }),
});

await DatabaseClient.schema
  .createTable("task")
  .ifNotExists()
  .addColumn("id", "text", (col) => col.primaryKey())
  .addColumn("title", "text", (col) => col.notNull())
  .addColumn("description", "text")
  .addColumn("status", "text", (col) => col.notNull())
  .addColumn("assignee", "text")
  .addColumn("created_at", "integer", (col) => col.notNull())
  .addColumn("updated_at", "integer", (col) => col.notNull())
  .execute();
