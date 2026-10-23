import type { Generated } from "kysely";

export interface TaskPullRequestTable {
  id: Generated<number>;
  task_id: string;
  repository: string;
  number: number;
  work_claim_id: string;
  snapshot: string;
  reviewed_head_sha: string | null;
  reviewed_comment_id: number | null;
  accepted_merge_sha: string | null;
  acceptance_evidence: string | null;
  created_at: number;
  updated_at: number;
}
