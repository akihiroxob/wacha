import { Generated } from "kysely";
import type { TaskStatus } from "@constants/TaskStatus.ts";

export interface TaskTable {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string | null;
  created_at: Generated<number>;
  updated_at: Generated<number>;
}
