# AGENTS

## Task MCP

このリポジトリでは、Streamable HTTP でタスク管理用 MCP サーバを提供しています。

このリポジトリで作業する Agent は、現在の作業状況の確認と、必要に応じたタスク状態の更新のためにこの仕組みを利用してください。

## 起動方法

- MCP サーバを起動する: `npm run mcp:http`
- デフォルトの接続先: `http://localhost:3100/mcp`
- ヘルスチェック: `http://localhost:3100/health`

`MCP_PORT` を指定すると待ち受けポートを変更できます。

## 使うタイミング

- ある程度まとまった作業を始める前に、`task.list` を呼んで現在のタスク状況を確認する
- 新しく管理対象にしたい作業がある場合は、`task_issue` を呼ぶ
- 自分が担当するタスクを引き受ける場合は、`task_claim` を呼ぶ
- 実装が完了しレビュー可能な状態になったら、`task_complete` を呼ぶ
- レビュー担当として確認した場合は、`task_accept` または `task_reject` を呼ぶ

## 利用可能な MCP Tools

- `task_list`
  - 用途: タスク一覧とステータス集計を取得する
  - Arguments: なし
- `task_issue`
  - 用途: 新しいタスクを作成する
  - Arguments: `{ "title": string, "description"?: string, "projectId": string, "storyId"?: string }`
- `task_claim`
  - 用途: `todo` のタスクを担当者に割り当て、`doing` に進める
  - Arguments: `{ "taskId": string, "workerId": string }`
- `task_complete`
  - 用途: `doing` のタスクを `in_review` に進める
  - Arguments: `{ "taskId": string }`
- `task_accept`
  - 用途: `in_review` のタスクを `accepted` に進める
  - Arguments: `{ "taskId": string }`
- `task_reject`
  - 用途: `in_review` のタスクを `rejected` に進める
  - Arguments: `{ "taskId": string }`

## レスポンス

- `task_list` は `summary.total`, `summary.byStatus`, `summary.lastUpdatedAt`, `tasks` を返す
- それ以外の tools は、更新後の状態が分かる実行結果を返す

## 運用ガイド

- 重複タスクを作らないため、まず `task_list` を確認する
- タスク名は短く、何をするか分かる表現にする
- `task_complete` は本当にレビュー可能な状態になってから呼ぶ
- 追加対応が必要な場合は、状態を曖昧にせず `task_reject` を使う
