import { TaskStatus } from "@constants/TaskStatus.ts";

export type ResumeSourceStatus = typeof TaskStatus.TODO | typeof TaskStatus.REJECTED;

export class Task {
  constructor(
    public id: string,
    public projectId: string,
    public storyId: string | null,
    public title: string,
    public description: string | null,
    public status: TaskStatus,
    public assignee: string | null,
    public rejectReason: string | null,
    public resumeSourceStatus: ResumeSourceStatus | null,
    public createdAt: number,
    public updatedAt: number,
  ) {
    if (projectId.trim() === "") {
      throw new Error("task projectId cannot be empty");
    }
    if (title.trim() === "") {
      throw new Error("task title cannot be empty");
    }
  }

  claim(sessionId: string) {
    if (this.status !== TaskStatus.TODO && this.status !== TaskStatus.REJECTED) {
      throw new Error(`the task(${this.id}) is already claimed`);
    }
    this.resumeSourceStatus = this.status;
    this.status = TaskStatus.DOING;
    this.assignee = sessionId;
    this.updatedAt = Date.now();
  }

  complete() {
    if (this.status !== TaskStatus.DOING) {
      throw new Error(`the task(${this.id}) is not in doing status`);
    }
    this.status = TaskStatus.IN_REVIEW;
    this.resumeSourceStatus = null;
    this.updatedAt = Date.now();
  }

  reviewed() {
    if (this.status !== TaskStatus.IN_REVIEW) {
      throw new Error(`the task(${this.id}) is not in in_review status`);
    }
    this.status = TaskStatus.WAIT_ACCEPT;
    this.updatedAt = Date.now();
  }

  accept() {
    if (this.status !== TaskStatus.IN_REVIEW && this.status !== TaskStatus.WAIT_ACCEPT) {
      throw new Error(`the task(${this.id}) is not in acceptable review status`);
    }
    this.status = TaskStatus.ACCEPTED;
    this.rejectReason = null;
    this.resumeSourceStatus = null;
    this.updatedAt = Date.now();
  }

  reject(reason: string) {
    if (this.status !== TaskStatus.IN_REVIEW && this.status !== TaskStatus.WAIT_ACCEPT) {
      throw new Error(`the task(${this.id}) is not in reviewable status`);
    }
    if (reason.trim() === "") {
      throw new Error(`the task(${this.id}) reject reason cannot be empty`);
    }
    this.status = TaskStatus.REJECTED;
    this.rejectReason = reason.trim();
    this.resumeSourceStatus = null;
    this.updatedAt = Date.now();
  }
}
