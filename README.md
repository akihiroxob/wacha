# wacha

Worker Aggregation and Control Hub for Agents

## Overview

`wacha` は Streamable HTTP で MCP を提供する、プロジェクト / Story / Task 管理サーバです。

## Run

### Local

依存関係を入れたうえで、次のコマンドで起動します。

```bash
npm install
npm run start
```

デフォルト設定:

- MCP endpoint: `http://localhost:3000/mcp`
- Health check: `http://localhost:3000/health`
- DB path: `wacha.db`

ポートを変える場合は `PORT` を指定します。

```bash
PORT=3100 npm run start
```

DB パスを変える場合は `WACHA_DB_PATH` を指定します。

```bash
WACHA_DB_PATH=.tmp/wacha.db npm run start
```

### Docker Compose

```bash
docker compose up --build
```

バックグラウンドで起動する場合:

```bash
docker compose up --build -d
```

停止:

```bash
docker compose down
```

volume も削除する場合:

```bash
docker compose down -v
```

## MCP Registration

このサーバは Streamable HTTP で接続します。

登録例:

```json
{
  "mcpServers": {
    "wacha": {
      "transport": {
        "type": "streamable_http",
        "url": "http://localhost:3000/mcp"
      }
    }
  }
}
```

クライアントによっては `transport` を使わず、次のようなフラットな形式です。

```json
{
  "mcpServers": {
    "wacha": {
      "type": "streamable_http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

補足:

- サーバ側の識別子は MCP の `sessionId` ベースです
- `claim_task` の担当者や project membership も `sessionId` に紐づきます
- role 制御付き tool の実行には project membership 側の role が必要です
- server 再起動後に旧 `sessionId` を送ると、MCP は `Session expired or server restarted; initialize again` を返します
- client はそのエラーを受けたら `initialize` をやり直し、必要なら `assign_project_role` で role を取り直してください
- 接続確認は `http://localhost:3000/health` と MCP client 側の initialize で行ってください

## Available Tools

- `list_projects`
- `list_project_agents`
- `list_stories`
- `issue_story`
- `edit_story`
- `claim_story`
- `complete_story`
- `cancel_story`
- `list_tasks`
- `issue_task`
- `claim_task`
- `complete_task`
- `reviewed_task`
- `accept_task`
- `reject_task`
- `assign_project_role`
- `get_role_instructions`

Task flow:

- `claim_task`: `todo` / `rejected` -> `doing`
- `complete_task`: `doing` -> `in_review`
- `reviewed_task`: `in_review` -> `wait_accept`
- `accept_task`: `in_review` / `wait_accept` -> `accepted`
- `reject_task`: `in_review` / `wait_accept` -> `rejected`

## Docker

ベースイメージは `node:22-bookworm-slim` です。
`better-sqlite3` を使うため、Debian slim 系を使います。

### Docker Build

```bash
docker build -t wacha .
```

### Docker Run

```bash
docker run --rm \
  -p 3000:3000 \
  -e PORT=3000 \
  -e WACHA_DB_PATH=/data/wacha.db \
  -v wacha-data:/data \
  wacha
```

### Docker Compose

```bash
docker compose up --build
```

バックグラウンド実行:

```bash
docker compose up --build -d
```

Compose の設定内容:

- app port: `3000:3000`
- DB path: `/data/wacha.db`
- named volume: `wacha-data`

停止:

```bash
docker compose down
```

volume も削除する場合:

```bash
docker compose down -v
```

## Health Check

```bash
curl http://localhost:3000/health
```

期待されるレスポンス:

```json
{
  "status": "ok",
  "service": "wacha-mcp"
}
```
