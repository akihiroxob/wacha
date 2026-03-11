# AGENTS

## Task MCP

このリポジトリでは、`POST /mcp` でタスク管理用の MCP 風エンドポイントを提供しています。

このリポジトリで作業する Agent は、現在の作業状況の確認と、必要に応じたタスク状態の更新のためにこの仕組みを利用してください。

## 使うタイミング

- ある程度まとまった作業を始める前に、`task.list` を呼んで現在のタスク状況を確認する
- 新しく管理対象にしたい作業がある場合は、`task.issue` を呼ぶ
- 自分が担当するタスクを引き受ける場合は、`task.claim` を呼ぶ
- 実装が完了しレビュー可能な状態になったら、`task.complete` を呼ぶ
- レビュー担当として確認した場合は、`task.accept` または `task.reject` を呼ぶ

## 利用可能なメソッド

- `task.list`
  - 用途: タスク一覧とステータス集計を取得する
  - Params: `{}`
- `task.issue`
  - 用途: 新しいタスクを作成する
  - Params: `{ "title": string, "description"?: string }`
- `task.claim`
  - 用途: `todo` のタスクを担当者に割り当て、`doing` に進める
  - Params: `{ "taskId": string, "workerId": string }`
- `task.complete`
  - 用途: `doing` のタスクを `in_review` に進める
  - Params: `{ "taskId": string }`
- `task.accept`
  - 用途: `in_review` のタスクを `accepted` に進める
  - Params: `{ "taskId": string }`
- `task.reject`
  - 用途: `in_review` のタスクを `rejected` に進める
  - Params: `{ "taskId": string }`

## レスポンス

- `task.list` は `result` の中に以下を返す
  - `summary.total`
  - `summary.byStatus`
  - `summary.lastUpdatedAt`
  - `tasks`
- それ以外のメソッドは、実行結果を表す `result` を返す

## Role Header

リクエストには `x-role` が必要です。

- `manager`: `task.list`, `task.issue` を利用可能
- `worker`: `task.list`, `task.claim`, `task.complete` を利用可能
- `reviewer`: `task.list`, `task.accept`, `task.reject` を利用可能
- `viewer`: `task.list` を利用可能

## リクエスト例

タスク一覧を取得する:

```json
{
  "method": "task.list",
  "params": {}
}
```

タスクを作成する:

```json
{
  "method": "task.issue",
  "params": {
    "title": "レビュー状態の可視化を追加する",
    "description": "MCP クライアント向けにタスク集計を返す"
  }
}
```

タスクを引き受ける:

```json
{
  "method": "task.claim",
  "params": {
    "taskId": "task-123",
    "workerId": "worker-a"
  }
}
```

## 運用ガイド

- 重複タスクを作らないため、まず `task.list` を確認する
- タスク名は短く、何をするか分かる表現にする
- `task.complete` は本当にレビュー可能な状態になってから呼ぶ
- 追加対応が必要な場合は、状態を曖昧にせず `task.reject` を使う
