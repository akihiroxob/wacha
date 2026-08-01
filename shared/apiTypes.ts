// Wire contract shared between the Hono API (src/) and the SPA (frontend/).
// This file must stay self-contained: no imports from src/ or frontend/.

export type StoryStatus = "todo" | "doing" | "done" | "canceled";

export type TaskStatus =
  | "todo"
  | "doing"
  | "canceled"
  | "in_review"
  | "wait_accept"
  | "accepted"
  | "rejected";

export type ProjectRole = "manager" | "reviewer" | "worker" | "viewer";

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  baseDir: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoryDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: StoryStatus;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface TaskDto {
  id: string;
  projectId: string;
  storyId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string | null;
  rejectReason: string | null;
  resumeSourceStatus: "todo" | "rejected" | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface TaskCommentDto {
  id: string;
  taskId: string;
  body: string;
  author: string | null;
  sessionId: string | null;
  createdAt: number;
}

export interface ProjectGrantDto {
  id: string;
  projectId: string;
  principalId: string;
  role: ProjectRole;
  createdAt: number;
}

export interface TaskSummary {
  total: number;
  byStatus: Record<TaskStatus, number>;
  lastUpdatedAt: number | null;
}

export interface ProjectListResponse {
  projects: ProjectDto[];
}

export interface ProjectDetailResponse {
  project: ProjectDto;
  summary: TaskSummary;
  tasks: TaskDto[];
  comments: TaskCommentDto[];
  stories: StoryDto[];
  grants: ProjectGrantDto[];
  grantSummary: { total: number; principals: number };
}

export interface StoryInput {
  title: string;
  description?: string;
  sortOrder?: number;
}

export interface TaskInput {
  title: string;
  description?: string;
  sortOrder?: number;
}

export interface MoveStoryInput {
  direction: "up" | "down";
}

export interface ReasonInput {
  reason: string;
}

export interface CommentInput {
  body: string;
  author?: string;
}

export interface ProjectGrantInput {
  principalId: string;
  role: Exclude<ProjectRole, "viewer">;
}

export interface CreateStoryResponse {
  story: StoryDto;
}

export interface OkResponse {
  ok: true;
}

export interface ApiErrorBody {
  error: { message: string };
}
