import { Skill } from "@domain/model/Skill.ts";
import { SkillRepository } from "@domain/repository/SkillRepository.ts";

interface ListSkillUseCaseResult {
  skills: Skill[];
}

type SkillListRepository = Pick<SkillRepository, "list">;

export class ListSkillUseCase {
  constructor(private skillRepository: SkillListRepository) {}

  async execute(): Promise<ListSkillUseCaseResult> {
    const skills = await this.skillRepository.list();

    return {
      skills: skills.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}
