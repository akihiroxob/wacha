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
  createdAt: number;
  updatedAt: number;
}

export interface TaskCommentDto {
  id: string;
  taskId: string;
  body: string;
  author: string | null;
  createdAt: number;
}

export interface AgentDto {
  id: string;
  projectId: string;
  sessionId: string;
  role: ProjectRole;
  lastHeartbeatAt: number | null;
  createdAt: number;
  updatedAt: number;
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
  agents: AgentDto[];
  agentSummary: { total: number };
}

export interface StoryInput {
  title: string;
  description?: string;
}

export interface TaskInput {
  title: string;
  description?: string;
}

export interface ReasonInput {
  reason: string;
}

export interface CommentInput {
  body: string;
  author?: string;
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
