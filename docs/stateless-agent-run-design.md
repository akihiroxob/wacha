# Stateless MCP Agent Run / Lease Design

> **Alternative A — Wacha-managed runtime案として保存**
>
> この文書は、Agent Run、Run Handle、heartbeat、Assignment LeaseまでをWachaが管理する
> 高機能案の記録である。Ralph／Console／将来のorchestratorとの責務境界を再検討した結果、
> より小さいMCP contractを
> [`minimal-stateless-task-coordination-design.md`](./minimal-stateless-task-coordination-design.md)
> でAlternative Bとして検討する。比較可能性を保つため、本文は当時の案を維持する。

- Status: Alternative A / Preserved
- Date: 2026-07-31
- Target: MCP `2026-07-28` / TypeScript SDK v2

## 1. 目的

Wacha の実行主体、ロール、Task の占有を MCP transport の session から分離する。

目指す運用は次のとおり。

- Ralph Loop が起動する Worker / Reviewer は、起動ごとに新しい Agent Run とする
- Worker が終了して Task を完了できなかった場合、期限切れ後に Task を `todo` へ戻す
- 旧 Worker のコメント、検証結果、イベント履歴は残し、次の Worker が引き継ぐ
- Reviewer はプロジェクト単位で専有せず、複数起動できる
- 同じ Task のレビューだけを Review Lease で排他する
- MCP request は stateless とし、どの server instance でも処理できる

## 2. MCP 2026-07-28 から受ける制約

MCP `2026-07-28` では、`initialize` / `notifications/initialized` と
`Mcp-Session-Id` が廃止される。各 request は protocol version、client capabilities、
client info を `_meta` に含める。

application state が必要な場合は、server が明示的な handle を発行し、通常の tool
引数として呼び出し側が渡す。

そのため、次の設計は継続できない。

- transport session ID を Agent identity として使用する
- session ID に Project Role を紐づける
- session close を membership / assignee の解放契機にする
- `tools/list` の内容を接続済み role に応じて変える
- server process 内の session registry に認可判断を依存させる

参照:

- [MCP 2026-07-28 announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [SEP-2567: Sessionless MCP via Explicit State Handles](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2567)
- [SEP-2575: Make MCP Stateless](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575)
- [TypeScript SDK v2](https://github.com/modelcontextprotocol/typescript-sdk)

## 3. 現状の課題

### 3.1 Wacha

現在は次の値がすべて MCP session ID に結合している。

- `project_membership.session_id`
- `task.assignee`
- `task_comment.session_id`
- RoleGuard の呼び出し主体
- 自己レビュー・自己受入判定
- heartbeat と stale seat 判定
- `wait_for_events` のイベントフィルタ

session close は client が `DELETE /mcp` を送った場合にしか確実に通知されない。
Claude のプロセス終了・異常終了では membership が残り得る。特に Worker は専有席では
ないため、新しい role 取得による stale cleanup も行われない。

### 3.2 screen-reader の Ralph Loop

`/Users/aokayama/git/screen-reader` の実験では、次の二種類の MCP session が作られる。

1. 外側の `ralph-worker.sh` / `ralph-reviewer.sh` が状態確認用に作る session
2. 起動された Claude Code が Wacha tool を呼ぶために作る session

外側の状態確認 session は明示 close されず、Claude Code 側の session lifecycle も
Wacha からは保証できない。

また、現在の Worker prompt は「自分の session ID が assignee の `doing` Task」を再開する。
起動ごとに新しい Agent とする方針では、この再開条件は成立しない。

## 4. 設計原則

1. **Transport session は identity ではない**
   - MCP version、`clientInfo`、HTTP connection は観測情報としてのみ扱う
2. **Agent は起動単位**
   - Ralph が Claude を一回起動する単位を Agent Run とする
3. **占有は期限付き**
   - role の実行権限と Task / Review の占有には server 時刻の lease を使う
4. **正しさは clean shutdown に依存しない**
   - 正常終了時は即解放し、異常終了時は lease expiry で必ず回収する
5. **古い実行を fencing する**
   - 期限切れ後に復帰した旧 Worker は、Task を完了・更新できない
6. **履歴は Task に残す**
   - Agent Run が失効しても comment、artifact、event、assignment history は削除しない
7. **mutation は冪等にする**
   - stateless request の再送で二重 claim、二重 comment、二重 transition を起こさない
8. **tool catalog は固定する**
   - `tools/list` は role、run、過去の tool call に依存させない

## 5. 用語

| 用語 | 意味 | 寿命 |
| --- | --- | --- |
| Principal | HTTP 認証で識別する利用者・runner | 認証設定次第 |
| Agent Run | Ralph が起動する Worker / Reviewer / Manager の一回の実行 | 数分〜数時間 |
| Run Handle | Agent Run を解決する server 発行の bearer handle | Agent Run と同じ |
| Assignment | Agent Run が Task の特定 phase を担当した履歴 | 永続 |
| Assignment Lease | Worker 作業またはレビューの期限付き占有 | heartbeat で延長 |
| Fencing Token | 古い Assignment からの遅延更新を拒否する世代番号 | Assignment ごと |
| Operation ID | mutation の再送を重複排除する呼び出しID | 永続または保持期間内 |

「同じ論理エージェント」は、process をまたいで同じ handle を再利用する主体を指す。
今回の Ralph Loop では採用せず、起動ごとに新しい Agent Run を作る。

## 6. Target Architecture

```text
Ralph Worker / Reviewer
  ├─ start_agent_run(launchId, role)
  ├─ acquire_next_task / acquire_next_review
  ├─ heartbeat_agent_run(runHandle) ──┐
  └─ Claude Code                     │
       ├─ task comments              │
       ├─ complete / review / reject │
       └─ finish_agent_run           │
                                     ▼
Stateless MCP adapter
  ├─ requestごとに protocol/auth/_meta を検証
  ├─ runHandle / assignmentHandle を解決
  └─ application UseCase
       ├─ AgentRunRepository
       ├─ AssignmentRepository
       ├─ TaskRepository
       └─ Persistent Event/Outbox
```

Wacha の application state は SQLite（将来は共有DB）に置く。MCP server instance 内には
session registry、role membership、イベントカーソルを保持しない。

## 7. Identity と認可

### 7.1 MCP clientInfo を identity にしない

`io.modelcontextprotocol/clientInfo` は name / version を伝える観測情報であり、安定した
一意IDや認証済みprincipalではない。RoleGuard は clientInfo を信頼しない。

### 7.2 Run Handle

`start_agent_run` は次を返す。

```json
{
  "agentRunId": "run_...",
  "runHandle": "wrh_...",
  "role": "worker",
  "leaseExpiresAt": 1780000000000,
  "heartbeatIntervalMs": 15000
}
```

- `agentRunId` は UI / event / audit 用の公開ID
- `runHandle` は十分なentropyを持つopaque bearer secret
- DBには `runHandle` のhashだけを保存する
- runHandle は project と role に固定し、role変更には使わない
- request log、comment、エラーに生のrunHandleを出さない

HTTP auth を導入する場合、runHandle は発行時principalにbindする。handleが漏れても
別principalからは使用できない。

### 7.3 Role

- Worker: 複数runを許可
- Reviewer: 複数runを許可
- Manager: 現行責務を保つため、初期実装ではprojectごとにactive runを1件に制限
- 同一Agent Runのroleは不変

Reviewerの排他単位はprojectではなくTaskである。

Runを作成できるroleはHTTP principalまたはrunner用credentialで制限する。少なくとも
Manager Runを「role名を指定しただけ」で発行してはならない。

ローカル運用の初期形は、Ralph wrapperだけが保持するrole別runner tokenを
`Authorization` headerで送り、発行後の制限済みrunHandleだけをClaudeへ渡す。runner token
自体はpromptへ含めない。

### 7.4 自己レビュー

今回の合意では、起動ごとに別Agentとして扱う。

- 同じ `agentRunId` はrole不変なので、自分のWorker Assignmentをreviewできない
- 次のRalph起動で作られたReviewer Runは別Agentであり、レビュー可能

将来「同じrunner principalによるレビューも禁止」する場合は、principal単位の
separation-of-duty policyを追加する。

## 8. Data Model

### 8.1 `agent_run`

| column | 内容 |
| --- | --- |
| `id` | 公開するAgent Run ID |
| `project_id` | 対象Project |
| `role` | manager / reviewer / worker |
| `state` | active / finished / expired / revoked |
| `launch_id` | Ralph生成の冪等キー |
| `handle_hash` | Run Handle hash |
| `principal_id` | 認証principal。未導入時はnullable |
| `runner_name` | ralph-worker / ralph-reviewer / manual 等 |
| `client_info_json` | MCP clientInfoの観測値 |
| `last_heartbeat_at` | 最終heartbeat |
| `lease_expires_at` | Run Lease期限 |
| `started_at` | 開始時刻 |
| `ended_at` | 終了時刻 |
| `end_reason` | completed / process_exit / expired / revoked 等 |

制約:

- `UNIQUE(project_id, launch_id)`
- managerのみ `project_id + role + active` のpartial unique index

### 8.2 `task_assignment`

| column | 内容 |
| --- | --- |
| `id` | Assignment ID |
| `task_id` | 対象Task |
| `agent_run_id` | 担当Agent Run |
| `phase` | worker / reviewer |
| `state` | active / completed / released / expired / revoked |
| `handle_hash` | Assignment Handle hash |
| `fencing_token` | Task phaseごとの単調増加世代 |
| `lease_expires_at` | Assignment Lease期限 |
| `acquired_at` | 取得時刻 |
| `ended_at` | 終了時刻 |
| `end_reason` | completed / rejected / run_exit / lease_expired 等 |

制約:

- 同じTaskのactive Worker Assignmentは最大1件
- 同じTaskのactive Reviewer Assignmentは最大1件
- 異なるTaskには複数Reviewer Runが同時にAssignmentを持てる

SQLiteでは `WHERE state = 'active'` のpartial unique indexで保証する。

### 8.3 Task

`task.assignee` のsession IDは廃止する。現在の担当はactive Assignmentから導出する。

一覧応答には次を含める。

```json
{
  "activeWorkerRunId": "run_...",
  "activeReviewerRunId": null,
  "workerLeaseExpiresAt": 1780000000000,
  "reviewLeaseExpiresAt": null
}
```

Taskの状態とAssignmentの状態は別に持つ。特にレビュー中はTaskを `in_review` のままにし、
Reviewer Assignmentだけをactiveにする。

### 8.4 Task Comment

- `task_comment.session_id` を `agent_run_id` / `assignment_id` に置き換える
- lease失効後もコメントは削除しない
- 旧session IDはmigration用の `legacy_actor_id` に退避してもよい
- `complete_task` に必要な実施・検証コメントは、現在のWorker Assignmentを持つrun自身が
  投稿したものに限定する
- 旧Workerのコメントは引き継ぎ資料にはなるが、新Worker自身の検証コメントの代わりにはしない

### 8.5 Event / Outbox

現在のインメモリevent bufferはserver restartと複数instanceに耐えないため、永続化する。

- `domain_event`: project内の単調増加sequenceとevent payload
- `event_cursor`: consumer単位のcursorが必要な場合に使用
- `webhook_outbox`: webhook delivery、retry、dead-letter用

heartbeatごとのeventは保存しない。started、assignment acquired、expired、requeued、
completed、reviewed、rejectedなど意味のある変化だけを保存する。

## 9. Lease

### 9.1 推奨初期値

| 設定 | 初期値 |
| --- | --- |
| Ralph heartbeat interval | 15秒 |
| Agent Run Lease | 60秒 |
| Worker / Review Assignment Lease | 90秒 |
| Sweeper interval | 10秒 |

すべて環境変数で変更可能にする。判定にはserver時刻だけを使う。

### 9.2 Renewal

`heartbeat_agent_run(runHandle)` はtransaction内で次を更新する。

1. Agent Run Lease
2. そのrunが持つすべてのactive Assignment Lease

Claudeのtool呼び出し頻度には依存しない。Ralph wrapperがClaude processの生存中に
background heartbeatを送る。

### 9.3 Worker Lease Expiry

active Worker Assignmentが失効した場合:

1. Assignmentを `expired` にする
2. Taskが同じfencing tokenの `doing` なら `todo` に戻す
3. active担当を解除する
4. Task commentは保持する
5. `task_requeued` eventとsystem commentを残す
6. 次のWorkerがclaim可能になる

元状態が `rejected` でも、合意どおり再キュー先は `todo` とする。Reject理由はevent/comment
履歴で保持する。

Story statusはlease expiryだけでは変更しない。Story全体の進行状態はmanagerの管理対象とする。

### 9.4 Review Lease Expiry

active Reviewer Assignmentが失効した場合:

1. Assignmentを `expired` にする
2. Taskは `in_review` のまま維持する
3. `review_released` eventを残す
4. 別Reviewerが取得可能になる

### 9.5 Clean Exit

Ralphは `trap` で `finish_agent_run` を呼ぶ。

- Task完了済み: Runをfinishedにする
- Worker processが正常終了したがTaskが `doing`: Assignmentをreleaseし即 `todo` へ戻す
- Reviewer processが正常終了したが未判定: Review Assignmentだけをreleaseする

正しさはこのclean exitに依存せず、呼ばれなければlease expiryが同じ結果を作る。

### 9.6 Fencing

Task mutationには `assignmentHandle` と `fencingToken` を要求する。

更新SQLは概念的に次の条件を含む。

```sql
WHERE assignment.state = 'active'
  AND assignment.lease_expires_at > :now
  AND assignment.fencing_token = :fencingToken
```

期限切れ後に旧Workerが `complete_task` を送っても、新しいWorkerの作業を上書きできない。

## 10. Tool API

### 10.1 Run lifecycle

```text
start_agent_run(projectId/baseDir, role, launchId, runnerInfo)
heartbeat_agent_run(runHandle)
finish_agent_run(runHandle, reason)
list_agent_runs(projectId, state?)
```

`assign_project_role` と `list_project_agents` は上記へ置き換える。

### 10.2 Worker

```text
acquire_next_task(runHandle, operationId)
claim_task(runHandle, taskId, operationId)
add_task_comment(runHandle, assignmentHandle, taskId, body, operationId)
complete_task(runHandle, assignmentHandle, fencingToken, taskId, operationId)
```

`acquire_next_task` は優先順位先頭のeligible Task選択とAssignment作成を1transactionで行う。
Ralph Loopでは `list_tasks -> claim_task` よりこちらを優先する。

### 10.3 Reviewer

```text
acquire_next_review(runHandle, operationId)
claim_review(runHandle, taskId, operationId)
reviewed_task(runHandle, assignmentHandle, fencingToken, taskId, operationId)
reject_task(runHandle, assignmentHandle, fencingToken, taskId, reason, operationId)
```

Reviewerは複数起動できるが、同一Taskのactive Review Assignmentは1件だけである。

### 10.4 Manager

manager mutationも `runHandle` と `operationId` を要求する。最終受入はTask Assignmentでは
なくactive Manager Runのroleで認可する。

### 10.5 Read tools

`list_projects`、`list_stories`、`list_tasks`、`list_task_comments`、`list_skills` は
transport sessionやAgent Runなしでも同じschemaを返す。非公開Projectを導入する場合は
HTTP principalで制御する。

### 10.6 Idempotency

各mutationはcallerが生成した `operationId` を要求する。

- `start_agent_run` は `launchId`
- その他は `runHandle + operationId`
- 同じkeyの再送は、最初の成功結果を返す
- 同じkeyで異なる引数が来た場合はconflictにする

JSON-RPC request IDだけには依存しない。

## 11. Stateless MCP Adapter

### 11.1 Target

- `@modelcontextprotocol/sdk` v1を、v2の分割packageへ移行する
  - `@modelcontextprotocol/server`
  - `@modelcontextprotocol/hono`
- `initialize`、session map、`onsessionclosed` を削除する
- requestごとに独立してMCP処理を完結させる
- `server/discover` を実装する
- `Mcp-Method` / `Mcp-Name` headerを受け付ける
- tool resultの `resultType` とserver `_meta` をSDKに従って返す
- `tools/list` は固定・決定順にする

### 11.2 v1 compatibility

Claude Code側のv2対応時期と独立してapplication migrationを進めるため、一時的にadapterを分ける。

```text
/mcp          MCP 2026-07-28 stateless
/mcp-legacy   MCP 2025-03-26 Streamable HTTP
```

legacy adapterのsession IDはtransport互換のためだけに使い、role、assignee、comment、
event filterには使用しない。両endpointとも同じrunHandle / assignmentHandleを使う。

screen-readerの `.mcp.json` はClaude Codeの対応状況に応じてendpointを切り替える。

## 12. Event Wake-up

MCP `2026-07-28` の `subscriptions/listen` はprotocol notification用であり、Wachaの
Task orchestration eventと同一視しない。

初期段階では次を使う。

- Ralph: `acquire_next_task` / `acquire_next_review` の短いpoll
- 長時間待機: explicit `runHandle + afterSeq` を受ける `wait_for_events`
- 外部起動: persistent outboxからwebhook

現在のsession roleでfilterする `wait_for_events` は廃止し、runHandleからproject / roleを
解決する。cursorはserver instanceのmemoryではなく永続event sequenceを使う。

MCP Tasks extensionは「MCP tool call自体の長時間実行」を扱うもので、WachaのProject Taskとは
責務が異なる。初期migrationでは統合しない。

## 13. screen-reader Ralph Loop のTarget Flow

### 13.1 Worker

```text
launchIdを生成
  ↓
start_agent_run(role=worker)
  ↓
acquire_next_task
  ├─ 対象なし → finish_agent_run(no_work) → 終了
  └─ Assignment取得
       ↓
heartbeat subprocess開始
       ↓
Claudeを1回起動
  - taskId
  - runHandle
  - assignmentHandle
  - fencingToken
  をpromptへ渡す
       ↓
Claudeがコメント・検証・complete_task
       ↓
Ralphがfinish_agent_run
```

Claude自身にTask選択・role取得・session assignee再開をさせない。Ralphがwork acquisitionを
完了してからClaudeを起動する。

### 13.2 Reviewer

Workerと同じ構造で `acquire_next_review` を使う。複数のRalph Reviewerを起動しても、
異なるTaskを並列レビューできる。同じTaskはDB制約により1件だけ取得される。

### 13.3 Process Failure

- Claudeだけ終了: Ralphが即release
- Ralphごと終了 / kill: heartbeat停止、lease expiryで回収
- Wacha再起動: DB上のlease時刻で回収
- 同じClaudeが遅れて戻る: fencingでmutation拒否

### 13.4 Git Worktree

Task LeaseはWacha上の排他であり、同じfilesystemを複数Agentが編集する競合までは防がない。
複数Worker / Reviewerを実際に並列化する段階では、RalphがAgent RunまたはTaskごとにGit
worktreeを割り当てる。

- Worker completion comment / artifactにbranch、commit、worktree keyを記録する
- ReviewerはAssignmentが指すcommitをreviewする
- lease expiry時にworktreeを即削除せず、未コミット差分の回収可否を記録する
- worktree cleanupはTask再キューと別処理にし、成果物消失を避ける

## 14. Migration

### Phase 0: Decision / Contract

- 本文書を承認する
- tool名、TTL初期値、Manager exclusivityを確定する
- current event workと競合する範囲を洗い出す

### Phase 1: Application stateをsessionから分離

- `agent_run` / `task_assignment` / idempotency storageを追加
- Run / Assignment UseCaseを追加
- RoleGuardをRunHandleGuardへ置換
- Task、Comment、Eventのactorをrun IDへ変更
- session-based `wait_for_events` をrunHandle-basedへ変更
- persistent event log / outboxを導入

この段階ではtransportはv1のままでもよい。

### Phase 2: screen-reader Ralphを移行

- 状態確認だけの `start_mcp_session` を廃止
- Ralph側でrun作成、work取得、heartbeat、clean finishを実装
- Worker / Reviewer promptへassignment contextを注入
- `doing` session再開ロジックを削除
- Worker / Reviewerを別worktreeで並列実行する

### Phase 3: MCP v2

- TypeScript SDK v2へ更新
- stateless `/mcp` を追加
- legacy endpointとのcontract testを実施
- Claude Codeが対応後、screen-readerをv2 endpointへ切り替える

### Phase 4: Legacy削除

- `/mcp-legacy`、SessionService、SessionRepository、SessionDatabaseを削除
- `project_membership` を削除
- session IDを受け取るtool引数・event fieldを削除
- stale seat環境変数とsession復旧文書を削除

### 14.1 Existing Data

破壊的migrationを許容し、次のように扱う。

- `project_membership`: 削除
- `doing` Task: `todo` に戻し、assigneeを解除
- `in_review` Task: 状態維持、active Reviewerなし
- `wait_accept`: 状態維持
- `task_comment`: 本文・author・時刻を保持。session IDは `legacy_actor_id` へ退避
- 旧in-memory event: migration対象外
- migration内容をsystem event / migration reportへ残す

## 15. Failure / Security Requirements

- expired / finished / revoked runHandleは使用不可
- role不一致、project不一致、assignment不一致は処理本体前に拒否
- handleはhash保存し、ログへ出さない
- lease延長はserver側上限を超えられない
- stale Workerの遅延completeをfencingで拒否
- 同一operationIdの再送を重複排除
- lease cleanupはbackground sweeperだけに依存しない
  - list / acquire / mutation前にも期限を評価する
- cleanupとclaimは同一transactionまたは同等の排他で行う
- 複数instance化する場合、SQLite単一process前提を外し共有DBへ移行する

## 16. Acceptance Tests

### Agent Run

- 起動ごとに別Agent Runが発行される
- clean finishでRun / Assignmentが即終了する
- process kill後、期限を進めるとRunがexpiredになる
- expired handleではtool mutationできない

### Worker

- 複数Workerが同じTaskを同時claimできない
- 異なるTaskは並列claimできる
- lease expiryで `doing -> todo` になる
- commentとassignment historyが残る
- 新Workerが旧commentを読める
- 新Worker自身の検証commentなしではcompleteできない
- 旧Workerの遅延completeがfencingで拒否される

### Reviewer

- 複数Reviewerが異なるTaskを並列取得できる
- 同じTaskのreview leaseは1件だけ
- review lease expiry後もTaskは `in_review`
- 次のReviewerが取得できる

### Protocol

- v2 requestはinitialize / Mcp-Session-Idなしで成功する
- requestを別server instanceへ送っても同じ結果になる
- `tools/list` がrunや呼び出し順序で変化しない
- mutation retryが二重状態遷移・二重commentを起こさない
- v1 legacy sessionが切れてもapplication stateに影響しない

### Ralph E2E

- Claude processの正常終了で未完了Taskが即releaseされる
- Ralph processを `kill -9` してもTTL後に再キューされる
- Worker / Reviewer Ralphを並列起動して競合しない
- Wacha再起動後に旧session掃除なしで次のrunが作業を取得できる

## 17. 実装優先順位

1. Agent Run / Assignment / fencing / idempotency
2. Worker lease expiryと再キュー
3. Reviewer Task leaseと複数Reviewer
4. screen-reader Ralph移行
5. persistent event / webhook
6. MCP v2 stateless adapter
7. legacy session / membership削除

MCP v2 adapterより先にapplication identityを分離する。これによりClaude Codeのprotocol対応を
待たず、現在発生しているstale membershipとTask引き継ぎ問題を解消できる。

## 18. 採用しない案

### clientInfoをAgent IDにする

一意性・認証・起動単位の保証がなく、複数Ralphの競合を防げないため採用しない。

### process再起動後も同じAgent Handleを渡す

今回の合意で、Ralph起動ごとに新Agentとするため採用しない。引き継ぎはTask comment、
artifact、event、assignment historyで行う。

### session closeで即解放する

close通知は保証されず、次期MCPにはsession自体がないため採用しない。

### ReviewerをProject単位で専有する

複数Taskのレビューを並列化できないため廃止する。同一TaskだけをReview Leaseで排他する。
