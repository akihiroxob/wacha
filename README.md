# wacha

Worker Aggregation and Control Hub for Agents

## Overview

`wacha` は Streamable HTTP で MCP を提供する、プロジェクト / Story / Task 管理サーバです。

## Run

### Local

依存関係を入れたうえで、次のコマンドで起動します。
`npm run start` は `prestart` で WebUI (React SPA) を `public/` にビルドしてから Hono を立ち上げます。

```bash
npm install
npm run start
```

開発時はサーバ (tsx watch) と Vite dev server を同時に起動できます。

```bash
npm run dev
```

- Vite dev server: `http://localhost:5173` (`/api` は Hono へプロキシ)
- Hono server: `http://localhost:51743`

デフォルト設定:

- MCP endpoint: `http://localhost:51743/mcp`
- Health check: `http://localhost:51743/health`
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

このサーバは Streamable HTTP で接続します。すべてのリクエストに次の
Authorization header が必要です。

```http
Authorization: Bearer <AgentName>
```

初期実装では Bearer 値を検証せず、そのまま Principal ID（Agent 名）として
利用します。セキュリティ境界ではないため、信頼できないネットワークへ公開しないで
ください。

以下では Agent 名を環境変数に設定してからクライアントを起動します。

```bash
export WACHA_AGENT_NAME="MyAgent"
```

### Codex

`~/.codex/config.toml`（またはプロジェクトの `.codex/config.toml`）に登録します。

```toml
[mcp_servers.wacha]
url = "http://localhost:51743/mcp"
bearer_token_env_var = "WACHA_AGENT_NAME"
```

CLI から登録する場合は次のコマンドも利用できます。

```bash
codex mcp add wacha \
  --url http://localhost:51743/mcp \
  --bearer-token-env-var WACHA_AGENT_NAME
```

### Claude Code

Claude Code は HTTP server の `headers` で環境変数を展開できます。プロジェクトで
共有する場合は、プロジェクトルートの `.mcp.json` に次を記載します。

```json
{
  "mcpServers": {
    "wacha": {
      "type": "http",
      "url": "http://localhost:51743/mcp",
      "headers": {
        "Authorization": "Bearer ${WACHA_AGENT_NAME}"
      }
    }
  }
}
```

ローカル設定として CLI から登録する場合は次のコマンドを利用できます。この方法では
コマンド実行時の Agent 名が header に保存されます。

```bash
claude mcp add \
  --transport http \
  --scope local \
  --header "Authorization: Bearer ${WACHA_AGENT_NAME}" \
  wacha http://localhost:51743/mcp
```

- `--scope local`（デフォルト、自分のみ）/ `--scope project`（`.mcp.json` で共有）/ `--scope user`（全プロジェクト横断）を選べます
- 確認は `claude mcp list` / `claude mcp get wacha`、セッション内では `/mcp` を利用します

### Role Grant

接続に使う Agent 名には、対象 Project の Role Grant を事前に登録してください。同じ
Agent 名に複数 Role を付与できます。

Web UI のProject詳細にある「Role Grants」から、Agent名とRoleを指定して発行・取消
できます。CLIを使う場合は次のコマンドで発行できます。

```bash
npm run grant-role -- <projectId> <AgentName> <worker|reviewer|manager>
```

Role は永続化されるため、MCP session ごとの再取得は不要です。MCP の session ID は
Agent の識別、Role、Task の所有権には使いません。Task の操作権は期限付き Claim と
`claimId` で管理します。

### Web UIからの完全削除

人間による管理・復旧用途として、Project詳細のWeb UIからStory／Taskを状態にかかわらず
完全削除できます。Storyを削除すると配下Taskも削除され、対象TaskのClaimとコメントも
削除されます。Change Logは監査履歴として残ります。Agent／MCPの通常運用では完全削除を
使わず、理由を記録できる`cancel_story`／`cancel_task`を使用してください。

## Available Tools

参照:

- `list_projects`, `list_stories`, `list_tasks`
- `list_task_comments`, `list_changes`
- `list_skills`, `get_skill_context`, `get_role_instructions`

Manager 管理操作:

- `issue_story`, `edit_story`, `complete_story`, `cancel_story`
- `issue_task`, `edit_task`, `cancel_task`

Claim:

- `claim_task`, `claim_review`, `claim_acceptance`
- `renew_claim`, `release_claim`

Claim による状態更新:

- `add_task_comment`, `complete_task`, `reviewed_task`
- `accept_task`, `reject_task`

Task の主経路は `todo -> doing -> in_review -> wait_accept -> accepted` です。状態変更
Tool は `renew_claim` を除き `requestId` が必須で、Claim による更新には返却された
`claimId` も必要です。詳しい権限と運用フローは `agent/role-policy.md` および
`agent/` 配下の各 Role 文書を参照してください。

`availableFor` は Task 状態と有効 Claim から Phase 候補を返します。候補一覧は
Principal の個別 Role に依存せず、Role や自己レビュー禁止などの最終判定は
`claim_task` / `claim_review` / `claim_acceptance` が行います。

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
  -p 51743:51743 \
  -e PORT=51743 \
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

- app port: `51743:51743`
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
curl http://localhost:51743/health
```

期待されるレスポンス:

```json
{
  "status": "ok",
  "service": "wacha-mcp"
}
```
