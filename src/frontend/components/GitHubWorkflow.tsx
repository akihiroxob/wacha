import { useState } from "react";
import type { FormEvent } from "react";
import type { RepositoryWorkflowDto, TaskPullRequestDto } from "@shared/apiTypes";
import { useConfigureWorkflow } from "@/lib/queries";
import "./GitHubWorkflow.scss";

export const RepositoryWorkflowSettings = ({ projectId, workflow }: {
  projectId: string; workflow: RepositoryWorkflowDto | null;
}) => {
  const save = useConfigureWorkflow(projectId);
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    save.mutate({ repository: String(fields.get("repository") ?? "").trim(),
      baseBranch: String(fields.get("baseBranch") ?? "").trim(),
      requiredChecks: String(fields.get("checks") ?? "").split("\n").map((name) => name.trim()).filter(Boolean),
    }, { onSuccess: () => setError(""), onError: (reason) => setError(reason.message) });
  };
  return <details className="github-workflow">
    <summary>GitHub連携 {workflow ? `— ${workflow.repository}` : "— 未設定"}</summary>
    <form key={JSON.stringify(workflow)} onSubmit={submit}>
      <label>Repository<input name="repository" placeholder="owner/repository" defaultValue={workflow?.repository} required /></label>
      <label>統合先Branch<input name="baseBranch" defaultValue={workflow?.baseBranch ?? "main"} required /></label>
      <label>CIチェック名（任意・1行1件、空欄ならCI確認なし）<textarea name="checks" defaultValue={workflow?.requiredChecks.join("\n") ?? ""} /></label>
      <p>進行中のTaskがある間は変更できません。設定後はPRのマージとAC確認が必要です。</p>
      <button disabled={save.isPending}>保存</button>
      {workflow && <button type="button" disabled={save.isPending} onClick={() => save.mutate(null, {
        onSuccess: () => setError(""), onError: (reason) => setError(reason.message),
      })}>連携を解除</button>}
      {error && <p role="alert">{error}</p>}
    </form>
  </details>;
};

export const PullRequestHistory = ({ pullRequests }: { pullRequests: TaskPullRequestDto[] }) => {
  if (!pullRequests.length) return null;
  return <section className="github-workflow" aria-label="Pull Request履歴">
    <h5>Pull Request履歴</h5>
    <ol>{pullRequests.map((pr) => <li key={pr.id}>
      <a href={pr.url} target="_blank" rel="noreferrer">#{pr.number} {pr.headBranch}</a> — {pr.state}
      <dl><dt>Head</dt><dd><code>{pr.headSha}</code></dd>
        {pr.mergeSha && <><dt>Merge</dt><dd><code>{pr.mergeSha}</code></dd></>}
      </dl>
      <ul>{pr.checks.map((check, index) => <li key={`${check.name}-${index}`}>{check.name}: {check.state}</li>)}</ul>
      {pr.acceptanceEvidence && <p>{pr.acceptanceEvidence}</p>}
    </li>)}</ol>
    <p>表示は最終確認時点の状態です。現在の状態はGitHubで確認できます。</p>
  </section>;
};


export const AcceptanceEvidence = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <div className="github-workflow">
    <label>AC確認結果
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="マージされた版で確認したACと検証結果" />
    </label>
  </div>
);
