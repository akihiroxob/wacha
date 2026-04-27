import { Skill } from "@domain/model/Skill.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";
import { SkillStatus } from "@constants/SkillStatus.ts";
import { SkillRepository } from "@domain/repository/SkillRepository.ts";

interface ListSkillUseCaseInput {
  status?: SkillStatus;
  role?: ProjectRole;
}

interface ListSkillUseCaseResult {
  skills: Skill[];
}

type SkillListRepository = Pick<SkillRepository, "list">;

export class ListSkillUseCase {
  constructor(private skillRepository: SkillListRepository) {}

  async execute(input: ListSkillUseCaseInput = {}): Promise<ListSkillUseCaseResult> {
    const skills = await this.skillRepository.list();
    const { status, role } = input;

    return {
      skills: skills
        .filter((skill) => (status ? skill.status === status : true))
        .filter((skill) => (role ? skill.allowRoles.includes(role) : true))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
