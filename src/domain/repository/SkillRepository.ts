import { Skill } from "@domain/model/Skill.ts";

export interface SkillRepository {
  list(): Promise<Skill[]>;
  findByName(name: string): Promise<Skill | undefined>;
}
