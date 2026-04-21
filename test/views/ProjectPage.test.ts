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
      storyStatusFilter: "all",
    }),
  );

  assert.match(html, /project\/project-1\/task\/task-1\/accept/);
  assert.match(html, /project\/project-1\/task\/task-1\/reject/);
  assert.match(html, /Reject reason/);
});

test("ProjectPage renders accept and reject actions for in_review tasks", () => {
  const task = new Task(
    "task-1",
    "project-1",
    "story-1",
    "Task 1",
    "desc",
    TaskStatus.IN_REVIEW,
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
          [TaskStatus.IN_REVIEW]: 1,
          [TaskStatus.WAIT_ACCEPT]: 0,
          [TaskStatus.ACCEPTED]: 0,
          [TaskStatus.REJECTED]: 0,
        },
        lastUpdatedAt: 2000,
      },
      tasks: [task],
      stories: [story],
      agents: [agent],
      agentSummary: { total: 1 },
      storyStatusFilter: "all",
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
      storyStatusFilter: "all",
    }),
  );

  assert.match(html, /Reject Reason/);
  assert.match(html, /Need more tests/);
});

test("ProjectPage renders story sections collapsed by default", () => {
  const task = new Task(
    "task-1",
    "project-1",
    "story-1",
    "Task 1",
    "desc",
    TaskStatus.TODO,
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
          [TaskStatus.TODO]: 1,
          [TaskStatus.DOING]: 0,
          [TaskStatus.IN_REVIEW]: 0,
          [TaskStatus.WAIT_ACCEPT]: 0,
          [TaskStatus.ACCEPTED]: 0,
          [TaskStatus.REJECTED]: 0,
        },
        lastUpdatedAt: 2000,
      },
      tasks: [task],
      stories: [story],
      agents: [agent],
      agentSummary: { total: 1 },
      storyStatusFilter: "all",
    }),
  );

  assert.match(html, /<details[^>]*data-story-id="story-1"/);
  assert.doesNotMatch(html, /<details[^>]*data-story-id="story-1"[^>]* open/);
  assert.match(html, /<details[^>]*name="story-accordion"[^>]*data-story-id="story-1"/);
  assert.match(html, /<summary[^>]*>/);
});

test("ProjectPage renders edit action for stories", () => {
  const html = renderToString(
    ProjectPage({
      project,
      summary: {
        total: 0,
        byStatus: {
          [TaskStatus.TODO]: 0,
          [TaskStatus.DOING]: 0,
          [TaskStatus.IN_REVIEW]: 0,
          [TaskStatus.WAIT_ACCEPT]: 0,
          [TaskStatus.ACCEPTED]: 0,
          [TaskStatus.REJECTED]: 0,
        },
        lastUpdatedAt: 2000,
      },
      tasks: [],
      stories: [story],
      agents: [agent],
      agentSummary: { total: 1 },
      storyStatusFilter: "all",
    }),
  );

  assert.match(html, /project\/project-1\/story\/story-1\/edit/);
  assert.match(html, /編集/);
});

test("ProjectPage groups story sections into a single-open accordion", () => {
  const secondStory = new Story("story-2", "project-1", "Story 2", "desc", StoryStatus.DOING, 1000, 2000);

  const html = renderToString(
    ProjectPage({
      project,
      summary: {
        total: 2,
        byStatus: {
          [TaskStatus.TODO]: 2,
          [TaskStatus.DOING]: 0,
          [TaskStatus.IN_REVIEW]: 0,
          [TaskStatus.WAIT_ACCEPT]: 0,
          [TaskStatus.ACCEPTED]: 0,
          [TaskStatus.REJECTED]: 0,
        },
        lastUpdatedAt: 2000,
      },
      tasks: [
        new Task("task-1", "project-1", "story-1", "Task 1", "desc", TaskStatus.TODO, null, null, null, 1000, 2000),
        new Task("task-2", "project-1", "story-2", "Task 2", "desc", TaskStatus.TODO, null, null, null, 1000, 2000),
      ],
      stories: [story, secondStory],
      agents: [agent],
      agentSummary: { total: 1 },
      storyStatusFilter: "all",
    }),
  );

  assert.equal((html.match(/name="story-accordion"/g) ?? []).length, 2);
  assert.match(html, /Story 1/);
  assert.match(html, /Story 2/);
});

test("ProjectPage keeps Tasks Without Story visible while stories are filtered", () => {
  const visibleStory = new Story("story-1", "project-1", "Todo Story", "desc", StoryStatus.TODO, 1000, 2000);
  const unassignedTask = new Task(
    "task-2",
    "project-1",
    null,
    "Standalone Task",
    "desc",
    TaskStatus.DOING,
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
        total: 2,
        byStatus: {
          [TaskStatus.TODO]: 1,
          [TaskStatus.DOING]: 1,
          [TaskStatus.IN_REVIEW]: 0,
          [TaskStatus.WAIT_ACCEPT]: 0,
          [TaskStatus.ACCEPTED]: 0,
          [TaskStatus.REJECTED]: 0,
        },
        lastUpdatedAt: 2000,
      },
      tasks: [
        new Task(
          "task-1",
          "project-1",
          "story-1",
          "Story Task",
          "desc",
          TaskStatus.TODO,
          null,
          null,
          null,
          1000,
          2000,
        ),
        unassignedTask,
      ],
      stories: [visibleStory],
      agents: [agent],
      agentSummary: { total: 1 },
      storyStatusFilter: StoryStatus.TODO,
    }),
  );

  assert.match(html, /name="storyStatus"/);
  assert.match(html, /<option value="todo" selected=""/);
  assert.match(html, /Todo Story/);
  assert.match(html, /Tasks Without Story/);
  assert.match(html, /Standalone Task/);
});
