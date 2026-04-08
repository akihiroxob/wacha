# wacha

Worker Aggregation and Control Hub for Agents

## Overview

`wacha` は Streamable HTTP で MCP を提供する、プロジェクト / Story / Task 管理サーバです。

## Start

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

## MCP Registration

このサーバは Streamable HTTP で接続します。
`x-wacha-worker-id` header は任意です。

登録例:

```json
{
  "mcpServers": {
    "wacha": {
      "transport": {
        "type": "streamable_http",
        "url": "http://localhost:3000/mcp",
        "headers": {
          "x-wacha-worker-id": "worker-1"
        }
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
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-wacha-worker-id": "worker-1"
      }
    }
  }
}
```

補足:

- `x-wacha-worker-id` を省略した場合、サーバ側で `auto:<uuid>` 形式の workerId をセッション単位で自動採番します
- 自動採番された workerId は接続ごとに変わるため、再接続後も同じ worker として扱いたい場合は `x-wacha-worker-id` を固定で渡してください
- `issue_story`, `issue_task`, `accept_task` など role 制御付き tool は、header だけではなく project membership 側の role も必要です
- 接続確認は `http://localhost:3000/health` と MCP client 側の initialize で行ってください

## Available Tools

- `list_projects`
- `list_project_agents`
- `list_stories`
- `issue_story`
- `claim_story`
- `complete_story`
- `cancel_story`
- `list_tasks`
- `issue_task`
- `claim_task`
- `complete_task`
- `accept_task`
- `reject_task`
- `assign_project_role`

## Docker

現状、このリポジトリには `Dockerfile` や `compose.yaml` はありません。

運用の観点では、Docker 化したほうが扱いやすいです。特に次のケースでは Docker の恩恵が大きいです。

- 常駐させたい
- 複数人が同じ手順で起動したい
- MCP client から安定した URL で叩きたい
- SQLite ファイルの保存場所を volume で固定したい

逆に、手元で一人で触るだけなら、今の `npm run start` でも十分です。

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
