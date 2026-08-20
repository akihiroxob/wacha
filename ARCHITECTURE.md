# Wacha アーキテクチャ

## 位置づけ

Wacha は、Project、Story、Task、Role、Claim、Review を Streamable HTTP MCP と Web UI から操作するタスク調整サービスである。

Task 調整の正本仕様は `docs/agent-task-coordination-spec.md`、Agent の運用規則は `AGENTS.md` と `agent/` 配下を正とする。

## 実行境界

### MCP

`POST /mcp` はリクエストごとに server と transport を生成するステートレス endpoint である。

- `Authorization: Bearer <AgentName>` を Principal ID として扱う
- Project Role Grant は SQLite に永続化する
- Task の操作権は期限付き Claim で管理する
- mutation は `renew_claim` を除いて `requestId` で冪等化する
- Task、Claim、Change Log を同じトランザクションで更新する

MCP tool は `src/mcp/createMcpServer.ts` で登録し、Task 調整操作を `TaskCoordinationService` へ委譲する。

### Web UI

Web UI の `/api` は trusted-local の未認証運用者 interface である。

- Role Grant管理、Story／Task編集、hard deleteを提供する
- Task のaccept／reject／cancelは `TaskCoordinationService` の運用者経路を使う
- 未認証操作は監査用Principal `system:web-ui` としてChange Logへ記録する
- `system:web-ui` は実ユーザーの本人性を表さない
- hard deleteは人間向け復旧操作であり、通常のAgent運用では理由付きcancelを使う

未認証Web UIを信頼できないネットワークへ公開してはならない。将来認証を追加する場合は、固定Principalを認証済み利用者Principalへ置き換える。

## 現在の実装構成

```txt
src/
  app.ts                         # Hono route、MCP transport、error handling
  container.ts                   # 手動DI
  mcp/createMcpServer.ts         # MCP tool schemaとadapter
  application/service/
    TaskCoordinationService.ts   # Claim、Role、状態遷移、冪等性、Change Log
    InstructionService.ts        # Role instruction配信
  application/usecase/           # Web UI CRUDと既存domain操作
  domain/                         # Project／Story／Task modelとrepository interface
  infrastructure/database/       # SQLite schema、migration、Kysely client
  infrastructure/repository/     # repository実装
  presentation/controller/       # Web UI JSON API
  frontend/                      # React SPA
```

`TaskCoordinationService` は複数テーブルの原子的更新を保証するため、application service からKysely／SQLite schemaを直接利用している。これは現在の意図的な構成であり、厳密なClean Architectureの依存方向は採用していない。

Project／StoryのCRUDとWeb UI表示にはdomain model／repository／use caseを利用する。Task workflowの状態変更を追加するときは、旧use caseへ独立した遷移を追加せず、`TaskCoordinationService` の共通トランザクションへ追加する。

## Role と権限

Project Role は次の3つである。

- `manager`: Story作成、Task計画、編集、優先順位、最終受入
- `reviewer`: 実装レビュー、差し戻し、レビュー中に発見した技術的follow-up Task作成
- `worker`: Task実行、レビュー提出、作業中に発見した技術的follow-up Task作成

RoleはPrincipalとProjectの組み合わせで永続化し、同じPrincipalが複数Roleを保持できる。Roleの選択やsessionへの紐付けは行わない。

## Task workflow

```txt
todo -> doing -> in_review -> wait_accept -> accepted
          ^          |             |
          |          +-> rejected <-+
          +------------- claim_task
```

- workerはwork Claimを取得して `doing` へ進める
- reviewerはReview Claimで `in_review` を確認する
- managerはAcceptance Claimで最終判断する
- managerが `in_review` を直接受け入れる場合、`claim_acceptance` が `wait_accept` へ進める
- Claimは期限付きで、古いClaimは新しいClaim取得後に更新できない
- 最後の未完了Taskが受け入れられるとStoryを `done` へ同期し、Change Logへ記録する

`availableFor` は呼出PrincipalのRole、自己レビュー・自己受入、Task状態、有効Claimを考慮し、実際にClaim可能な候補だけを返す。最終的な競合判定は `claim_*` がトランザクション内で再検証する。

## Skill と instruction

- `agent/*.md`: Roleごとの責務と操作フロー
- `skill/*.md`: 再利用可能な作業手順
- `knowledge/`: Skillが参照する原則と実務知識
- `get_role_instructions`: Role文書を配信する
- `list_skills`／`get_skill_context`: Skillと必要知識を配信する

Skillの `allowRoles`、`requiredTools`、本文の操作手順は `agent/role-policy.md` の権限表と一致させる。

## 変更時の判断基準

- Task状態遷移、Claim、Role、Change Log: `TaskCoordinationService`
- MCP公開schema: `createMcpServer.ts`
- Web UI endpoint: `PageController.ts`
- Project／Storyの単純CRUD: domain use case／repository
- Agentの行動規則: `AGENTS.md` と `agent/`
- 再利用手順: `skill/`

同じTask状態遷移をMCP用とWeb UI用に別実装しない。
