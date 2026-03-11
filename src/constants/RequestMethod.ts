export const RequestMethod = {
  TASK_ISSUE: "task.issue",
  TASK_CLAIM: "task.claim",
  TASK_COMPLETE: "task.complete",
  TASK_ACCEPT: "task.accept",
  TASK_REJECT: "task.reject",
  TASK_LIST: "task.list",
} as const;

export type RequestMethod = (typeof RequestMethod)[keyof typeof RequestMethod];
