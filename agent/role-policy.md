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
- session の再確立と role の再取得は別の問題として扱う
- server 再起動後に session が失われても role は自動継承しない
- role が必要な操作で弾かれた時点で、client または agent は `assign_project_role` を再実行する
- 当面は最小ブロック方針を採用する
- 最小ブロック方針では、主に `manager` 専用操作を MCP レベルで拒否する
- 一部の reviewer / worker 専用操作も、実装で明示ブロックする
- それ以外の操作は、しばらく運用ルールで制御する
- 最終判断は `manager` に集約する
- `reviewer` は実装の妥当性を確認するが、要件期待の最終判断はしない
- `reviewer` はレビューを成立させるための付随作業を限定的に行ってよい
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
- `edit_story`
- `claim_story`
- `complete_story`
- `cancel_story`
- `storyId` を伴う `issue_task`
- `accept_task`

## 権限表

次の表は、当面の「MCP 実装ブロック」と「運用上の期待」を分けて示す。

| Tool                  | manager | reviewer | worker | MCP 実装ブロック | 備考                                    |
| --------------------- | ------- | -------- | ------ | ---------------- | --------------------------------------- |
| `list_projects`       | allow   | allow    | allow  | no               | 参照系                                  |
| `list_project_agents` | allow   | allow    | allow  | no               | 参照系                                  |
| `list_stories`        | allow   | allow    | allow  | no               | 参照系                                  |
| `issue_story`         | allow   | deny     | deny   | yes              | Story 作成は manager のみ               |
| `edit_story`          | allow   | deny     | deny   | yes              | Story 編集は manager のみ               |
| `claim_story`         | allow   | deny     | deny   | yes              | Story を処理対象にするのは manager のみ |
| `complete_story`      | allow   | deny     | deny   | yes              | Story 完了は manager のみ               |
| `cancel_story`        | allow   | deny     | deny   | yes              | Story 中止は manager のみ               |
| `list_tasks`          | allow   | allow    | allow  | no               | 参照系                                  |
| `issue_task`          | allow   | allow    | deny   | partial          | reviewer は Story 非紐付け Task のみ可  |
| `claim_task`          | deny    | deny     | allow  | no               | 当面は運用で制御                        |
| `complete_task`       | deny    | deny     | allow  | no               | 当面は運用で制御                        |
| `reviewed_task`       | deny    | allow    | deny   | yes              | reviewer 承認で `wait_accept` に進める  |
| `accept_task`         | allow   | deny     | deny   | yes              | 最終受入は manager のみ                 |
| `reject_task`         | allow   | allow    | deny   | no               | reviewer は実装観点の差し戻しに使う     |
| `add_task_comment`    | deny    | allow    | allow  | yes              | reviewer / worker の補足コメント        |
| `list_task_comments`  | allow   | allow    | allow  | no               | 参照系                                  |
| `assign_project_role` | allow   | allow    | allow  | no               | role 指定時の制約は別レイヤで扱う       |
| `get_role_instructions` | allow | allow    | allow  | no               | 参照系                                  |

## Reject の意味の違い

`reject_task` は `manager` と `reviewer` の両方に許可するが、意味は同じではない。

### reviewer の reject

- 実装や検証の観点で不備がある
- 追加修正が必要
- レビュー結果として差し戻す
- reviewer 自身で直すと責務が実質的に実装へ広がる場合は差し戻す

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
- レビューを成立させるための軽微修正、テスト追加、補足コメント追記は条件付きで行える
- Story に紐づかない follow-up Task は `issue_task` で発行できる
- `reviewed_task` で manager 判断待ちへ進める
- `add_task_comment` で補足コメントを残せる
- Story 配下にぶら下げる Task 分解や大きい修正は manager に委ねる
- 通せない場合は `reject_task` で差し戻す
- `accept_task` は行わない

### worker

- `todo` または `rejected` の Task を引き受ける
- 実装や修正を行う
- 完了したら `complete_task` でレビュー待ちに進める
- `add_task_comment` で実装メモや補足を残せる
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

## Session 再初期化後の扱い

server 再起動などで既存 session が失われた場合、client はまず `initialize` をやり直して新しい session を確立する。

この時、以前の project membership や role を自動で引き継ぐ前提は置かない。

role が必要な tool を呼ぶ時点で role 未取得により処理できないことが分かったら、必要に応じて `assign_project_role` を再実行する。

この文書は WACHA の role 運用ルールを示すためのものであり、session 再初期化エラー自体に WACHA 固有の role 復旧手順を埋め込む前提は取らない。

## MCP レベルの拒否仕様

role に許可されていない tool を呼んだ場合、MCP はエラーを返す。

当面この拒否は、`manager` 専用の最小ブロック対象に加えて、`reviewed_task` と `add_task_comment` のような一部の role 専用操作にも適用する。

期待する振る舞いは次のとおり。

- エラー種別は認可エラーとして扱う
- メッセージは実装依存であり、現状は generic な認可エラー文言を返す
- 処理本体には入らない

現状のエラーメッセージ例:

`Forbidden: Agent does not have required role`

## reviewer の付随作業

`reviewer` は判定だけを機械的に行う役ではない。レビューの主目的を崩さない範囲で、次の付随作業を行ってよい。

- typo 修正、文言修正、変数名修正のような軽微修正
- 既存意図を明確にする補足コメントの追記
- 不足しているが自明なテストケースの追加
- Story に紐づかない follow-up を次 Task として発行すること
- `add_task_comment` を使って補足メモやレビュー観点を残すこと

ただし、次に当てはまる場合は reviewer 自身で抱えず `reject_task` または manager への提案に切り替える。

- 振る舞い変更や設計判断を伴う
- 変更箇所が複数責務にまたがる
- 何を正とするかが要件判断に依存する
- Story に紐づけて Task 分解したくなる
- 新しい Task を自分で複数発行したくなる程度に作業が膨らむ

## reviewer の判断例

- 軽微修正で閉じる例
  - テスト名の誤字修正
  - 失敗理由を読みやすくする補足コメント追加
  - 既存仕様をなぞるだけの不足テスト 1 件追加
- worker へ返す例
  - 分岐追加やロジック変更が必要
  - 仕様解釈によって実装が変わる
  - 不足テストを足すには実装の組み替えが必要
- manager へ返す例
  - 追加で扱うべきユースケースを見つけた
  - Story 配下で整理すべき改善案がある
  - 要件の優先順位づけが必要

## 実装順

1. `manager` 専用 tool 一覧をコードに持つ
2. 各 MCP tool 実行前に role を検証する
3. 最小ブロック対象 tool のみ拒否を有効にする
4. Push の対象イベントを発火できるようにする
5. 将来的に full role block へ拡張する
