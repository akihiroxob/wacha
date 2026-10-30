# GitHubを正本とするTask実行

ProjectにRepository workflowが設定されている通常Task（`completionMode: pull_request`）では、Taskごとのbranch・worktree・PRを使う。Task管理サービスはPRの参照と検証結果を保持し、コードやPR本文を複製しない。

## Roleの責務

- Worker: 排他的Work Claimのもとで実装し、検証・文書更新を行ってopen PRを提出する。current ClaimでPRを登録し、実装・検証コメントを残して`in_review`へ進める。
- Reviewer: PR差分とhead SHAを固定して検証する。Task・current Review Claim・head SHAを示すPRコメントに判定と根拠を残し、指定したCIチェックの成功（未指定なら確認なし）とbranch保護の条件を満たしてマージする。マージとレビューしたhead SHAを確認して`wait_accept`へ進める。
- Manager: マージcommitを対象にACと統合された動作を確認する。merge SHAと項目ごとの根拠を記録して`accepted`へ進める。不足は再受入条件とともに差し戻す。

Taskの状態と、PR・CI・マージの状態を混同しない。GitHub主体とTask管理のPrincipalは別の概念とする。同一GitHubアカウント・PATを共有できるが、Worker・Reviewer・ManagerのPrincipalは分け、自己レビュー・自己受入は禁止する。GitHubのApproveを必須条件にしない。

## 差し戻し

Reviewerによるマージ前の差し戻しは、同じopen PRで修正する。新しいheadに対して再レビューし、旧head・旧Review Claimのコメントを流用しない。

Managerによるマージ後の差し戻しは、同じTaskの新規PRで対応する。最新の統合先branchを起点とし、前回のPR・レビュー・merge SHAを保持する。重大な回帰は必要に応じてrevert PRで対応する。

## 確認と復旧

- PR番号・repository・統合先branch、レビュー対象head SHA、merge SHAを照合する。ローカルの未送信コミットだけで完了にしない。
- CIの未完了・失敗・未設定を成功として扱わない。current Review Claimに紐づくレビューコメント、会話の解決、管理者を含むbranch保護を使用する。
- 通信途絶後はGitHubの現在状態とTask管理のcommand receiptを確認し、同じ入力・同じrequestIdで再送する。すでにマージ済みなら再マージしない。
- Claim期限切れ後は新しいClaimで再検証する。他者のClaim・古いClaimで状態を更新しない。
- 環境・権限・認証が変わらない限り解消しない問題は根拠を残して停止する。同じ操作の無制限な再起動を行わない。

実行RunnerがTask・Claim・専用worktreeを取得済みの場合は、そのContextを使用する。Agentは実装・評価・検証根拠をRunnerへ返し、Git/GitHub操作とTask状態遷移をRunnerへ委譲する。Claimを取り直さない。

## 変更を伴わない運用Task

ManagerがRepository変更を伴わないと判断したTaskには`completionMode: evidence`を選ぶ。Workerは実施内容・許可範囲・検証対象・操作結果・残る制約を記録し、ReviewerとManagerが独立に検証する。各段階のcurrent Claimに紐づくコメントを残し、Managerの受入根拠も記録する。PR・commit・mergeは作成しない。Taskを完了させるためだけの変更は作らない。

モードは`issue_task`・`edit_task`でManagerが指定し、Worker/Reviewerが結果JSONだけで変更しない。既定は`pull_request`。モード変更は有効ClaimとPR履歴がないtodo/rejectedのTaskに限る。実装変更が必要なら通常のPR方式でTaskを切り出す。Runnerが取得済みのTask/Claimと状態遷移の責務は、運用Taskでも維持する。
