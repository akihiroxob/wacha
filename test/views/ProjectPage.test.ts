import test from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "hono/jsx/dom/server";

import { ProjectPage } from "@views/project.tsx";
import { Task } from "@domain/model/Task.ts";
import { Story } from "@domain/model/Story.ts";
import { Project } from "@domain/model/Project.ts";
import { ProjectMembership } from "@domain/model/ProjectMembership.ts";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { StoryStatus } from "@constants/StoryStatus.ts";
import { ProjectRole } from "@constants/ProjectRole.ts";

const project = new Project("project-1", "Wacha", "desc", "/repo/wacha", 1000, 2000);
const story = new Story("story-1", "project-1", "Story 1", "desc", StoryStatus.TODO, 1000, 2000);
const agent = new ProjectMembership("member-1", "project-1", "session-1", ProjectRole.MANAGER, 2000, 1000, 2000);

test("ProjectPage renders accept and reject actions for wait_accept tasks", () => {
  const task = new Task(
    "task-1",
    "project-1",
    "story-1",
    "Task 1",
    "desc",
    TaskStatus.WAIT_ACCEPT,
    null,
    null,
    null,
    1000,
    2000,
  );

  const html = renderToString(
    ProjectPage({
      project,
      summary: {
        total: 1,
        byStatus: {
          [TaskStatus.TODO]: 0,
          [TaskStatus.DOING]: 0,
          [TaskStatus.IN_REVIEW]: 0,
          [TaskStatus.WAIT_ACCEPT]: 1,
          [TaskStatus.ACCEPTED]: 0,
          [TaskStatus.REJECTED]: 0,
        },
        lastUpdatedAt: 2000,
      },
      tasks: [task],
      stories: [story],
      agents: [agent],
      agentSummary: { total: 1 },
    }),
  );

  assert.match(html, /project\/project-1\/task\/task-1\/accept/);
  assert.match(html, /project\/project-1\/task\/task-1\/reject/);
  assert.match(html, /Reject reason/);
});

test("ProjectPage renders reject reason for rejected tasks", () => {
  const task = new Task(
    "task-2",
    "project-1",
    null,
    "Task 2",
    "desc",
    TaskStatus.REJECTED,
    null,
    "Need more tests",
    null,
    1000,
    2000,
  );

  const html = renderToString(
    ProjectPage({
      project,
      summary: {
        total: 1,
        byStatus: {
          [TaskStatus.TODO]: 0,
          [TaskStatus.DOING]: 0,
          [TaskStatus.IN_REVIEW]: 0,
          [TaskStatus.WAIT_ACCEPT]: 0,
          [TaskStatus.ACCEPTED]: 0,
          [TaskStatus.REJECTED]: 1,
        },
        lastUpdatedAt: 2000,
      },
      tasks: [task],
      stories: [],
      agents: [agent],
      agentSummary: { total: 1 },
    }),
  );

  assert.match(html, /Reject Reason/);
  assert.match(html, /Need more tests/);
});
