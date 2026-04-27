import test from "node:test";
import assert from "node:assert/strict";

import { FileKnowledgeRepository } from "@repository/FileKnowledgeRepository.ts";
import { Knowledge } from "@domain/model/Knowledge.ts";

const repository = new FileKnowledgeRepository();

test("FileKnowledgeRepository.getKnowledge returns knowledge file content", async () => {
  const knowledge = await repository.getKnowledge("tips/task-writing.md");

  assert.ok(knowledge instanceof Knowledge);
  assert.equal(knowledge?.path, "tips/task-writing.md");
  assert.match(knowledge?.content ?? "", /完了条件/);
});

test("FileKnowledgeRepository.getKnowledge returns undefined for missing files", async () => {
  const knowledge = await repository.getKnowledge("missing/file.md");

  assert.equal(knowledge, undefined);
});
