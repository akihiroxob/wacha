import { Generated } from "kysely";
import type { StoryStatus } from "@constants/StoryStatus.ts";

export interface StoryTable {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: StoryStatus;
  created_at: Generated<number>;
  updated_at: Generated<number>;
}
