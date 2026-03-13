import test from "node:test";
import assert from "node:assert/strict";

import { Project } from "@domain/model/Project.ts";

test("Project allows description to be cleared", () => {
  const project = new Project("project-1", "Wacha", "desc", "repo/wacha", 1000, 1000);

  project.changeDescription("");

  assert.equal(project.description, null);
});

test("Project rejects empty name", () => {
  assert.throws(
    () => new Project("project-1", "", null, "repo/wacha", 1000, 1000),
    /project name cannot be empty/,
  );
});
