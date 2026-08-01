import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { Project } from "@domain/model/Project.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";
import { initializeSchema } from "@database/initializeSchema.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";

const repository = new SQLiteProjectRepository();

beforeEach(async () => {
  await initializeSchema();
  await DatabaseClient.deleteFrom("task").execute();
  await DatabaseClient.deleteFrom("story").execute();
  await DatabaseClient.deleteFrom("project").execute();
});

test("SQLiteProjectRepository.create persists a project", async () => {
  const project = await repository.create("Wacha", "Task hub", "repo/wacha");

  const savedProject = await repository.findById(project.id);

  assert.equal(savedProject?.name, "Wacha");
  assert.equal(savedProject?.description, "Task hub");
  assert.equal(savedProject?.baseDir, "repo/wacha");
});

test("SQLiteProjectRepository.findAll returns persisted projects", async () => {
  await repository.create("Wacha", null, "repo/wacha");
  await repository.create("Portal", null, "repo/portal");

  const projects = await repository.findAll();

  assert.equal(projects.length, 2);
});

test("SQLiteProjectRepository.save updates an existing project", async () => {
  const project = await repository.create("Wacha", null, "repo/wacha");
  project.changeName("Wacha Core");
  project.changeDescription("Core task hub");

  await repository.save(project);

  const savedProject = await repository.findById(project.id);
  assert.equal(savedProject?.name, "Wacha Core");
  assert.equal(savedProject?.description, "Core task hub");
});

test("SQLiteProjectRepository.save throws for a missing project", async () => {
  const project = new Project(
    "missing-project",
    "Wacha",
    null,
    "repo/wacha",
    1000,
    1000,
  );

  await assert.rejects(() => repository.save(project), /Project not found/);
});
