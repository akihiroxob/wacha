import { ProjectRole } from "@constants/ProjectRole.ts";
import { SkillStatus } from "@constants/SkillStatus.ts";

export class Skill {
  constructor(
    public name: string,
    public description: string,
    public status: SkillStatus,
    public version: number,
    public allowRoles: ProjectRole[],
    public requiredKnowledge: string[],
    public requiredTools: string[],
    public content: string,
  ) {
    if (name.trim() === "") {
      throw new Error("Skill name cannot be empty");
    }
  }
}
