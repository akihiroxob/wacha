import test from "node:test";
import assert from "node:assert/strict";

import { FileKnowledgeRepository } from "@repository/FileKnowledgeRepository.ts";

const repository = new FileKnowledgeRepository();

test("FileKnowledgeRepository.getContent returns knowledge file content", async () => {
  const content = await repository.getContent("tips/task-writing.md");

  assert.equal(typeof content, "string");
  assert.ok(content);
  assert.match(content, /完了条件/);
});

test("FileKnowledgeRepository.getContent returns undefined for missing files", async () => {
  const content = await repository.getContent("missing/file.md");

  assert.equal(content, undefined);
});
