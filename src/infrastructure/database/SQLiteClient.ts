import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { DataBase } from "./schema/index.ts";

const databasePath = process.env.WACHA_DB_PATH ?? "wacha.db";
const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");

export const DatabaseClient = new Kysely<DataBase>({
  dialect: new SqliteDialect({ database: sqlite }),
});
