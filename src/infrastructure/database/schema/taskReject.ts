export interface TaskRejectTable {
  id: string;
  task_id: string;
  reason: string;
  author: string | null;
  created_at: number;
}
