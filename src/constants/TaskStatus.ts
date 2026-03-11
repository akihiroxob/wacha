export const TaskStatus = {
  TODO: "todo", // task.create -> todo
  DOING: "doing",
  IN_REVIEW: "in_review", // doing -> task.complete -> in_review
  ACCEPTED: "accepted", // in_review -> task.accept -> accepted
  REJECTED: "rejected", // in_review -> task.reject -> rejected
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
