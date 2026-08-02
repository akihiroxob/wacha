import type { TaskStatus } from "@constants/TaskStatus.ts";

export type ActiveTaskClaim = {
  claimId: string;
  taskId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  principalId: string;
  acquiredAt: number;
  renewedAt: number | null;
  expiresAt: number;
};

export type UnclaimedDoingTask = {
  taskId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  lastPrincipalId: string | null;
  lastExpiresAt: number | null;
};

export type ProjectChange = {
  cursor: number;
  type: string;
  entityId: string;
  entityTitle: string | null;
  principalId: string;
  claimId: string | null;
  payload: Record<string, unknown>;
  occurredAt: number;
};

export interface ProjectActivityRepository {
  listActiveClaims(projectId: string, now: number): Promise<ActiveTaskClaim[]>;
  listUnclaimedDoingTasks(projectId: string, now: number): Promise<UnclaimedDoingTask[]>;
  listRecentChanges(projectId: string, limit: number): Promise<ProjectChange[]>;
}
