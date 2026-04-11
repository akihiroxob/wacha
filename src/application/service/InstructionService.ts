import { ProjectRole } from "@constants/ProjectRole.ts";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type InstructionName = ProjectRole | "role-policy";

export class InstructionService {
  async getInstructionContent(instructionName: InstructionName): Promise<string> {
    if (instructionName == ProjectRole.VIEWER) {
      throw new Error("Viewer role does not have specific instructions");
    }

    try {
      const root = fileURLToPath(new URL("../../../agent", import.meta.url));
      const instructionPath = `${root}/${instructionName}.md`;
      const content = await readFile(instructionPath, "utf-8");
      return content;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load instruction: ${detail}`);
    }
  }
}
