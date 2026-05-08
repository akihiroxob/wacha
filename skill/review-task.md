---
name: review-task
description: in_review の task を、完了条件・既存構成・設計原則・変更範囲の観点で検証し、受け入れ可能性を明確に判定する。
status: active
version: 2
allowRoles: [reviewer, manager]
requiredKnowledge:
  - principles/development-principles.md
  - principles/ai-native-ddd.md
  - principles/frontend-architecture.md
  - tips/reviewing.md
  - tips/task-writing.md
requiredTools:
  - list_tasks
  - list_task_comments
  - add_task_comment
  - reviewed_task
  - reject_task
---

# review-task

## Purpose

`in_review` の task を、完了条件・既存構成・設計原則・変更範囲の観点で検証し、受け入れ可能性を明確に判定する。

reviewer は「好み」で見るのではなく、この task を通したあとに保守・再利用・テスト・次回作業が壊れないかを判定する。

## Steps

1. `list_tasks` で `in_review` task を特定し、対象の完了条件を確認する。
2. `list_task_comments` で実装者コメント、FileChangePlan、判断履歴、検証結果を把握する。
3. `knowledge/tips/reviewing.md` の観点で差分を評価する。
4. `knowledge/tips/task-writing.md` を基準に、task の完了条件が充足しているか検証する。
5. `knowledge/principles/development-principles.md` を基準に、変更範囲・最小差分・新規ファイル作成の妥当性を確認する。
6. `knowledge/principles/ai-native-ddd.md` を基準に、責務境界と依存方向を確認する。
7. フロントエンド変更がある場合は、`knowledge/principles/frontend-architecture.md` を基準に構成を確認する。
8. 指摘がある場合は、具体的な不足・危険性・再レビュー条件を添えて `add_task_comment` する。
9. 受け入れ可能なら `reviewed_task`、追加修正が必要なら理由付きで `reject_task` を実行する。

## Review Checklist

- task の完了条件を満たしているか。
- 実装者の FileChangePlan と実際の変更範囲が一致しているか。
- 既存構成に従っているか。
- 不要な新規ファイル・新規ディレクトリが増えていないか。
- 新規ファイルの理由と配置根拠が説明されているか。
- Clean Architecture / DDD / SOLID が、不要な抽象化やファイル増加の口実になっていないか。
- domain / application / infrastructure / mcp / presentation の責務が混ざっていないか。
- フロントエンド変更の場合、Bulletproof React ベースの構成に沿っているか。
- 最小差分になっているか。
- テストまたは確認手順が残っているか。
- 既存挙動を壊していないか。

## Reject Conditions

以下の場合は差し戻す。

- task の完了条件を満たしていない。
- 検証結果または確認手順がない。
- 理由のない新規ファイル・新規ディレクトリがある。
- 1 task の範囲を超えた再構成や大規模リファクタリングが含まれている。
- 既存構成を無視した独自構成が追加されている。
- 責務境界や依存方向が崩れている。
- reviewer が追加調査しないと判断できないほど、変更理由が不足している。

## Success Criteria

- 判定理由が第三者にも追跡可能な形で残っている。
- 指摘内容が実行可能で、修正方針が明確である。
- 受け入れ/差し戻しの判断が完了条件に整合している。
- 構成・責務・変更範囲に関する懸念が残っていない。

## Anti Patterns

- 個人の好みだけで判断し、task の完了条件と無関係な差し戻しを行う。
- 根拠や再現手順がない抽象的な指摘を残す。
- 実装内容を確認せずに機械的に `reviewed_task` を実行する。
- 不要な新規ファイルや構成崩れを「動いているから」で通す。
- reviewer が実装者にならないと終わらない指摘を出す。
