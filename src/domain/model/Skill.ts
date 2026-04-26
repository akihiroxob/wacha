import { ProjectRole } from "@constants/ProjectRole.ts";

export class Skill {
  constructor(
    public name: string,
    public description: string,
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
