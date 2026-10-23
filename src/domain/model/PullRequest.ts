export type RepositoryWorkflow = {
  repository: string;
  baseBranch: string;
  requiredChecks: string[];
};

export type PullRequestReviewEvidence = {
  id: number;
  url: string;
  author: string;
  headSha: string;
  taskId: string;
  claimId: string;
  decision: "approve" | "reject";
};

export type PullRequestSnapshot = {
  number: number;
  url: string;
  repository: string;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  author: string;
  state: "open" | "closed" | "merged";
  draft: boolean;
  mergeSha: string | null;
  reviewEvidence: PullRequestReviewEvidence[];
  checks: { name: string; state: string }[];
};

export interface PullRequestGateway {
  getPullRequest(repository: string, number: number): Promise<PullRequestSnapshot>;
}

export const checksPassed = (pr: PullRequestSnapshot, required: string[]): boolean =>
  required.every((name) =>
    pr.checks.some((check) => check.name === name) &&
    pr.checks.filter((check) => check.name === name).every((check) => check.state === "success"),
  );
