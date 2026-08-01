import type { ProjectRole } from "@constants/ProjectRole.ts";

export interface ProjectGrantTable {
  project_id: string;
  principal_id: string;
  role: ProjectRole;
  created_at: number;
}
