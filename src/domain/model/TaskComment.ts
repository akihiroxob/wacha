export class TaskComment {
  constructor(
    public id: string,
    public taskId: string,
    public body: string,
    public author: string | null,
    public createdAt: number,
  ) {
    if (taskId.trim() === "") throw new Error("task comment taskId cannot be empty");
    if (body.trim() === "") throw new Error("task comment body cannot be empty");
  }
}
