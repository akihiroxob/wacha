export const ProjectRole = {
  MANAGER: "manager",
  REVIEWER: "reviewer",
  WORKER: "worker",
} as const;

export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];
