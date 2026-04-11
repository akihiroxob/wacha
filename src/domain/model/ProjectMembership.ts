import { ProjectRole } from "@constants/ProjectRole.ts";

export class ProjectMembership {
  constructor(
    public id: string,
    public projectId: string,
    public sessionId: string,
    public role: ProjectRole,
    public lastHeartbeatAt: number | null,
    public createdAt: number,
    public updatedAt: number,
  ) {
    if (projectId.trim() === "") {
      throw new Error("projectMembership projectId cannot be empty");
    }
    if (sessionId.trim() === "") {
      throw new Error("projectMembership sessionId cannot be empty");
    }
  }

  heartbeat(timestamp = Date.now()) {
    this.lastHeartbeatAt = timestamp;
  }
}
