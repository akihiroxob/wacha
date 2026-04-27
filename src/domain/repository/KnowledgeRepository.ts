import { Knowledge } from "@domain/model/Knowledge.ts";
export interface KnowledgeRepository {
  getKnowledge(path: string): Promise<Knowledge | undefined>;
}
