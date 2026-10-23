import test from "node:test";
import assert from "node:assert/strict";
import { GitHubPullRequestGateway } from "../../../src/infrastructure/github/GitHubPullRequestGateway.ts";
import { checksPassed } from "@domain/model/PullRequest.ts";

const head = "a".repeat(40);
function gateway(comments: unknown[], checks = [{ name: "verify", status: "completed", conclusion: "success" }]) {
  return new GitHubPullRequestGateway(async (url) => {
    const path = String(url);
    const body = path.includes("/comments?") ? comments : path.includes("/check-runs?") ? { check_runs: checks }
      : path.includes("/statuses?") ? [] : {
        number: 1, html_url: "https://github.com/org/repo/pull/1", base: { ref: "main", repo: { full_name: "org/repo" } },
        head: { ref: "task", sha: head }, user: { login: "same-account" }, state: "closed", draft: false,
        merged: true, merge_commit_sha: "b".repeat(40),
      };
    return new Response(JSON.stringify(body));
  });
}
const comment = (body: string) => ({ id: 42, html_url: "https://github.com/org/repo/pull/1#issuecomment-42", user: { login: "same-account" }, body });

test("same-account review comments retain Claim and head evidence without duplicating the body", async () => {
  const marker = { taskId: "task", claimId: "review-claim", headSha: head, decision: "approve" };
  const snapshot = await gateway([comment(`Verified AC\n\n<!-- task-review: ${JSON.stringify(marker)} -->`)]).getPullRequest("org/repo", 1);
  assert.equal(snapshot.reviewEvidence[0]?.author, snapshot.author);
  assert.equal(snapshot.reviewEvidence[0]?.claimId, marker.claimId);
  assert.equal(snapshot.reviewEvidence[0]?.headSha, head);
  assert.equal("body" in snapshot.reviewEvidence[0]!, false);
});

test("ordinary and malformed comments are not approval evidence", async () => {
  for (const body of ["LGTM", "<!-- task-review: invalid -->", '<!-- task-review: {"headSha":"old","decision":"approve"} -->']) {
    assert.deepEqual((await gateway([comment(body)]).getPullRequest("org/repo", 1)).reviewEvidence, []);
  }
});

test("missing, pending, failed and ambiguous checks fail closed", async () => {
  const pr = await gateway([]).getPullRequest("org/repo", 1);
  assert.equal(checksPassed(pr, ["verify"]), true);
  assert.equal(checksPassed(pr, []), false);
  assert.equal(checksPassed(pr, ["missing"]), false);
  assert.equal(checksPassed({ ...pr, checks: [...pr.checks, { name: "verify", state: "failure" }] }, ["verify"]), false);
});

test("GitHub permission errors are structured and non-retryable without exposing tokens", async () => {
  const client = new GitHubPullRequestGateway(async () => new Response("secret", { status: 403 }));
  await assert.rejects(client.getPullRequest("org/repo", 1), (error: any) =>
    error.code === "GITHUB_ACCESS_DENIED" && !error.retryable && !error.message.includes("secret"));
});
