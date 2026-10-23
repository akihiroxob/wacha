# GitHub Task Workflow

## Project設定

Web UIのProject詳細にある「GitHub連携」で、`owner/repository`、統合先branch、任意のCIチェック名を設定する。チェック名はGitHubのjob名またはcommit statusのcontext名と一致させる。CI確認は任意。空欄（`requiredChecks: []`）ならCIを条件にせず、指定した場合は全チェックの成功を必須とする。

未設定のProjectはローカル方式を使用する。GitHub方式を設定したProjectでは、PRの登録・マージ・AC検証がTaskの状態遷移条件となる。`doing`・`in_review`・`wait_accept`のTaskがある間は設定を変更できない。未解決TaskにPR履歴がある場合は設定変更・連携解除ができない。

Serverの`WACHA_GITHUB_TOKEN`に、対象repositoryのPull requests、Contents、Checks、Commit statusesの読み取り権限を持つ資格情報を設定する。TokenはDB・Project設定・MCP応答へ保存しない。公開repositoryでは無認証読み取りも可能だが、安定運用には認証を使用する。

GitHub側では統合先branchを保護し、設定したCIチェック、PR経由の変更、会話の解決、管理者を含む保護を有効にする。GitHubの「承認レビュー必須」は使用しない。WorkerとReviewerは同じGitHubアカウント・PATを使用できる。WachaのPrincipalとRoleは分離し、自己レビュー・自己受入を禁止する。

## 状態と責務

| Phase | 主体 | 条件 |
| --- | --- | --- |
| `doing` → `in_review` | Worker | current Work Claimでopen・非draftのPRを登録し、同じClaimで実装・検証コメントを記録する |
| `in_review` → `wait_accept` | Reviewer | current Review Claim、レビューしたhead SHA、current Review Claimに紐づくPRレビューコメント、指定したCIチェックの成功（未指定なら確認なし）、GitHubでのマージを確認する |
| `wait_accept` → `accepted` | Manager | current Acceptance Claim、レビュー済みPRのmerge SHA、統合された版でのAC確認結果を記録する |

GitHub方式ではManagerが`in_review`から直接Acceptance Claimを取得することはできない。Web UIのHuman受入もPRのマージ確認とAC根拠を必要とする。

GitHub APIの読み取りはSQLiteのトランザクション外で行い、更新時にClaim・Task・Project設定・PR履歴を再確認する。GitHubへ接続できない場合は状態を進めず、`GITHUB_UNAVAILABLE`を返す。

## MCP契約

- `list_projects`: Projectに`workflow: { repository, baseBranch, requiredChecks } | null`を返す。
- `register_task_pull_request({ taskId, claimId, number, requestId })`: WorkerがPR番号を登録する。URL・branch・SHA・CI・承認はServerがGitHubから取得する。別Taskに登録されたPRは使用できない。
- `list_task_pull_requests({ taskId })`: PR履歴、最終確認時のGitHub状態、reviewed head SHA、accepted merge SHA、AC確認結果を返す。
- `complete_task`: GitHub方式ではcurrent Work ClaimにPR登録が必要。
- `reviewed_task`: GitHub方式では`expectedHeadSha`と`reviewCommentId`を必須とし、current Review Claim・Task・head SHAに紐づくPRコメント、CI、マージを確認する。
- `accept_task`: GitHub方式では`verification: { mergeSha, evidence }`を必須とする。
- `reject_task`: Reviewerは修正条件、Managerは不足ACと再受入条件をreasonへ記録する。

書き込み操作は`requestId`で冪等に実行する。成功応答を失った場合は同じ入力・同じrequestIdで再送する。成功済み操作の再送はGitHubの可用性に依存しない。

## レビューコメント

Reviewerの判定はGitHubの通常のPRコメント（Issue comment API）へ記録する。コメントには検証結果と `<!-- task-review: {"taskId":"...","claimId":"...","headSha":"...","decision":"approve"} -->` を含める。ServerはGitHubからコメントを取得し、コメントID・Task・current Review Claim・現在のhead SHAを照合する。単なる「LGTM」や古いコメントだけで状態を進めない。コメント本文はDBへ複製せず、参照と検証に必要な情報を保持する。

GitHubアカウントが同じでも、レビューの業務主体はWachaのReviewer Principalとcurrent Review Claimで区別する。指定したCIチェックとbranch保護はGitHubで強制し、レビュー判断の対応はWachaとRalphで強制する。

## 差し戻しと復旧

Reviewer差し戻しでは、Workerは新しいWork Claimを取得し、同じopen PRを修正・再登録する。headが更新されたら、旧headや旧Review Claimに対するコメントを流用しない。

Manager差し戻しでは、マージ済みPRを再使用せず、最新の統合先branchから新規PRを作る。Taskに複数のPRを保持し、前回のレビュー・merge SHAは消さない。重大な回帰は必要に応じてrevert PRで対応する。

PRのマージ後にWacha更新が失敗した場合は、マージ結果を確認して`reviewed_task`を再送する。Task状態のためにGitHub上で再マージすることはない。期限切れClaimは新しいClaimを取得して再検証する。

Web UIのPR履歴は最終確認時のsnapshotであり、GitHubの現在状態はPRリンク先で確認する。ACの妥当性はManagerが判断し、Serverは対象commit・Claim・必須根拠の整合を強制する。
