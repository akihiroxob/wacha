# AGENTS

## Task MCP

このリポジトリは、Streamable HTTP でタスク調整用 MCP サーバーを提供する。

既定の `/mcp` はステートレスである。MCP のセッション ID を Agent の識別、Role、Task 所有権には使わない。各リクエストは Principal、永続化された Project Role Grant、期限付き Task Claim によって認可される。

役割別の運用ルールは `agent/` 配下に置く。

- `agent/role-policy.md`: Role、権限、Claim の共通方針
- `agent/manager.md`: manager の責務と運用フロー
- `agent/reviewer.md`: reviewer の責務と確認観点
- `agent/worker.md`: worker の責務と作業フロー

正本仕様は `docs/agent-task-coordination-spec.md`、移行手順は `docs/agent-task-coordination-migration.md` を参照する。

## 起動と接続

- ローカル: `npm install && npm run start`
- Docker Compose: `docker compose up --build`
- ステートレス MCP: `http://localhost:51743/mcp`
- ヘルスチェック: `http://localhost:51743/health`
- SQLite の既定パス: `wacha.db`
- Docker Compose の SQLite: `/data/wacha.db`

環境変数:

- `PORT`: 待ち受けポート
- `WACHA_DB_PATH`: SQLite ファイル
- `WACHA_CLAIM_TTL_MS`: Claim の有効期間。既定は 1,800,000 ms（30 分）

## Principal と Role Grant

初期実装は trusted-local モードで、Bearer 値を検証せずそのまま Agent 名（Principal ID）として使う。

```http
Authorization: Bearer <AgentName>
```

これはセキュリティ境界ではないため、信頼できないネットワークへ公開しない。

Role は Principal と Project の組み合わせで永続化される。同じ Principal は同一 Project で `worker`、`reviewer`、`manager` を複数保持できる。Role の選択やセッションごとの再取得は不要である。

Role Grant は運用者がProject詳細のWeb UIから発行・取消する。CLIから発行する場合は
次のコマンドを使う。

```sh
npm run grant-role -- <projectId> <AgentName> <worker|reviewer|manager>
```

## 基本フロー

Agent が Task を選び、Wacha が Claim と状態遷移の正当性を検証する。Wacha が先頭 Task を自動割り当てすることはない。

### Worker

1. `list_tasks` を `availableFor: "work"` で読む
2. Task を選び `claim_task` を呼ぶ
3. 返された `claimId` を保持し、長時間作業では期限前に `renew_claim` する
4. `add_task_comment` で実施内容と検証結果を残す
5. `complete_task` で `in_review` へ進める
6. 続行しない場合は `release_claim` する

### Reviewer

1. `list_tasks` を `availableFor: "review"` で読む
2. Task を選び `claim_review` を呼ぶ
3. 問題がなければ `reviewed_task`、問題があれば `reject_task` を呼ぶ

### Manager

1. `list_tasks` を `availableFor: "acceptance"` で読む
2. Task を選び `claim_acceptance` を呼ぶ
3. `accept_task` または `reject_task` を呼ぶ

`claim_acceptance` の対象が `in_review` の場合は、Manager が Reviewer 工程を代行したものとして、Claim 取得と同じトランザクションで `wait_accept` へ進む。Change Log には `manager_direct_review` 経路が残る。

## Claim と requestId

- 1 Task に有効な Claim は最大 1 件
- Claim は期限付きで、Agent 全体ではなく Task の操作権だけを表す
- `renew_claim` は Claim の延長であり Agent heartbeat ではない
- 期限切れの `doing` Task は DB 上の状態を維持したまま `availableFor: "work"` に現れる
- 再 Claim は古い Claim を失効させ、新しい `claimId` を発行する
- 古い、期限切れ、他 Principal 所有の `claimId` では更新できない
- `release_claim` で work Claim を解放すると Task は `todo` に戻る
- `availableFor` は Task 状態と有効 Claim だけで Phase 候補を返し、呼出 Principal の個別 Role には依存しない
- Role、自己レビュー・自己受入、排他性の最終判定は `claim_*` が行う

状態変更 Tool は `renew_claim` を除き `requestId` を必須とする。同じ Principal・Tool・`requestId`・入力の再送は同じ結果を返す。異なる入力で再利用すると `IDEMPOTENCY_CONFLICT` になる。

## ステートレス MCP Tools

### 参照

- `list_projects({})`
- `list_stories({ projectId, status? })`
- `list_tasks({ projectId, filter?, limit? })`
  - `filter.status?: TaskStatus[]`
  - `filter.availableFor?: "work" | "review" | "acceptance"`
  - `filter.storyId?: string`
  - `status` と `availableFor` は併用不可
- `list_task_comments({ taskId })`
- `list_changes({ projectId, afterCursor?, limit? })`
- `list_skills({ status?, role? })`
- `get_skill_context({ name })`
- `get_role_instructions({ role, includeShared? })`

### Manager 管理操作

- `issue_story({ projectId, title, description?, requestId })`
- `edit_story({ projectId, storyId, title, description?, sortOrder?, requestId })`
- `complete_story({ storyId, requestId })`
- `cancel_story({ storyId, reason, requestId })`
- `issue_task({ projectId, storyId?, title, description?, requestId })`
- `edit_task({ projectId, taskId, title, description?, sortOrder?, requestId })`
- `cancel_task({ taskId, reason, requestId })`

### Claim

- `claim_task({ taskId, requestId })`
- `claim_review({ taskId, requestId })`
- `claim_acceptance({ taskId, requestId })`
- `renew_claim({ claimId })`
- `release_claim({ claimId, reason, requestId })`

### Claim による状態更新

- `add_task_comment({ taskId, claimId, body, requestId })`
- `complete_task({ taskId, claimId, requestId })`
- `reviewed_task({ taskId, claimId, requestId })`
- `accept_task({ taskId, claimId, requestId })`
- `reject_task({ taskId, claimId, reason, requestId })`

## 状態と運用ルール

- Task の主経路は `todo -> doing -> in_review -> wait_accept -> accepted`
- `in_review` / `wait_accept` からの差し戻しは `rejected`
- Task の完了状態は `accepted` / `canceled`
- Story は配下 Task の最初の Claim で `doing` になる
- Story は配下 Task がすべて `accepted` / `canceled` のときだけ完了できる
- 自己レビューと自己受入は、Role ではなく最新の完了 Principal ID を比較して禁止する
- `complete_task` の前に、同じ Principal・同じ Claim のコメントが少なくとも 1 件必要
- Task-to-Task 依存関係は初期実装に含めない
- 一覧の既定順は親 Story の `sortOrder`、Task の `sortOrder`、`createdAt` の順。ただし順序は選択の参考であり先頭 Claim を強制しない
- 新規 Story / Task の作成と優先順位変更は manager が行う
- cancel は理由付きの非破壊状態遷移とし、hard delete は使わない

## Change Log

重要な状態変更は同じトランザクションで append-only の Change Log に記録する。`list_changes` の `nextCursor` を次回の `afterCursor` に渡すことで、Console、Ralph Loop、外部オーケストレーターが独立して差分を取得できる。

Change Log は通知配送や Agent の会話コンテキストを管理しない。ポーリング間隔、再試行、ループ停止条件、対話継続は MCP の外側が担当する。

## 旧方式からの移行

旧 session MCP endpoint と runtime Role 割当 Tool は提供しない。既存 DB の初回起動では `project_membership` を削除し、Claim を持たない旧 `doing` Task を `todo` へ戻す。詳細は `docs/agent-task-coordination-migration.md` を参照する。
