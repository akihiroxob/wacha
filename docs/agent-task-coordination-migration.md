# Agent Task Coordination Migration

## 方針

旧 session membership / task assignee 方式から、Principal / Project Grant / Task Claim 方式へ破壊的に切り替える。互換 endpoint は設けない。

正本仕様は `docs/agent-task-coordination-spec.md`。比較資料 `docs/minimal-stateless-task-coordination-design.md` は変更しない。

## 初回起動で行うこと

サーバーは新しい永続テーブルと列を作成した後、`project_membership` が存在する場合に一度だけ次を同一トランザクションで行う。

1. Claim を持たない旧 `doing` Task を `todo` に戻す
2. 対象 Task ごとに `TASK_MIGRATED` を Change Log へ記録する
3. 旧 `task.assignee` を全件クリアする
4. `project_membership` を削除する

`project_membership` の存在を migration marker にするため、以後の起動で新しい `doing` Taskが `todo` へ戻ることはない。

旧 `in_review` / `wait_accept` は維持する。旧 worker の Principal を session ID から正しく推定できないため、最初の引継ぎだけは人が成果とコメントを確認する。その後に新方式で `complete_task` された Task では Principal ID による自己レビュー・自己受入禁止が働く。

## 切替前

SQLite をバックアップする。

```sh
cp wacha.db wacha.db.before-stateless
```

開発中の未配布環境を対象とするため、旧 endpoint、session registry、in-memory event、専有 Role 席は削除する。ロールバックする場合はサーバーを停止し、DB とコードをまとめて切替前へ戻す。

## Role Grant

初回起動後、利用する Agent 名ごとに必要な Role を手動登録する。同じ Principal に複数 Role を付与してよい。

```sh
npm run grant-role -- <projectId> <AgentName> worker
npm run grant-role -- <projectId> <AgentName> reviewer
npm run grant-role -- <projectId> <AgentName> manager
```

クライアントは同じ Agent 名を毎リクエストに送る。

```http
Authorization: Bearer <AgentName>
```

## 旧 review 待ちの引継ぎ

- `in_review`: manager が `claim_acceptance` すると `wait_accept` へ進み、`manager_direct_review` が記録される
- `wait_accept`: manager が `claim_acceptance` してから `accept_task` または `reject_task` を呼ぶ
- reviewer に再確認させる `in_review`: reviewer が `claim_review` してから `reviewed_task` または `reject_task` を呼ぶ

厳密に work 工程からやり直したい旧 Task は、運用者が対象 ID を確認して `todo` へ戻す。サーバーは `in_review` / `wait_accept` を自動で巻き戻さない。

## 切替チェックリスト

- SQLite のバックアップがある
- 初回起動後に `project_membership` がなくなっている
- 旧 `doing` が `todo` になり `TASK_MIGRATED` が記録されている
- 利用する Agent 名と Role Grant を登録した
- MCP クライアントが `/mcp` と Authorization header を使う
- Ralph / Console が `requestId` と `claimId` を保持する
- Claim TTL より長い Task で `renew_claim` を呼ぶ
- Change Log の `afterCursor` を利用側が管理する
