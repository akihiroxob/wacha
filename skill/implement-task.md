---
name: implement-task
description: 割り当てられた task を、既存構成・設計原則・実装品質を守りながらレビュー可能な状態まで実装する。
status: active
version: 10
allowRoles: [worker]
requiredKnowledge:
  - tips/github-workflow.md
  - principles/project-defaults.md
  - principles/development-principles.md
  - principles/ai-native-ddd.md
  - principles/frontend-architecture.md
  - tips/frontend-quality-gates.md
  - tips/task-writing.md
  - tips/verification.md
  - tips/self-review.md
  - tips/incremental-design.md
requiredTools:
  - register_task_pull_request
  - list_task_pull_requests
  - list_tasks
  - claim_task
  - add_task_comment
  - complete_task
  - release_claim
  - issue_task
---

# implement-task

## Purpose

割り当てられた task を、既存構成・設計原則・実装品質を守りながらレビュー可能な状態まで実装する。

この Skill の目的は、要件を満たす変更のたびに関連領域の設計を整え、後続の reviewer / manager が判断できる実装と記録を残すことである。

## GitHub Workflow

Projectに `workflow` が設定されている場合は `knowledge/tips/github-workflow.md` のPR・SHA・CI・受入条件に従う。RalphがTask/Claimを取得済みなら再取得せず、実装・評価・根拠を指定の結果ファイルへ返す。Git/GitHub操作とWachaの状態遷移はRalphが実行する。未連携ProjectまたはAgentが直接MCPを操作する実行では、以下の手順を用いる。

## Steps

1. `list_tasks` で対象 Task と本文に示された依存 Task の最新状態を確認する。必要な到達状態が未成立なら選択せず、前提と再選択条件をManagerへ返す。候補表示や `sortOrder` を依存成立の証拠にしない。前提が成立していれば `claim_task` で担当を確定する。
2. Task の完了条件を `knowledge/tips/task-writing.md` に照らし、Givenの準備と対象 revision での検証が成立するか再確認する。後続機能への未成立の依存やACの割当不整合があれば、要件を独断で変更せずManagerへ返す。取得済みClaimで中断する場合は直接実行では理由付きで解放し、Ralph経由では根拠と再開条件を結果ファイルへ返す。
3. 対象 Project の `AGENTS.md`・設計資料・既存構成を確認し、`knowledge/principles/project-defaults.md` の適用範囲と優先関係に従う。
4. `knowledge/principles/development-principles.md` を読み、変更範囲・全体の整合性・新規ファイルの判断基準を確認する。
5. `knowledge/principles/ai-native-ddd.md` を読み、対象 Project に適用される責務境界を確認する。
6. React のフロントエンドを変更する場合は、`knowledge/principles/frontend-architecture.md` を確認する。
7. 既存の類似ファイル・類似ディレクトリ・類似コンポーネントを探し、再利用可否を判断する。
8. フロントエンドを変更する場合は、Project の実際の配置先にある類似画面・類似要素を探索する。
9. 実装前に FileChangePlan を作成し、再利用候補・採用可否・採用しない理由を必ず残す。非自明な変更では Markdown 形式の `add_task_comment` で共有する。
10. FileChangePlan で関連領域の責務・重複・利用箇所を確認する。必要な構造変更を計画に含め、Task の明示範囲を超える場合は manager に調整を提案する。
11. FileChangePlan に沿って、変更後の全体的な整合性を保ちながら実装・テスト・リファクタリングを行う。
12. `knowledge/tips/verification.md` に従って検証を行い、実行内容と実際の結果を確認する。
13. `knowledge/tips/self-review.md` に従い、`complete_task` の前に reviewer の視点で自分の差分をセルフレビューする。
14. 実施内容・判断理由・再利用判断・検証結果・セルフレビューで気づいた点・未解決事項を Markdown 形式の `add_task_comment` で共有する。
15. レビュー可能と判断したら `complete_task` で `in_review` に進める。

## FileChangePlan

実装前に、少なくとも次を整理する。

```txt
変更目的:
- この task で達成すること

編集予定ファイル:
- path:
  理由:

再利用候補:
- path:
  採用可否:
  採用しない理由:

新規作成予定ファイル:
- path:
  理由:
  既存ファイルで代替できない理由:

触らない範囲:
- この task では変更しない領域

検証方法:
- 実行するテスト、または確認手順

全体への影響:
- 関連する責務、重複、UI の利用箇所と、変更後の整合性
```

## Implementation Rules

- 既存ファイルの再利用を検討し、責務に合わない場合は構造も改める。
- 既存コンポーネントや既存ファイルを探した結果は、再利用する場合も新規作成する場合も記録する。
- 新規ファイル・新規ディレクトリは、変更後の責務と再利用性に必要な範囲で作る。
- 新規ファイルを作る場合は、理由と配置根拠を説明できる状態にする。
- 新規ファイルや新規 component を作る場合は、既存ファイルで代替できない理由を明示する。
- フロントエンドでは Project の実際の配置先にある類似実装を探索せずに新規 UI を作らない。
- 同種 UI がある場合は共通化可否を判断する。新規 UI もコンポーネント化の必要性を実装前に検討する。
- 新規 React UI では、Project の指定や既存の一貫した構成がない場合、SCSS と共有デザイントークンを用いる。
- 複数ファイルにまたがる変更では、実装前に `add_task_comment` で FileChangePlan を共有する。
- コメント本文は Markdown 前提で書いてよいが、厳密な Markdown 構文検証に合わせる必要はない。
- 要件の実現に必要なアーキテクチャ再構成・大規模リファクタリングは、根拠、影響範囲、検証方法を明確にして行う。
- 構成に迷った場合は、既存の配置と変更後の責務を比較して判断する。
- 判断できない場合は推測で進めず、前提・選択肢・懸念をコメントして確認する。
- `issue_task` は作業中に発見した技術的follow-upに限る。ユーザー要件やStoryの拡張、優先順位変更はmanagerへ返す。
- 今回の要件と無関係な技術的 follow-up には発見元 Task、必要な理由、完了条件を記載する。
- 不自然な分岐、責務違いの配置、同じ修正の複数コピーが必要なら、関連する構造を整えてから完了する。
- 今回の Task と無関係な設計の問題は、`[design-strain]` を付けた単発 Task として根拠を記録する。

## UI変更の完了条件

部品の変更に合わせて実装と同じソースを使うカタログの状態例・使用方法を更新し、製品画面への適用と両方を検証する。未整備ならfrontend-architecture.mdの小さなデザインシステムに従い、必要な導入範囲を計画する。

React UIの変更では `tips/frontend-quality-gates.md` に従い、Projectの配置・依存方向・部品・検査コマンドを特定して計画に残す。共通基本部品とSCSSトークンを利用し、外側の配置は親layoutで扱う。検査がなければ関連領域の検査を導入し、大きな前提整備が必要ならManagerへ分割を返す。構造検査・関連テスト・型チェック・実画面の確認結果を残す。CIがないことを省略理由にしない。必須検査を実行できない場合は原因・未検証・再開条件を返し、検証済みの完了としない。

## Success Criteria

- task の完了条件を満たす実装と検証結果が揃っている。
- `complete_task` 前にセルフレビューを行い、気づいた懸念がコメントに残っている、または解消されている。
- 変更理由・トレードオフ・確認手順がコメントで追跡できる。
- 新規ファイルや新規ディレクトリを作った場合、その必要性が説明されている。
- 既存探索の結果と、再利用する / しない判断理由がコメントまたは FileChangePlan で追跡できる。
- 既存構成・依存方向・命名規則に沿っている。
- reviewer が追加調査なしで確認を開始できる。

## Anti Patterns

- task を `claim` せずに作業を始め、担当状態が不整合になる。
- 完了条件を満たしていないのに `complete_task` へ進める。
- セルフレビューをせず、または型チェック/ビルド通過だけを検証扱いにして `complete_task` へ進める。
- 構造と喧嘩していると気づきながら、歪んだ最小差分を黙って積む。
- 今回の要件と無関係な構造を根拠なく変更する。
- 原則を無視して場当たり的に実装し、責務が崩壊する。
- 既存構成を確認せずに独自のディレクトリやファイル構成を作る。
- 再利用候補を調べた記録を残さずに、新規 component や新規ファイルを作る。
- Clean Architecture / DDD を理由に、不要な抽象・層・ファイルを増やす。
- フロントエンドで既存 feature を確認せず、新しい feature や共通コンポーネントを作る。
