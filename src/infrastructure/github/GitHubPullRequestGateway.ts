import { CoordinationError } from "@application/error/CoordinationError.ts";
import type { PullRequestGateway, PullRequestSnapshot, PullRequestReviewEvidence } from "@domain/model/PullRequest.ts";

type GitHubComment = { id: number; html_url: string; body: string; user: { login: string } };
type GitHubCheck = { name: string; status: string; conclusion: string };
type GitHubStatus = { context: string; state: string };
type GitHubPullRequest = {
  number: number; html_url: string; base: { ref: string; repo: { full_name: string } };
  head: { ref: string; sha: string }; user: { login: string }; state: "open" | "closed";
  merged: boolean; draft: boolean; merge_commit_sha: string | null;
};

/** Read-only GitHub integration. Credentials stay in the server environment. */
export class GitHubPullRequestGateway implements PullRequestGateway {
  constructor(private readonly request: typeof fetch = fetch) {}

  private async get<T>(path: string): Promise<T> {
    const token = process.env.WACHA_GITHUB_TOKEN;
    try {
      const response = await this.request(`https://api.github.com${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      });
      if (!response.ok) {
        const limited = response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after");
        throw new CoordinationError([401, 403, 404].includes(response.status) && !limited ? "GITHUB_ACCESS_DENIED" : "GITHUB_UNAVAILABLE",
          `GitHub returned HTTP ${response.status}`);
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof CoordinationError) throw error;
      throw new CoordinationError("GITHUB_UNAVAILABLE", error instanceof Error ? error.message : "GitHub request failed");
    }
  }

  private async pages<T>(path: string, key?: string): Promise<T[]> {
    const result: T[] = [];
    // Fail closed rather than silently ignore checks/reviews beyond the cap.
    for (let page = 1; page <= 20; page++) {
      const body = await this.get<T[] | Record<string, T[]>>(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
      const entries = key ? (body as Record<string, T[]>)[key] : body;
      if (!Array.isArray(entries)) throw new CoordinationError("GITHUB_UNAVAILABLE", "Invalid GitHub response");
      result.push(...entries);
      if (entries.length < 100) return result;
    }
    throw new CoordinationError("GITHUB_UNAVAILABLE", "GitHub pagination limit reached");
  }

  async getPullRequest(repository: string, number: number): Promise<PullRequestSnapshot> {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository) || !Number.isSafeInteger(number) || number < 1) {
      throw new CoordinationError("INVALID_INPUT", "Invalid GitHub repository or PR number");
    }
    const path = `/repos/${repository}`;
    const pr = await this.get<GitHubPullRequest>(`${path}/pulls/${number}`);
    if (pr.number !== number || !/^[a-f0-9]{40}$/.test(pr.head?.sha ?? "") || !pr.base?.repo?.full_name || !pr.user?.login) {
      throw new CoordinationError("GITHUB_UNAVAILABLE", "Invalid GitHub PR response");
    }
    const [reviews, runs, statuses] = await Promise.all([
      this.pages<GitHubComment>(`${path}/issues/${number}/comments`),
      this.pages<GitHubCheck>(`${path}/commits/${pr.head.sha}/check-runs?filter=latest`, "check_runs"),
      this.pages<GitHubStatus>(`${path}/commits/${pr.head.sha}/statuses`),
    ]);
    const reviewEvidence: PullRequestReviewEvidence[] = [];
    for (const review of reviews) {
      const marker = review.body?.match(/<!-- task-review: (\{[^\n]+\}) -->/);
      if (!marker) continue;
      try {
        const evidence = JSON.parse(marker[1]!);
        if (!/^[a-f0-9]{40}$/.test(evidence.headSha ?? "") || typeof evidence.taskId !== "string" ||
          typeof evidence.claimId !== "string" || !["approve", "reject"].includes(evidence.decision)) continue;
        reviewEvidence.push({ id: review.id, url: review.html_url, author: review.user.login,
          headSha: evidence.headSha, taskId: evidence.taskId, claimId: evidence.claimId, decision: evidence.decision });
      } catch { /* Ordinary PR comments are not workflow evidence. */ }
    }
    const latestStatuses = new Map<string, string>();
    for (const status of statuses) {
      if (!latestStatuses.has(status.context)) latestStatuses.set(status.context, status.state);
    }
    const checks = [
      ...runs.map((run) => ({ name: run.name, state: run.status === "completed" ? run.conclusion : "pending" })),
      ...[...latestStatuses].map(([name, state]) => ({ name, state })),
    ];
    return {
      number: pr.number,
      url: pr.html_url,
      repository: pr.base.repo.full_name,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      headSha: pr.head.sha,
      author: pr.user.login,
      state: pr.merged ? "merged" : pr.state,
      draft: pr.draft,
      mergeSha: pr.merged ? pr.merge_commit_sha : null,
      reviewEvidence,
      checks,
    };
  }
}
