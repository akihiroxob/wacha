# Wacha Retrospective

## Pros

- Task が小さく明確で、着手判断が速い。
- `todo / doing / in_review / rejected` が分かれていて、現在地が見えやすい。
- `rejectReason` が具体的で、修正方針へ落とし込みやすい。
- Story 単位で要件を持ちながら Task 単位で進められるので、実装順を保ちやすい。
- 「まず一歩進める」運用に向いていて、止まりにくい。

## Cons

- 関連する `rejected` が複数 Task にまたがると、実質 1 つの修正でもステータス更新が分散する。
- 仕様上は別 Task でも、実装上は同じ領域をまとめて直す必要があり、粒度が細かすぎる場面がある。
- reviewer の期待する完了条件が Task 文面だけでは足りず、実装後にズレが出やすい。
- `rejected` をいつ確認するか、どのタイミングでまとめて再レビューに出すかを運用で決めないと確認コストが積み上がる。
- `doing` 中の Task と、実際にコード変更で同時に解決した周辺 Task がズレやすい。

## Improvement Ideas

- auth や認可のような横断領域は、Task 文に受け入れ条件を明文化する。
  - 例: signup token 再検証、state 署名、DB 再照合、権限降格時の遮断
- 複数 `rejected` をまたぐ修正では、「主タスク 1 件を doing にして、関連 rejected はまとめて扱う」運用ルールを入れる。
- Story 開始時に、その Story 用の Definition of Done を 3-5 行で別途持つ。
- `in_review` に上げる前の自己確認テンプレートを持つ。
  - 例: 権限再確認あり、永続化確認あり、回帰確認あり、build 通過
- `rejectReason` の書式を揃える。
  - 推奨: 「問題」「影響」「再レビュー条件」の 3 点セット

## Skill Candidates

### `wacha-worker`

- `list_tasks` から次タスクを選ぶ
- Task を `doing` にする
- 完了時だけ `rejected` を確認する
- 関連 `rejected` をまとめて扱う

### `wacha-rejected-fix`

- `rejected` を読み、共通原因を束ねる
- 1 回の修正で何件解消できるかを整理する
- 修正後にどの Task を `complete_task` するか判断する

### `wacha-story-driver`

- Story 内の Task 順序を見て前提を崩さず進める
- `schema -> repository -> route/action -> UI -> verification` の流れを意識させる

### `wacha-review-gate`

- `in_review` 前チェックをテンプレート化する
- build/test、権限確認、既知 `rejected` 観点の再点検を行う

### `auth-task-checklist`

- 認証・認可 Task の専用チェックリスト
- state 改ざん、CSRF、セッション復元、権限降格時挙動、再ログイン時の同一性、未認証時遮断を確認する

## Recommended First Skills

- 最優先は `wacha-rejected-fix`
- 次点は `wacha-review-gate`

この 2 つを Skill 化すると、今回のようなレビュー往復のコストをかなり下げやすい。

## 2026-07-06 ロール運用の検証ログ

サンドボックスプロジェクト（`wacha-sandbox`）を作って、manager/worker/reviewer の役割分離が実際に効くかを一通り触って確認した。

### 分かったこと

- `assign_project_role` は同一セッションに複数ロールを重ねて付与できる。実際に同一セッションへ manager + worker + reviewer を同時付与できた。
- その状態で `issue_story` → `issue_task` → `claim_task` → `complete_task` → `reviewed_task` → `accept_task` まで、他セッションの介入なしに一人で完走できた。
- `claim_task` / `complete_task` は `role-policy.md` 上「manager 禁止」だが、MCP 実装ブロックの対象外（"当面は運用で制御"）のため、manager セッションのままでも通ってしまう。
- 一方 `reviewed_task` / `accept_task` / `add_task_comment` は RoleGuard で正しく弾かれる（管理外ロールから呼ぶと `Forbidden: Agent does not have required role`）。
- `complete_story` は配下の Task が `doing`（未 accept）のままでもエラーなく `done` に遷移した。Story 完了と Task 完了の整合チェックはない。
- `reject_task` → 再 `claim_task` の遷移では `rejectReason` と `resumeSourceStatus: "rejected"` が保持される。差し戻し理由を見ながら再着手できるのは良い設計。

### 懸念

- レビューゲート（reviewer による技術検証、manager による最終受入）が製品の核となる価値のはずだが、上記の通り「1 セッションが複数ロールを持てる」+「claim/complete が未ガード」の組み合わせで、実質的に自作自演が可能になっている。単なる規約（role-policy.md の「禁止される操作」）に依存しており、MCP レベルでは守られていない。
- Story の完了判定が子 Task の状態を見ていないため、「Story は done だが Task は doing のまま」という不整合状態を作れる。

### 改善案

- `assign_project_role` を「1 セッション・1 プロジェクトにつき 1 ロールまで」に制限するか、少なくとも複数ロール保持時は警告を返す。
- `claim_task` / `complete_task` も RoleGuard で worker 限定にする（"運用で制御" をやめて実装ブロックに昇格させる）。
- `complete_story` 実行時に、配下 Task が全て `accepted`（または `canceled`）であることを検証する。

## 2026-07-07 セッション喪失による専有ロールの恒久占有

### 分かったこと

- manager / reviewer は 1 プロジェクト 1 席の専有ロール（`RoleAssignmentService` の `SINGLE_ASSIGNMENT_ROLES`）。
- セッションはインメモリで、サーバー再起動や失効で消える。一方 `project_membership` は SQLite に永続する。
- このため再起動後、死んだセッションの membership が manager 席を占有し続け、新しいセッションからの `assign_project_role`（requestedRole: manager）は「not available」で恒久的に拒否される。実際に発生し、MCP 経由の復旧手段がないため DB の membership 行を直接削除して解消した。
- `lastHeartbeatAt` は membership 作成時に設定されるが、以後更新されていない（生死判定に使えない状態）。
- 補足: `assign_project_role` はプロジェクトを projectName ではなく baseDir で同定する。既存 baseDir に別名を渡すと、渡した projectName と description は無視されて既存プロジェクトに紐づく。エージェントが意図せず別プロジェクトに参加したと誤認しうる。

### 対応

- 検証ログの改善案（ロール分離の実装ブロック化・complete_story 整合チェック）と合わせて、Story「レビューゲートを実装レベルで保証する」（task 5 件）と Story「セッション喪失後に専有ロールを復旧可能にする」（task 2 件: heartbeat 更新、死に席の明け渡し）として登録済み。
- 戦略面の背景は `docs/model-strategy.md` を参照。
