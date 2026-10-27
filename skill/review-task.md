---
name: review-task
description: in_review の task を、完了条件・既存構成・設計原則・変更範囲の観点で検証し、受け入れ可能性を明確に判定する。
status: active
version: 9
allowRoles: [reviewer]
requiredKnowledge:
  - tips/github-workflow.md
  - principles/project-defaults.md
  - principles/development-principles.md
  - principles/ai-native-ddd.md
  - principles/frontend-architecture.md
  - tips/frontend-quality-gates.md
  - tips/reviewing.md
  - tips/task-writing.md
  - tips/verification.md
  - tips/incremental-design.md
requiredTools:
  - list_task_pull_requests
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

## GitHub Workflow

Projectに `workflow` が設定されている場合は `knowledge/tips/github-workflow.md` のPR・SHA・CI・受入条件に従う。RalphがTask/Claimを取得済みなら再取得せず、実装・評価・根拠を指定の結果ファイルへ返す。Git/GitHub操作とWachaの状態遷移はRalphが実行する。未連携ProjectまたはAgentが直接MCPを操作する実行では、以下の手順を用いる。

## Steps

1. `list_tasks` の `availableFor: "review"` で対象を選び、`claim_review` でReview Claimを取得する。
2. `list_task_comments` で Markdown 前提の実装者コメント、FileChangePlan、判断履歴、検証結果を把握する。
3. 対象 Project の `AGENTS.md`・設計資料・既存構成を確認し、`knowledge/principles/project-defaults.md` の適用範囲と優先関係に従う。
4. `knowledge/tips/reviewing.md` の観点で差分を評価する。
5. `knowledge/tips/task-writing.md` を基準に、対象 head SHA でGivenを用意して完了条件を検証できるか確認する。差し戻し条件を追加する前も同じ確認を行う。後続機能への依存やACの割当不整合は製品不具合と区別してManagerへ返し、統合条件を独断で追加しない。
6. `knowledge/principles/development-principles.md` を基準に、変更後の全体的な整合性・変更範囲・新規ファイル作成の妥当性を確認する。
7. `knowledge/principles/ai-native-ddd.md` を基準に、対象 Project の責務境界と依存方向を確認する。
8. React のフロントエンド変更がある場合は、`knowledge/principles/frontend-architecture.md` を基準に構成を確認する。
9. 指摘がある場合は、具体的な不足・危険性・再レビュー条件を添えて Markdown 形式の `add_task_comment` をする。
10. 今回の変更に関連する設計の不整合は差し戻して解消を求める。無関係な問題は、`[design-strain]` を title 先頭に付け、発見元 Task と完了条件を記載した技術的 follow-up を `issue_task` で登録する。
11. 受け入れ可能なら同じClaimで `reviewed_task`、追加修正が必要なら理由付きで `reject_task` を実行する。判定せず中断する場合は `release_claim` する。

## UI変更の承認条件

UI方針・トークン・製品部品・カタログの整合を確認し、重複した見本専用実装を認めない。変更した状態例の描画・操作・buildと、製品画面への影響を確認する。

React UIの変更では `tips/frontend-quality-gates.md` に従い、構造検査を対象SHAで実行し、依存方向・公開入口・基本部品の利用と例外を差分で確認する。ファイルを移しただけ、CSS classだけを共有、型チェックだけのlint、全違反の一括除外では成立しない。共通部品とトークンの変更は利用画面への影響を確認する。変更で生じた・関連する違反は修正を求める。必須検査が未実施なら承認せず、実装の不足と環境・前提整備の不足を区別して返す。

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

計画修正または環境復旧が必要で判定できない場合は、原因・必要な判断・再開条件をManagerへ返す。直接実行では理由付きでClaimを解放し、Ralph経由では実行契約に従って結果を返す。同じ前提のまま差し戻しを繰り返さない。

以下の場合は差し戻す。

- 実行可能な現在の完了条件に対して実装が不足している。未成立の依存・ACの割当不整合・検証環境だけを根拠に製品不具合と断定しない。
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
