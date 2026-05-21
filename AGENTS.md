# AGENTS

## Task MCP

このリポジトリでは、Streamable HTTP でタスク管理用 MCP サーバを提供しています。

このリポジトリで作業する Agent は、現在の作業状況の確認と、必要に応じたタスク状態の更新のためにこの仕組みを利用してください。

役割ごとの運用ルールは `agent/` 配下に配置します。

- `agent/role-policy.md`
  - role ごとの権限表と Push 対象イベント
- `agent/manager.md`
  - manager の責務と運用フロー
- `agent/reviewer.md`
  - reviewer の責務と確認観点
- `agent/worker.md`
  - worker の責務と作業フロー

## 起動方法

- ローカルで起動する: `npm install && npm run start`
- Docker Compose で起動する: `docker compose up --build`
- デフォルトの接続先: `http://localhost:3000/mcp`
- ヘルスチェック: `http://localhost:3000/health`
- 永続化する SQLite ファイルのデフォルトパス: `wacha.db`
- Docker Compose では SQLite ファイルは volume 経由で `/data/wacha.db` に保存される
- 識別子や membership は MCP の `sessionId` ベースで扱われる

`PORT` を指定すると待ち受けポートを変更できます。
`WACHA_DB_PATH` を指定すると SQLite の保存先を変更できます。

## 使うタイミング

- ある程度まとまった作業を始める前に、`list_tasks` を呼んで現在のタスク状況を確認する
- 新しく管理対象にしたい作業がある場合は、`issue_task` を呼ぶ
- 自分が担当するタスクを引き受ける場合は、`claim_task` を呼ぶ
- 実装が完了しレビュー可能な状態になったら、`complete_task` を呼ぶ
- レビュー担当として確認した場合は、`reviewed_task` または `reject_task` を呼ぶ
- 最終受入を行う場合は、`accept_task` または `reject_task` を呼ぶ

## 利用可能な MCP Tools

- `list_projects`
  - 用途: プロジェクト一覧を取得する
  - Arguments: `{}`
- `list_skills`
  - 用途: 利用可能な Skill 一覧を取得する
  - Arguments: `{ "status"?: "draft" | "active" | "deprecated", "role"?: "manager" | "reviewer" | "worker" | "viewer" }`
- `get_skill_context`
  - 用途: Skill 本体と関連 knowledge を取得する
  - Arguments: `{ "name": string }`
- `list_project_agents`
  - 用途: 指定したプロジェクトの agent 一覧を取得する
  - Arguments: `{ "projectId": string }`
- `list_stories`
  - 用途: 指定したプロジェクトの Story 一覧を取得する
  - Arguments: `{ "projectId": string, "status"?: "todo" | "doing" | "done" | "canceled" }`
- `issue_story`
  - 用途: 新しい Story を作成する
  - Arguments: `{ "projectId": string, "title": string, "description"?: string }`
- `edit_story`
  - 用途: 既存 Story の title / description を更新する
  - Arguments: `{ "projectId": string, "storyId": string, "title": string, "description"?: string }`
- `complete_story`
  - 用途: `doing` の Story を `done` に進める
  - Arguments: `{ "storyId": string }`
- `cancel_story`
  - 用途: `doing` の Story を `canceled` に進める
  - Arguments: `{ "storyId": string }`
- `list_tasks`
  - 用途: 指定したプロジェクトのタスク一覧とステータス集計を取得する
  - Arguments: `{ "projectId": string }`
- `issue_task`
  - 用途: 新しいタスクを作成する
  - Arguments: `{ "title": string, "description"?: string, "projectId": string, "storyId"?: string }`
- `edit_task`
  - 用途: 既存 Task の title / description を更新する
  - Arguments: `{ "projectId": string, "taskId": string, "title": string, "description"?: string }`
- `claim_task`
  - 用途: `todo` または `rejected` のタスクを現在の session に割り当て、`doing` に進める
  - Arguments: `{ "taskId": string }`
- `complete_task`
  - 用途: `doing` のタスクを `in_review` に進める
  - Arguments: `{ "taskId": string }`
- `reviewed_task`
  - 用途: `in_review` のタスクを `wait_accept` に進める
  - Arguments: `{ "taskId": string }`
- `accept_task`
  - 用途: `in_review` または `wait_accept` のタスクを `accepted` に進める
  - Arguments: `{ "taskId": string }`
- `reject_task`
  - 用途: `in_review` または `wait_accept` のタスクを `rejected` に進める
  - Arguments: `{ "taskId": string, "reason": string }`
- `add_task_comment`
  - 用途: task に worker / reviewer の補足コメントを追加する
  - 備考: 本文は Markdown 前提で書く
  - Arguments: `{ "taskId": string, "body": string, "author"?: string }`
- `list_task_comments`
  - 用途: 指定した task のコメント一覧を取得する
  - Arguments: `{ "taskId": string }`
- `assign_project_role`
  - 用途: プロジェクトに対するメンバーの役割を割り当てる
  - Arguments: `{ "baseDir": string, "projectName": string, "description"?: string, "requestedRole"?: "manager" | "reviewer" | "worker" }`
- `get_role_instructions`
  - 用途: role ごとの運用ルールを取得する
  - Arguments: `{ "role": "manager" | "reviewer" | "worker", "includeShared"?: boolean }`

## レスポンス

- `list_tasks` は `summary.total`, `summary.byStatus`, `summary.lastUpdatedAt`, `tasks` を返す
- `list_project_agents` は `projectId`, `summary`, `agents` を返す
- `list_projects` は `projects` を返す
- `list_skills` は `skills` を返す
- `get_skill_context` は `skill`, `knowledge` を返す
- `list_stories` は `stories` を返す
- `issue_story` は作成された Story の主要フィールドに加えて `requiredNextTool: "issue_task"` を返す
- `issue_story` は今回 `requiredNextArgs` を返さない
- `edit_story` と `edit_task` は更新後の entity を返す
- それ以外の tools は、更新後の状態が分かる実行結果を返す

## 運用ガイド

- 重複タスクを作らないため、まず `list_tasks` を確認する
- タスク名は短く、何をするか分かる表現にする
- 既存の Story / Task に紐づかない直接依頼や follow-up は、`issue_task` で単発 Task を作成してから進める
- `complete_task` は本当にレビュー可能な状態になってから呼ぶ
- 追加対応が必要な場合は、状態を曖昧にせず `reject_task` を使う
- Story が `doing` になるのは、Story 配下の Task が `claim_task` で着手されたとき
- コメント本文は Markdown 前提で扱うが、厳密な Markdown 構文検証は今回必須ではない
- 将来の Story / Task 退役は、hard delete ではなく理由付きの非破壊操作として扱う前提にする
- 退役理由はコメントとして残す運用または入力要件を持たせる前提で考える
