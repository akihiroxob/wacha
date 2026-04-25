# Domain ガイド

## 既存の domain の実態

Wacha はすでに重要な domain primitive を定義しています。

- Project
- Story
- Task
- ProjectRole
- TaskStatus

これらが domain の中核であり、安定して維持されるべきです。

## 中核概念

### Project

story、task、role、artifact を束ねる単位です。

### Story

作業の意図と文脈を表します。

Story は manager が責任を持ちます。

### Task

worker が実行する単位です。

Task は次を満たすべきです。

- 小さい
- テスト可能
- review 可能

### TaskStatus

正規の lifecycle は次です。

```txt
todo -> doing -> in_review -> wait_accept -> accepted
                    ↓
                 rejected
```

### ProjectRole

責務と権限を定義します。

```txt
manager  -> planning + acceptance
reviewer -> technical validation
worker   -> execution
viewer   -> read-only
```

## Domain ルール

### ルール 1: 状態遷移は明示的である

`TaskStatus` を任意に書き換えてはいけません。

必ず定義済みの遷移を通すべきです。

### ルール 2: role が責務を決める

- worker は accept できない
- reviewer は最終確定できない
- manager が acceptance を持つ

### ルール 3: review は domain の一部である

Review は任意ではありません。

task は `in_review` になった時点ではまだ完了ではありません。

`accepted` になって初めて完了です。

### ルール 4: instruction は domain に駆動される

Instruction 配信は UI の都合ではありません。

role 実行の振る舞いの一部です。

## domain ではないもの

次のものは domain に置くべきではありません。

- MCP response format
- HTTP request handling
- SQLite query
- file 読み込み処理

## 設計目標

domain は小さく、厳密に保ちます。

複雑さは次へ押し出します。

- orchestration は use case
- 再利用可能な振る舞いは skill
- 実行境界は tool
