import { Generated } from "kysely";
import type { ProjectRole } from "@constants/ProjectRole.ts";

export interface ProjectMembershipTable {
  id: string;
  project_id: string;
  worker_id: string;
  role: ProjectRole;
  last_heartbeat_at: number | null;
  created_at: Generated<number>;
  updated_at: Generated<number>;
}
