import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Knowledge } from "@domain/model/Knowledge.ts";
import { KnowledgeRepository } from "@domain/repository/KnowledgeRepository.ts";

export class FileKnowledgeRepository implements KnowledgeRepository {
  private knowledgePath: string;

  constructor() {
    this.knowledgePath = fileURLToPath(new URL("../../../knowledge", import.meta.url));
  }

  async getKnowledge(path: string): Promise<Knowledge | undefined> {
    const filePath = `${this.knowledgePath}/${path}`;
    try {
      const content = await readFile(filePath, "utf-8");
      return new Knowledge(path, content);
    } catch (err: any) {
      return undefined; // ファイルが存在しない場合はundefinedを返す
    }
  }
}
