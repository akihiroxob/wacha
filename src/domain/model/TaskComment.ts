export class TaskComment {
  constructor(
    public id: string,
    public taskId: string,
    public body: string,
    public author: string | null,
    public createdAt: number,
    // 投稿したMCPセッション。Web UIなどセッション外からの投稿はnull
    public sessionId: string | null = null,
  ) {
    if (taskId.trim() === "") throw new Error("task comment taskId cannot be empty");
    if (body.trim() === "") throw new Error("task comment body cannot be empty");
  }
}
