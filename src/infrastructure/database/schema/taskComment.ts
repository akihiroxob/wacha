export interface TaskCommentTable {
  id: string;
  task_id: string;
  body: string;
  author: string | null;
  created_at: number;
}
