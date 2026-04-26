import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Skill } from "@domain/model/Skill.ts";
import matter from "gray-matter";

export class SkillRepository {
  private skillsPath: string;

  constructor() {
    this.skillsPath = fileURLToPath(new URL("../../../skill", import.meta.url));
  }

  async list() {
    const files = await readdir(this.skillsPath);
    return await Promise.all(
      files
        .filter((file) => file.endsWith(".md"))
        .map(async (file) => {
          const mdtext = await readFile(`${this.skillsPath}/${file}`, "utf-8");
          const { data, content } = matter(mdtext);
          return new Skill(
            data.name,
            data.description,
            data.allowRoles,
            data.requiredKnowledge,
            data.requiredTools,
            content.trim(),
          );
        }),
    );
  }

  async findByName(name: string) {
    const skills = await this.list();
    return skills.find((skill) => skill.name === name);
  }
}
