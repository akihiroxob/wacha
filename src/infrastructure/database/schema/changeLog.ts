import type { Generated } from "kysely";

export interface ChangeLogTable {
  cursor: Generated<number>;
  project_id: string;
  type: string;
  entity_id: string;
  principal_id: string;
  claim_id: string | null;
  payload: string;
  occurred_at: number;
}
