import { Skill } from "@domain/model/Skill.ts";
import { Knowledge } from "@domain/model/Knowledge.ts";
import { SkillRepository } from "@domain/repository/SkillRepository.ts";
import { KnowledgeRepository } from "@domain/repository/KnowledgeRepository.ts";

interface GetSkillContextUseCaseInput {
  skillName: string;
}

interface GetSkillContextUseCaseResult {
  skill: Skill;
  knowledges: Knowledge[];
}

export class GetSkillContextUseCase {
  constructor(
    private skillRepository: SkillRepository,
    private knowledgeRepository: KnowledgeRepository,
  ) {}

  async execute({ skillName }: GetSkillContextUseCaseInput): Promise<GetSkillContextUseCaseResult> {
    const skill = await this.skillRepository.findByName(skillName);
    if (!skill) throw new Error("Skill not found");

    const knowledges = [];
    for (const path of skill.requiredKnowledge) {
      const knowledge = await this.knowledgeRepository.getKnowledge(path);
      if (knowledge) knowledges.push(knowledge);
    }

    return { skill, knowledges };
  }
}
