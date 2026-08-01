export interface TaskCommentTable {
  id: string;
  task_id: string;
  body: string;
  author: string | null;
  session_id: string | null;
  principal_id: string | null;
  claim_id: string | null;
  created_at: number;
}
