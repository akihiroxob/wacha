import { Skill } from "@domain/model/Skill.ts";
import { Knowledge } from "@domain/model/Knowledge.ts";
import { SkillRepository } from "@domain/repository/SkillRepository.ts";
import { KnowledgeRepository } from "@domain/repository/KnowledgeRepository.ts";

interface GetSkillContextUseCaseInput {
  name: string;
}

interface GetSkillContextUseCaseResult {
  skill: Skill;
  knowledge: Knowledge[];
}

export class GetSkillContextUseCase {
  constructor(
    private skillRepository: SkillRepository,
    private knowledgeRepository: KnowledgeRepository,
  ) {}

  async execute({ name }: GetSkillContextUseCaseInput): Promise<GetSkillContextUseCaseResult> {
    const skill = await this.skillRepository.findByName(name);
    if (!skill) throw new Error("Skill not found");

    const knowledge: Knowledge[] = [];
    for (const path of skill.requiredKnowledge) {
      const knowledgeItem = await this.knowledgeRepository.getKnowledge(path);
      if (!knowledgeItem) {
        throw new Error(`Required knowledge not found: ${path}`);
      }
      knowledge.push(knowledgeItem);
    }

    return { skill, knowledge };
  }
}
