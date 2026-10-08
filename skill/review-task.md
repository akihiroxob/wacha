---
name: review-task
description: in_review の task を、完了条件・既存構成・設計原則・変更範囲の観点で検証し、受け入れ可能性を明確に判定する。
status: active
version: 6
allowRoles: [reviewer]
requiredKnowledge:
  - principles/project-defaults.md
  - principles/development-principles.md
  - principles/ai-native-ddd.md
  - principles/frontend-architecture.md
  - tips/reviewing.md
  - tips/task-writing.md
  - tips/verification.md
  - tips/incremental-design.md
requiredTools:
  - list_tasks
  - list_task_comments
  - claim_review
  - release_claim
  - add_task_comment
  - reviewed_task
  - reject_task
  - issue_task
---

# review-task

## Purpose

`in_review` の task を、完了条件・既存構成・設計原則・変更範囲の観点で検証し、受け入れ可能性を明確に判定する。

reviewer は「好み」で見るのではなく、この task を通したあとに保守・再利用・テスト・次回作業が壊れないかを判定する。

## Steps

1. `list_tasks` の `availableFor: "review"` で対象を選び、`claim_review` でReview Claimを取得する。
2. `list_task_comments` で Markdown 前提の実装者コメント、FileChangePlan、判断履歴、検証結果を把握する。
3. 対象 Project の `AGENTS.md`・設計資料・既存構成を確認し、`knowledge/principles/project-defaults.md` の適用範囲と優先関係に従う。
4. `knowledge/tips/reviewing.md` の観点で差分を評価する。
5. `knowledge/tips/task-writing.md` を基準に、task の完了条件が充足しているか検証する。
6. `knowledge/principles/development-principles.md` を基準に、変更後の全体的な整合性・変更範囲・新規ファイル作成の妥当性を確認する。
7. `knowledge/principles/ai-native-ddd.md` を基準に、対象 Project の責務境界と依存方向を確認する。
8. React のフロントエンド変更がある場合は、`knowledge/principles/frontend-architecture.md` を基準に構成を確認する。
9. 指摘がある場合は、具体的な不足・危険性・再レビュー条件を添えて Markdown 形式の `add_task_comment` をする。
10. 今回の変更に関連する設計の不整合は差し戻して解消を求める。無関係な問題は、`[design-strain]` を title 先頭に付け、発見元 Task と完了条件を記載した技術的 follow-up を `issue_task` で登録する。
11. 受け入れ可能なら同じClaimで `reviewed_task`、追加修正が必要なら理由付きで `reject_task` を実行する。判定せず中断する場合は `release_claim` する。

## Review Checklist

- task の完了条件を満たしているか。
- 実装者の FileChangePlan と実際の変更範囲が一致しているか。
- 既存構成に従っているか。
- 不要な新規ファイル・新規ディレクトリが増えていないか。
- 新規ファイルの理由と配置根拠が説明されているか。
- Clean Architecture / DDD / SOLID が、不要な抽象化やファイル増加の口実になっていないか。
- 対象 Project に適用される責務境界と依存方向が崩れていないか。
- React のフロントエンド変更の場合、Project の方針、または未指定なら Bulletproof React を参考にした推奨構成に沿っているか。
- 関連する責務、重複、UI の利用箇所が変更後も整合しているか。
- UI 変更では既存コンポーネントの利用判断と、Project の方針・既存構成に応じたスタイルとデザイントークンの扱いが適切か。
- テストまたは確認手順が残っているか。
- 検証結果が「型チェック・ビルド通過」で止まらず、実際の挙動確認になっているか（`tips/verification.md`）。
- 既存挙動を壊していないか。

## Reject Conditions

以下の場合は差し戻す。

- task の完了条件を満たしていない。
- 検証結果または確認手順がない。
- 理由のない新規ファイル・新規ディレクトリがある。
- 再構成の目的・影響範囲・検証が示されていない、または Task の明示範囲を超えている。
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
- 今回の変更で生じた設計の不整合を、別 Task に先送りして受け入れる。
- 気づいた軋みを記録せず流し、負債の観測データが残らない。
- 根拠や再現手順がない抽象的な指摘を残す。
- 実装内容を確認せずに機械的に `reviewed_task` を実行する。
- 不要な新規ファイルや構成崩れを「動いているから」で通す。
- reviewer が実装者にならないと終わらない指摘を出す。
