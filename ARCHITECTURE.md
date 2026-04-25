# Wacha アーキテクチャ

## 位置づけ

Wacha は、人からの依頼と AI agent を MCP を通じて調整するためのタスクオーケストレーション基盤です。

単なる tool server ではありません。project、story、task、role、review、instruction 配信の workflow 自体を責務として持ちます。

## 中核原則: AI-Native DDD

Wacha は AI-Native DDD を採用します。

これは次を意味します。

- domain 概念が明示されている
- use case が変更の主単位である
- agent は role ごとの instruction を受け取る
- MCP tool は制御された操作だけを公開する
- review は後付けではなく workflow の一部である

## 現在のアーキテクチャ契約

Wacha にはすでに重要な境界があります。

- `AGENTS.md` は agent が MCP server をどう使うべきかを説明する
- `agent/role-policy.md` は role ごとの責務と tool 権限を定義する
- `agent/manager.md`, `agent/reviewer.md`, `agent/worker.md` は role 固有の振る舞いを定義する
- `get_role_instructions` は role ごとの instruction file を返す
- `TaskStatus` は review workflow を表す: `todo`, `doing`, `in_review`, `wait_accept`, `accepted`, `rejected`

これらの file と概念は、運用の基盤として維持されるべきです。

## 推奨レイヤ構成

```txt
src/
  constants/          # ProjectRole や TaskStatus などの共有定数
  domain/
    model/            # domain model
    repository/       # repository interface
    service/          # domain service
    policy/           # 純粋な意思決定ルール

  application/
    usecase/          # 1 use case = 1 application action
    service/          # InstructionService のような orchestration service

  infrastructure/
    database/         # schema と DB 初期化
    repository/       # repository の実装
    filesystem/       # instruction / skill の file 読み込み

  mcp/
    tool/             # MCP tool adapter
    middleware/       # guard と role check
    utils/            # MCP response helper

  presentation/       # Hono route, controller, SSR view
```

## 依存方向

```txt
presentation / mcp
        ↓
application
        ↓
domain
        ↑
infrastructure
```

ルール:

- domain は MCP, Hono, SQLite, filesystem, Codex に依存してはいけない
- application は domain interface に依存してよい
- infrastructure は具体的な persistence と I/O を実装する
- MCP tool は use case または application service を呼ぶ薄い adapter であるべき

## UseCase 方針

UseCase は 1 つの意図的な action を表します。

良い例:

- `AssignProjectRoleUseCase`
- `IssueStoryUseCase`
- `IssueTaskUseCase`
- `ClaimTaskUseCase`
- `CompleteTaskUseCase`
- `ReviewedTaskUseCase`
- `AcceptTaskUseCase`
- `RejectTaskUseCase`

避けるべき例:

- 何でもやる `TaskService`
- 無関係な workflow まで抱え込む `ProjectService`
- role, task, instruction の責務を混ぜる `AgentService`

## MCP Tool 方針

MCP tool は外部公開される操作境界です。

やるべきこと:

- 入力を validate する
- 必要に応じて role 権限を確認する
- 1 つの use case または application service を呼ぶ
- 機械可読な明確な結果を返す

やってはいけないこと:

- 大きな domain logic を持つこと
- 複雑な状態遷移ルールを直接書くこと
- review や role policy を迂回すること

## Role 方針

Role は単なる permission ではありません。

```txt
Role = permission + responsibility + instruction
```

正規の role は次です。

- `manager`
- `reviewer`
- `worker`
- `viewer`

role の振る舞いは `agent/` 配下で定義します。

## Instruction 方針

Instruction は agent が暗黙に知っている前提ではなく、Wacha から配信されるべきです。

現在の `get_role_instructions` 方式は正しいです。

推奨される shared instruction 群:

- `agent/role-policy.md`
- `DOMAIN.md`
- `REVIEW_POLICY.md`
- `SKILL_GUIDE.md`

推奨される role-specific instruction 群:

- `agent/manager.md`
- `agent/reviewer.md`
- `agent/worker.md`
- `viewer` を有効化する場合の `agent/viewer.md`

## Review 方針

Review は domain workflow の一部です。

意図する flow は次です。

```txt
todo -> doing -> in_review -> wait_accept -> accepted
                    ↓
                 rejected
```

- `worker` は task を `in_review` に進める
- `reviewer` は review 済み task を `wait_accept` に進める
- `manager` は最終的な `accepted` / `rejected` を判断する

## Skill 方針

Skill は、agent が再利用可能な形で作業するための operating procedure です。

Skill は role でも task でもありません。

```txt
Task  = 何をやるべきか
Role  = 誰が責任を持つか
Skill = agent が再利用可能な操作をどう実行するか
Tool  = MCP で公開される実行可能な操作
```

Skill はまず Markdown や JSON の artifact として管理し、安定してから MCP tool として公開するのがよいです。

## 設計ルール

どこに置くべきか迷ったら、次で判定します。

- business concept か? -> domain
- 1 つの application action か? -> `application/usecase`
- I/O や persistence か? -> infrastructure
- 外部から呼ばれる操作か? -> `mcp/tool`
- agent への行動指針か? -> agent 文書または skill 文書
