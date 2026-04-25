# Review Policy

## 位置づけ

Review は Wacha における第一級の workflow です。

これは `TaskStatus` の遷移として表現されます。

- `in_review`
- `wait_accept`
- `accepted`
- `rejected`

## Review における role

- worker: 実装を作る
- reviewer: 実装を検証する
- manager: 最終受入を行う

## Review 段階

### Stage 1: Worker

- task を `in_review` に進める

### Stage 2: Reviewer

- 実装を検証する
- `wait_accept` または `rejected` に進める

### Stage 3: Manager

- 最終的に `accepted` または `rejected` を判断する

## Review 観点

### Correctness

- task の意図を満たしているか

### Safety

- 既存の振る舞いを壊していないか

### Completeness

- acceptance criteria をすべて満たしているか

### Clarity

- code が理解しやすいか

## Reject ルール

Reject には次を含めるべきです。

- 何が問題か
- なぜ重要か
- 何を直すべきか

## Anti-Patterns

- 未完成の作業を通すこと
- reviewer が全面的に実装を引き取ること
- manager が review 段階を飛ばすこと

## Feedback Loop

重要な考え方:

```txt
Review -> Skill improvement
```

同じ種類の指摘が繰り返されるなら、Skill 定義へ反映すべきです。

## 最終原則

Review は任意ではありません。

task は acceptance 後にのみ完了です。
