# wacha
Worker Aggregation and Control Hub for Agents

## MCP Server

Streamable HTTP 版の MCP サーバを起動できます。

- 起動: `npm run mcp:http`
- MCP endpoint: `http://localhost:3100/mcp`
- Health check: `http://localhost:3100/health`

ポートを変える場合は `MCP_PORT` を指定してください。

```bash
MCP_PORT=3200 npm run mcp:http
```

公開している主な tools:

- `task_list`
- `task_issue`
- `task_claim`
- `task_complete`
- `task_accept`
- `task_reject`
