import { Generated } from "kysely";
import type { TaskStatus } from "@constants/TaskStatus.ts";

export type ResumeSourceStatus = Extract<TaskStatus, "todo" | "rejected">;

export interface TaskTable {
  id: string;
  project_id: string;
  story_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string | null;
  reject_reason: string | null;
  resume_source_status: ResumeSourceStatus | null;
  created_at: Generated<number>;
  updated_at: Generated<number>;
}
