import { Generated } from "kysely";
import type { StoryStatus } from "@constants/StoryStatus.ts";

export interface StoryTable {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: StoryStatus;
  sort_order: Generated<number>;
  created_at: Generated<number>;
  updated_at: Generated<number>;
}
