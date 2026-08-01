export type TaskClaimState = "active" | "completed" | "released" | "expired";

export interface TaskClaimTable {
  id: string;
  task_id: string;
  principal_id: string;
  state: TaskClaimState;
  acquired_at: number;
  renewed_at: number | null;
  expires_at: number;
  released_at: number | null;
  release_reason: string | null;
}
