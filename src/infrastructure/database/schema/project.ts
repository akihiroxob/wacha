import { Generated } from "kysely";

export interface ProjectTable {
  id: string;
  name: string;
  description: string | null;
  basedir: string;
  created_at: Generated<number>;
  updated_at: Generated<number>;
}
