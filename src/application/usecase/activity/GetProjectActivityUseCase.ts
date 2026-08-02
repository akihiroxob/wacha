import type { ProjectActivityRepository } from "@domain/repository/ProjectActivityRepository.ts";

export class GetProjectActivityUseCase {
  constructor(
    private readonly projectActivityRepository: ProjectActivityRepository,
    private readonly clock: () => number = Date.now,
  ) {}

  async execute(projectId: string, changeLimit = 20) {
    const now = this.clock();
    const [activeClaims, unclaimedDoingTasks, changeRows] = await Promise.all([
      this.projectActivityRepository.listActiveClaims(projectId, now),
      this.projectActivityRepository.listUnclaimedDoingTasks(projectId, now),
      this.projectActivityRepository.listRecentChanges(projectId, changeLimit + 1),
    ]);
    return {
      activeClaims,
      unclaimedDoingTasks,
      changes: changeRows.slice(0, changeLimit),
      hasMoreChanges: changeRows.length > changeLimit,
    };
  }
}
