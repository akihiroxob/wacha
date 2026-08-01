import type { ProjectRole } from "@constants/ProjectRole.ts";

export type ProjectGrant = {
  projectId: string;
  principalId: string;
  role: ProjectRole;
  createdAt: number;
};
