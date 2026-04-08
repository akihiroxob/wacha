# Role Policy

## 目的

この文書は、WACHA の MCP における role ごとの責務、許可操作、禁止操作、Push 対象イベントを定義する。

対象 role は次の 3 つとする。

- `manager`
- `reviewer`
- `worker`

`viewer` は現時点では運用対象外とし、将来必要になった場合に別途定義する。

## 基本方針

- role は「誰がどのフェーズを担当するか」を固定するために使う
- 当面は最小ブロック方針を採用する
- 最小ブロック方針では、`manager` 専用であるべき操作だけを MCP レベルで拒否する
- それ以外の操作は、しばらく運用ルールで制御する
- 最終判断は `manager` に集約する
- `reviewer` は実装の妥当性を確認するが、要件期待の最終判断はしない
- `worker` は担当した Task の実行に集中する

## 作業フェーズと role

1. 依頼受付と要件整理
   - 担当: `manager`
2. Story 化と Task 分解
   - 担当: `manager`
3. Task 実行
   - 担当: `worker`
4. 実装レビュー
   - 担当: `reviewer`
5. 要件に照らした最終受入
   - 担当: `manager`

## 最小ブロック対象

以下の tool は `manager` 以外からの呼び出しを拒否する。

- `issue_story`
- `claim_story`
- `complete_story`
- `cancel_story`
- `issue_task`
- `accept_task`

## 権限表

次の表は、当面の「MCP 実装ブロック」と「運用上の期待」を分けて示す。

| Tool | manager | reviewer | worker | MCP 実装ブロック | 備考 |
| --- | --- | --- | --- | --- |
| `list_projects` | allow | allow | allow | no | 参照系 |
| `list_stories` | allow | allow | allow | no | 参照系 |
| `issue_story` | allow | deny | deny | yes | Story 作成は manager のみ |
| `claim_story` | allow | deny | deny | yes | Story を処理対象にするのは manager のみ |
| `complete_story` | allow | deny | deny | yes | Story 完了は manager のみ |
| `cancel_story` | allow | deny | deny | yes | Story 中止は manager のみ |
| `list_tasks` | allow | allow | allow | no | 参照系 |
| `issue_task` | allow | deny | deny | yes | Task 分解は manager のみ |
| `claim_task` | deny | deny | allow | no | 当面は運用で制御 |
| `complete_task` | deny | deny | allow | no | 当面は運用で制御 |
| `accept_task` | allow | deny | deny | yes | 最終受入は manager のみ |
| `reject_task` | allow | allow | deny | no | 当面は運用で制御 |
| `assign_project_role` | allow | allow | allow | no | role 指定時の制約は別レイヤで扱う |

## Reject の意味の違い

`reject_task` は `manager` と `reviewer` の両方に許可するが、意味は同じではない。

### reviewer の reject

- 実装や検証の観点で不備がある
- 追加修正が必要
- レビュー結果として差し戻す

### manager の reject

- 要件期待に届いていない
- 人に確認した内容とズレている
- 受入条件を満たしていない

実装上は同じ `reject_task` を使ってよいが、reason にはどの観点の reject かが分かる文面を残す。

## role 別の必須ルール

### manager

- 人からの依頼受付を担う
- Story 化と Task 分解を担う
- Story の状態を管理する
- 最終的な `accept_task` / `reject_task` を担う

### reviewer

- `worker` 完了後の Task を確認する
- 実装の妥当性、漏れ、危険性を確認する
- 通せない場合は `reject_task` で差し戻す
- `accept_task` は行わない

### worker

- `todo` または `rejected` の Task を引き受ける
- 実装や修正を行う
- 完了したら `complete_task` でレビュー待ちに進める
- Story や role の管理は行わない

## Push 対象イベント

role ごとに Push すべきイベントは次のとおり。

### manager への Push

- 新しい `todo` Story が発行された
- `doing` の Story が長時間止まっている
- `in_review` の Task が reviewer を経て manager 判断待ちになった
- 人から manager 宛ての直接依頼が発生した

### reviewer への Push

- `complete_task` により Task がレビュー待ちになった
- `rejected` から再着手され、再レビューが必要になった

### worker への Push

- 自分が担当すべき Task が明示的に割り当てられた
- 自分の Task が `reject_task` で差し戻された

## MCP レベルの拒否仕様

role に許可されていない tool を呼んだ場合、MCP はエラーを返す。

当面この拒否を適用するのは、`manager` 専用の最小ブロック対象 tool のみとする。

期待する振る舞いは次のとおり。

- エラー種別は認可エラーとして扱う
- メッセージには role と tool 名を含める
- 処理本体には入らない

エラーメッセージ例:

`Role reviewer is not allowed to call accept_task`

## 実装順

1. `manager` 専用 tool 一覧をコードに持つ
2. 各 MCP tool 実行前に role を検証する
3. 最小ブロック対象 tool のみ拒否を有効にする
4. Push の対象イベントを発火できるようにする
5. 将来的に full role block へ拡張する
