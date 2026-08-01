# Role Policy

## 目的

この文書は、ステートレス `/mcp` における Project Role と Task Claim の共通運用を定義する。詳細仕様は `docs/agent-task-coordination-spec.md` を正とする。

対象 Role は `manager`、`reviewer`、`worker` である。

## 基本方針

- Principal は `Authorization: Bearer <AgentName>` から得る。Tool 入力で Principal を指定しない
- Role Grant は Principal と Project に永続化し、MCP session から独立させる
- 1 Principal は同一 Project で複数 Role を保持できる
- Role は選択・切替する状態ではない。各操作が必要な Role を検証する
- Agent が一覧から Task を選び、Wacha は Claim の競合と状態遷移を検証する
- Task の排他所有権は期限付き Claim で表し、Role Grant や Agent の生存期間とは分離する
- 最終判断は manager、実装レビューは reviewer、Task 実行は worker が担う
- 複数 worker、複数 reviewer を許可する。Role の専有席は設けない

## 作業フェーズ

1. 依頼受付、Story 化、Task 分解: `manager`
2. Task 実行: `worker`
3. 実装レビュー: `reviewer`
4. 要件に照らした最終受入: `manager`

レビュー費用を省く必要がある場合、manager は `in_review` の Task に `claim_acceptance` できる。この操作は `wait_accept` への遷移と `manager_direct_review` の Change Log 記録を同時に行う。

## 権限表

| 操作 | manager | reviewer | worker | 備考 |
| --- | --- | --- | --- | --- |
| Project / Story / Task / Comment / Change の参照 | allow | allow | allow | Project のいずれかの Grant が必要 |
| Story の作成・編集・完了・中止 | allow | deny | deny | `requestId` 必須 |
| Task の作成・編集・中止 | allow | deny | deny | `requestId` 必須 |
| `claim_task` / `complete_task` | deny | deny | allow | work Claim が必要 |
| `claim_review` / `reviewed_task` | deny | allow | deny | Review Claim が必要 |
| `claim_acceptance` / `accept_task` | allow | deny | deny | Acceptance Claim が必要 |
| `reject_task` (`in_review`) | deny | allow | deny | Review Claim が必要 |
| `reject_task` (`wait_accept`) | allow | deny | deny | Acceptance Claim が必要 |
| `add_task_comment` | allow | allow | allow | 現在の Claim と、その Claim に必要な Role が必要 |
| `renew_claim` / `release_claim` | allow | allow | allow | 自分が所有する現在の Claim に限る |

`add_task_comment` は Claim に紐づく引き継ぎ記録である。Principal と `claimId` はサーバーが保存し、任意の author 名で上書きしない。

## Claim の共通ルール

- 1 Task に有効な Claim は最大 1 件
- Claim 取得競合は通常の制御フローであり、`CLAIM_CONFLICT` を受けた Agent は再一覧または別 Task の選択を行う
- Claim は期限切れ時点で無効になる。期限切れを永続化する定期 heartbeat は不要
- 作業継続時だけ、所有者が期限前に `renew_claim` する
- 期限切れ Claim は更新できず、対象状態が許せば新しい Claim を取得する
- work Claim が期限切れた `doing` Task は `availableFor: "work"` で再取得可能になる
- 再取得は古い Claim の失効と新しい Claim の作成を同一トランザクションで行う
- 明示解放では `release_claim` に理由を残す
- `cancel_task` は有効な Claim を同一トランザクションで解放し、古い `claimId` を fence する

Claim の更新は Task 操作権のリース更新であり、Console や Agent の生存確認ではない。

## 自己レビュー・自己受入

- 最新の `complete_task` を行った Principal は、同じ Task の `claim_review` を取得できない
- 最新の `complete_task` を行った Principal は、同じ Task の `claim_acceptance` を取得できない
- Role を複数保持してもこの制約は回避できない
- `complete_task` は、同じ Principal と同じ Claim で追加された Task Comment が必要

## Reject の意味

`reject_task` は対象状態で意味が変わる。

### reviewer

- `in_review` を実装・検証観点で差し戻す
- reason に不足点、危険性、再レビュー条件を残す

### manager

- `wait_accept` を要件・受入観点で差し戻す
- reason に期待とのずれと再受入条件を残す

## Change Log と外部ループ

Task / Claim の重要な変更は append-only Change Log に保存する。利用側は `list_changes(projectId, afterCursor)` で差分を取得し、自身の cursor を管理する。

Wacha は次を管理しない。

- Ralph Loop や Console のプロセス生存
- polling / backoff / retry のスケジュール
- Agent の会話コンテキスト
- Agent に次の Task を強制するキュー
- 通知の購読状態や配信保証

これらは外部オーケストレーターの責務である。

## Reviewer の付随作業

reviewer はレビュー成立に必要な typo、文言、命名の微修正や、既存仕様を固定する小さなテスト追加を行ってよい。ただし現在の Review Claim の範囲を超える変更、設計判断、複数責務にまたがる修正は `reject_task` で worker に返す。

新しい Story / Task が必要な follow-up は manager へ提案する。初期のステートレス API では作成権限を manager に限定する。

## 旧方式

session membership、runtime Role 割当、専有 Role 席、session heartbeat、in-memory `wait_for_events` は廃止する。Role Grant と Change Log へ自動変換できない session 情報は引き継がない。
