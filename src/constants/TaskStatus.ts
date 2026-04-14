export const TaskStatus = {
  TODO: "todo", // <task.create> -> todo
  DOING: "doing", // todo -> <task.claim> -> doing
  IN_REVIEW: "in_review", // doing -> <task.complete> -> in_review
  WAIT_ACCEPT: "wait_accept", // in_review -> <task.reviewed> -> wait_accept
  ACCEPTED: "accepted", // wait_accept -> <task.accept> -> accepted
  REJECTED: "rejected", // in_review -> <task.reject> -> rejected
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
