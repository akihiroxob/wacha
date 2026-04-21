export class TaskReject {
  constructor(
    public id: string,
    public taskId: string,
    public reason: string,
    public author: string | null,
    public createdAt: number,
  ) {
    if (taskId.trim() === "") throw new Error("task reject taskId cannot be empty");
    if (reason.trim() === "") throw new Error("task reject reason cannot be empty");
  }
}
