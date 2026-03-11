import { TaskStatus } from "@constants/TaskStatus.ts";

export class Task {
  constructor(
    public id: string,
    public title: string,
    public description: string | null,
    public status: TaskStatus,
    public assignee: string | null,
    public createdAt: number,
    public updatedAt: number,
  ) {}

  claim(workerId: string) {
    if (this.status !== TaskStatus.TODO) {
      throw new Error(`the task(${this.id}) is already claimed`);
    }
    this.status = TaskStatus.DOING;
    this.assignee = workerId;
    this.updatedAt = Date.now();
  }

  complete() {
    if (this.status !== TaskStatus.DOING) {
      throw new Error(`the task(${this.id}) is not in doing status`);
    }
    this.status = TaskStatus.IN_REVIEW;
    this.updatedAt = Date.now();
  }

  accept() {
    if (this.status !== TaskStatus.IN_REVIEW) {
      throw new Error(`the task(${this.id}) is not in in_review status`);
    }
    this.status = TaskStatus.ACCEPTED;
    this.updatedAt = Date.now();
  }

  reject() {
    if (this.status !== TaskStatus.IN_REVIEW) {
      throw new Error(`the task(${this.id}) is not in in_review status`);
    }
    this.status = TaskStatus.REJECTED;
    this.updatedAt = Date.now();
  }
}
