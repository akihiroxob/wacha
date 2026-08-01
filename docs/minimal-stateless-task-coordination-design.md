# Minimal Stateless Task Coordination Design

- Status: Alternative B / Candidate
- Date: 2026-08-01
- Target: MCP `2026-07-28`
- Replaces as implementation candidate: Wacha-managed Agent Run / Lease

## 1. 結論

WachaはAgent process、Ralph Loop、Console sessionを管理しない。

Wachaの責務を、次の4点に限定する。

1. Project／Story／Task／Commentを永続化する
2. 認証済みPrincipalのProject Roleを検証する
3. Task単位の期限付きClaimと状態遷移を原子的に保証する
4. 状態変化を監査可能なChange Logとして公開する

Ralph、Codex Console、Claude Code、将来のLevel 6 orchestratorは、すべて同じMCP
contractを利用する外部clientである。Wachaは、それらの起動方法、loop、context、cost、
worktree、CI、停止条件を知らない。

```text
Ralph / Console / Level 6 Orchestrator
  ├─ Agentを起動・停止する
  ├─ context / cost / iterationを管理する
  ├─ Git / worktree / CIを操作する
  └─ Wacha MCPを呼ぶ
       ├─ Taskを読む
       ├─ Task Claimを取得・更新・解放する
       ├─ 状態を遷移する
       ├─ Commentを残す
       └─ Change Logを読む
```

## 2. 判断の基準

[AI開発活用の成熟度モデルと開発基盤7層](https://suama.atlassian.net/wiki/spaces/BUSINESS/pages/47022082/AI+7)
では、Level 5の本質を仕様、状態、記憶、検証、停止条件の外部化と定義している。
Level 6は同じ7層をAI自身が生成・改善・保守する段階であり、MCP server自身がAgent
runtimeになることを要求していない。

このため、次の原則を採用する。

- Wachaは外部状態と共同作業の正本になる
- orchestratorはWachaを含む複数の開発基盤を組み合わせる
- Wacha固有のrunner protocolをLevel 6の前提にしない
- clientの利用形態ではなく、Task coordinationの不変条件だけを実装する

## 3. MCP内外の責務境界

| 領域 | Wacha MCP | 外部client / orchestrator |
| --- | --- | --- |
| Project／Story／Task | 永続化・整合性 | 分解・選択方針 |
| Role | 認証済みPrincipalの権限検証 | credentialの保持・委任 |
| Task占有 | Task Claim・期限・排他 | いつ取得・更新・解放するか |
| 状態遷移 | 原子的なtransitionとguard | 実装・レビュー・受入判断 |
| 引き継ぎ | Comment・Claim履歴・Change Log | contextへの取り込み方 |
| Agent process | 管理しない | 起動・終了・再起動 |
| Ralph Loop | 管理しない | 反復数・cost・停止条件 |
| Console | 管理しない | 会話context・対話継続 |
| heartbeat scheduler | 管理しない | 必要ならClaimをrenewする |
| Git／worktree／PR | 管理しない | branch、commit、競合解決 |
| CI／release／rollback | 管理しない | 実行・評価・統制 |
| webhook／Agent起動 | coreでは管理しない | Change Logをpollするadapter |
| Level 6改善loop | 管理しない | 失敗分析と7層の改善 |

Wachaが期限を判定することと、process heartbeatを管理することは分ける。
WachaはClaimの`expiresAt`だけを保証し、renewをいつ送るかは外部clientが決める。

## 4. 共通利用モデル

### 4.1 Ralph batch

```text
list / claim_next
  ↓
Task Claim取得
  ↓
Agent起動・実装・検証
  ↓
comment / complete
  ↓
次のloop
```

Ralphの各iterationが同じPrincipalを使ってもよい。WachaはiterationやAgent Runを記録せず、
Task ClaimとCommentだけを記録する。

### 4.2 Console interactive / Vibe Coding

```text
Consoleを起動
  ↓
Task Aをclaim・complete
  ↓
Task Bをclaim・complete
  ↓
待機または会話
  ↓
Task Cをclaim
```

一つのConsoleで複数Taskを順番に処理できる。WachaにはConsole sessionという概念を持たない。
同時に保持できるWorker Claimを1 Principalあたり1件に制限するかはpolicyとして設定可能にし、
core data modelをConsole lifecycleへ結合しない。

### 4.3 Manager

Managerは認証済みPrincipalとしてStory／Taskを操作する。Task Claimやheartbeatを必要としない。
会話contextはCodex Console等が保持し、切断後の復元は今回のWacha責務に含めない。
永続化すべき意思決定はStory、Task、Comment、Change Logへ反映する。

## 5. IdentityとRole

### 5.1 Principal

MCP `clientInfo`、HTTP connection、旧`Mcp-Session-Id`はidentityにしない。

HTTP auth adapterが各requestから次の`AuthContext`を生成する。

```ts
type AuthContext = {
  principalId: string;
  projectGrants: Array<{
    projectId: string;
    roles: Array<"manager" | "reviewer" | "worker">;
  }>;
};
```

application層はcredential形式を知らない。初期のlocalhost運用ではrole別API key、将来は
OIDC、service account、reverse proxyの署名headerへadapterを差し替えられる。

### 5.2 Role

Roleは実行時に自己申告して取得する席ではなく、Principalへ事前に与えられたProject Grantである。

- manager toolはmanager grantを要求する
- worker claim／completeはworker grantを要求する
- review claim／reviewedはreviewer grantを要求する
- reviewerはProject単位で専有しない
- 一つのPrincipalへ複数Roleを与えることはできるが、自己レビューpolicyはPrincipal IDで判定する

`assign_project_role`はruntime toolから外す。grant管理は初期bootstrap設定または管理APIへ分離し、
clientが`requestedRole: manager`だけで昇格できないようにする。

## 6. Task Claim

Agent RunとAssignmentを一体で管理せず、Task coordinationに必要なClaimだけを持つ。

### 6.1 Data Model

```text
task_claim
  id                 UUID / opaque claimId
  task_id
  phase              worker | review
  principal_id
  state              active | completed | released | expired
  acquired_at
  expires_at
  released_at
  release_reason
```

制約:

- 同じTask／phaseのactive Claimは1件だけ
- Claimは認証Principalへbindする
- Claim IDは再取得ごとに変わり、古いClaim IDをfencingとして拒否する
- Claim履歴は削除しない
- Taskの現在担当はactive Claimから導出し、`task.assignee = sessionId`を廃止する

Agent Run ID、Run Handle、launch ID、runner name、client info、process heartbeatは保存しない。

### 6.2 Worker Claim

```text
todo / rejected
  -- claim_next_task --> doing + active worker claim
  -- complete_task --> in_review + claim completed
  -- release_claim --> todo + claim released
  -- expiry --> todo + claim expired
```

Claim失効時もComment、commit参照、reject理由、Claim履歴は保持する。

### 6.3 Review Claim

```text
in_review
  -- claim_next_review --> in_review + active review claim
  -- reviewed_task --> wait_accept + claim completed
  -- reject_task --> rejected + claim completed
  -- release / expiry --> in_review + claim released / expired
```

複数Reviewerは異なるTaskを並行してClaimできる。同じTaskだけをDB制約で排他する。

### 6.4 Claim Renewal

`renew_claim(claimId)`はClaimの`expiresAt`をserver上限まで延長する。

- Ralph wrapperが定期実行してもよい
- Console plugin／launcherが定期実行してもよい
- claim-bound mutationやComment投稿時に暗黙renewしてもよい
- renewしないclientはexpiryを受け入れる
- Wachaはclient processの生死を推測しない

これはAgent Run heartbeatではなく、Task占有を延長する汎用的なlease操作である。

初期値は運用で決める。短すぎるTTLをarchitectureへ固定せず、serverが既定値と上限を返す。

## 7. Commentと自己レビュー

`task_comment`は次を保持する。

```text
principal_id
claim_id nullable
body
author
created_at
```

- Workerの`complete_task`には、そのactive Worker Claimに紐づく検証Commentを要求する
- Claim失効前のCommentは引き継ぎ資料として残す
- 新しいClaimのWorkerは自分の検証Commentを追加してからcompleteする
- Reviewer Principalが、最後にTaskをcompleteしたWorker Principalと同じ場合は自己レビューとして拒否する
- Manager受入も、必要なら最後のWorker Principalとの同一性をpolicyで拒否する

Ralph iterationを別Agentとして自己レビュー可能にしたい場合は、Worker用とReviewer用を別Principalにする。
WachaへAgent Run概念を追加して回避しない。

## 8. Tool Contract

### 8.1 Read

```text
list_projects()
list_stories(projectId, status?)
list_tasks(projectId)
list_task_comments(taskId)
list_changes(projectId, afterCursor?, limit?)
```

read resultはsession、role、過去requestに依存しない。非公開Projectの場合だけAuthContextでfilterする。

### 8.2 Worker

```text
claim_next_task(projectId, requestId) -> { task, claimId, expiresAt }
claim_task(taskId, requestId) -> { task, claimId, expiresAt }
renew_claim(claimId)
release_claim(claimId, reason, requestId)
add_task_comment(taskId, claimId?, body, requestId)
complete_task(taskId, claimId, requestId)
```

`claim_next_task`はpriorityとdependencyを考慮したeligible Task選択、Task遷移、Claim作成を
一つのtransactionで行う。

### 8.3 Reviewer

```text
claim_next_review(projectId, requestId) -> { task, claimId, expiresAt }
claim_review(taskId, requestId) -> { task, claimId, expiresAt }
renew_claim(claimId)
release_claim(claimId, reason, requestId)
reviewed_task(taskId, claimId, requestId)
reject_task(taskId, claimId, reason, requestId)
```

### 8.4 Manager

Manager mutationはmanager grantと`requestId`を要求する。Task Claimは要求しない。

### 8.5 Idempotency

stateless requestのretryに備え、mutationは`requestId`を持つ。

- `(principalId, toolName, requestId)`を一意にする
- 同じ入力の再送は最初のresultを返す
- 異なる入力で同じkeyを使った場合はconflict
- Claimのretryでresponseを失っても同じclaimIdを回収できる

これはAgent lifecycleではなく、command処理の一般的な信頼性である。

## 9. Change Log

Wachaは状態変化をappend-onlyな`change_log`へtransactionalに記録する。

```text
change_log
  cursor
  project_id
  type
  entity_id
  principal_id
  claim_id nullable
  payload
  occurred_at
```

初期coreは`list_changes(afterCursor)`だけを公開する。

- long-poll `wait_for_events`をcore要件にしない
- webhook delivery／retry／DLQをcore要件にしない
- 外部adapterがChange Logをpollしてwebhook、queue、Agent起動へ変換する
- cursorと監査履歴はserver再起動後も保持する

これによりLevel 6 orchestratorをWachaから独立して交換・進化させられる。

## 10. Stateless MCP Adapter

MCP `2026-07-28`対応はTask coordinationと独立して進める。

- `initialize`、session registry、`Mcp-Session-Id`依存を削除する
- requestごとにAuthContextを解決する
- `tools/list`を固定・決定順にする
- tool引数はClaim IDとrequest IDだけを明示state handleとして持つ
- `/mcp-legacy`を設ける場合も、transport sessionをRole／Claim／Commentに使用しない

## 11. Level 5からLevel 6への拡張

### Level 5

screen-readerのRalph Loopは次だけを行う。

1. `claim_next_task`または`claim_next_review`
2. Agentを起動
3. 必要ならClaimをrenew
4. 実装／レビュー結果をCommentへ記録
5. complete／reviewed／reject／release
6. 次のiteration

Wachaは最大反復数、cost、prompt、context resetを管理しない。

### Level 6

外部orchestratorが次を統合する。

- Wacha Change LogとTask backlog
- Git／PR／merge queue
- CI／E2E／security scan
- production observability／rollback
- APM／Skill／Rule／AGENTS.md
- 失敗分析と改善Taskの起票
- 人間へのescalation

改善結果はWachaのStory／Task／Commentへ戻せるが、改善loop自体は別componentである。

## 12. Alternative Aとの比較

| 観点 | Alternative A: Agent Run | Alternative B: Task Claim |
| --- | --- | --- |
| Wachaの責務 | runtime＋coordination | coordinationのみ |
| Ralph／Console区別 | Run modeとして知る | 知らない |
| heartbeat | Agent Runをrenew | Task Claimだけをrenew |
| Manager | Manager Runが必要 | Principal grantのみ |
| process監査 | Wacha内に詳細保存 | 外部logger／orchestrator |
| Task排他 | Assignment Lease | Claim Lease |
| stale update防止 | fencing token | claimId |
| event起動 | outbox／webhook内蔵 | Change Log adapter |
| Level 6移行 | Wacha固有runnerに結合 | orchestrator交換可能 |
| 実装量 | 大 | 小 |

Alternative Bで失うのは、Wacha単体でのprocess一覧、Run履歴、runner生存監視である。
これらはLevel 6 orchestrator／observabilityの責務として必要になった時に追加する。

## 13. Migration

### Phase 1: SessionからPrincipalへ

- HTTP auth adapterとAuthContextを追加する
- session-based RoleGuardをPrincipal grantへ置き換える
- tool catalogを固定する
- v1 transportを使う間もsession IDをapplication identityにしない

### Phase 2: Task Claim

- `task_claim`とcommand receiptを追加する
- claim／review claim／renew／releaseを追加する
- Task、Comment、自己レビュー判定をPrincipal／Claim基準へ変更する
- `task.assignee`をactive Claimからの導出へ変更する

### Phase 3: Change Log

- transactional `change_log`を追加する
- `list_changes`を追加する
- インメモリEventBus／session-based `wait_for_events`を置き換える

### Phase 4: Client移行

- screen-reader RalphをClaim contractへ変更する
- Console用の説明とlauncher例を用意する
- process lifecycle、renew schedule、worktreeはclient側に残す

### Phase 5: MCP 2026-07-28

- stateless `/mcp`を追加する
- client移行後にSessionService、project_membership、legacy endpointを削除する

## 14. Existing Data

- `project_membership`: 認証Principalのgrantへ変換できるものだけ移行し、旧session行は削除
- `doing`: `todo`へ戻し、旧assigneeを解除
- `in_review`: 維持し、active Review Claimなし
- `wait_accept`以降: 状態維持
- `task_comment`: 本文・author・時刻を保持し、旧session IDはlegacy fieldへ退避
- 旧in-memory event: 移行対象外

legacy writerを停止してからmigrationし、旧sessionが移行後のTaskを更新できないようにする。

## 15. Acceptance Tests

### Stateless

- initialize／Mcp-Session-Idなしでread／mutationが成功する
- requestごとのPrincipal grantでRoleが検証される
- tools/listがPrincipalや過去requestで変化しない

### Worker

- 並行claimで同じTaskを二重取得しない
- Claim expiryで`doing -> todo`になりCommentが残る
- 古いclaimIdによるcompleteを拒否する
- claim request retryで同じclaimIdを返す

### Reviewer

- 複数Reviewerが異なるTaskを並列Claimできる
- 同じTaskのReview Claimは1件だけ
- Review Claim expiry後もTaskは`in_review`
- Workerと同じPrincipalの自己レビューを拒否する

### Client independence

- Ralph batchがAgent Run APIなしで動く
- Consoleが同一認証で複数Taskを順番に処理できる
- Claimを持たない待機中ConsoleはWacha上のresourceを占有しない
- 外部consumerが`list_changes`から再起動後も追従できる

## 16. 採用しないもの

初期coreには次を入れない。

- Agent Run／Run Handle／Run lifecycle
- Ralph／Console mode
- process heartbeat／process registry
- Manager Context
- worktree manager
- Agent launcher
- webhook delivery worker／DLQ
- cost／iteration／token budget
- CI／release／rollback orchestrator

これらは外部componentがWachaのTask ClaimとChange Logを使って実現する。

## 17. 実装優先順位

1. Principal auth adapterとProject Role Grant
2. Task Claim／claimId fencing／atomic claim
3. Claim renewal／release／expiry回収
4. Comment／自己レビューのPrincipal・Claim移行
5. transactional Change Logと`list_changes`
6. screen-reader RalphのClaim contract移行
7. MCP `2026-07-28` stateless adapter
8. legacy session／membership削除

この順序なら、MCP v2 client対応を待たずに現在のstale Doing問題を解消し、Level 6の外側を
後から自由に構築できる。
