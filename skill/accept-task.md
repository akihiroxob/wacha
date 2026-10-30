---
name: accept-task
description: manager が Task の成果を要件と Project 全体の整合性に照らして最終受入し、Accept または Reject を判断する。
status: active
version: 7
allowRoles: [manager]
requiredKnowledge:
  - principles/frontend-architecture.md
  - tips/frontend-quality-gates.md
  - tips/github-workflow.md
  - tips/acceptance.md
  - tips/task-writing.md
  - tips/verification.md
requiredTools:
  - list_task_pull_requests
  - list_stories
  - list_tasks
  - list_task_comments
  - list_changes
  - claim_acceptance
  - renew_claim
  - release_claim
  - add_task_comment
  - accept_task
  - reject_task
  - edit_story
  - edit_task
  - issue_task
---

# accept-task

## Purpose

Task 単体の完了報告だけでなく、人と合意した要求、親 Story、Project の正本資料、実際の成果を照合し、最終受入を判断する。

reviewer の実装レビューを追認するのではなく、「この成果を製品へ取り込んでよいか」を manager の責務として独立に判定する。

## GitHub Workflow

Projectに `workflow` が設定されている場合は `knowledge/tips/github-workflow.md` のPR・SHA・CI・受入条件に従う。RalphがTask/Claimを取得済みなら再取得せず、実装・評価・根拠を指定の結果ファイルへ返す。Git/GitHub操作とWachaの状態遷移はRalphが実行する。未連携ProjectまたはAgentが直接MCPを操作する実行では、以下の手順を用いる。

## Steps

1. `list_stories` と `list_tasks` で候補・前提Taskの現在状態を確認する。受入に必要な状態を作る先行Taskを特定し、依存が成立した候補から選ぶ。未受入・差し戻し中の前提を優先し、依存待ちのTaskは保留して他の受入可能な候補を選ぶ。Story / Taskの優先順位もGivenを準備できる順に照合する。
2. 親 Story、最新のTask本文、worker / reviewer コメント、関連する Change Log、PR履歴と対象SHAを確認する。過去の差し戻しコメントは証跡として保持し、現在の受入条件と区別する。
3. Project の `AGENTS.md` と主要設計資料を確認し、`knowledge/tips/task-writing.md` に従ってACの所有・Givenの準備・依存・対象 revision を照合する。
4. 検証できない場合は `knowledge/tips/acceptance.md` の分類に従い、製品不具合・検証環境・未成立の依存・ACの割当不整合・人の判断待ちを区別する。許可された計画修正は要件を保持して行い、移動先への保存と追跡を確認する。同じ状態のまま再試行しない。
5. 一意な `requestId` で `claim_acceptance` を呼び、`claimId` を保持する。計画修正後は現在のTask・Claim・PR状態を再確認する。
6. `knowledge/tips/acceptance.md` に従い、Task の充足とシステム全体の整合性を分けて検証する。UI条件は実ブラウザで独立に確認する。Givenを準備できない場合は、先にStoryの分割・優先順位・Task依存・対象SHAを確認する。先行機能を待っても通常操作では作れない表示・参照の状態に限り、Projectで実行を許可した検証データ準備手順を使う。管理操作・保存・認可が対象のACは、その公開操作を実行して確認する。既存のManager証拠が対象Task・SHA・環境・データ・現在のACと一致する場合は照合して再利用し、不足だけを検証する。見た目の条件は保存画像も実際に確認する。
7. 判断根拠、証拠、未検証範囲と理由を整理する。直接実行では必要に応じて `add_task_comment` を使い、計画修正の前後・移動先Task ID・条件の保存を記録する。
8. 両方を満たす場合だけ `accept_task` を呼ぶ。製品の不足は、期待との差分と実行可能な再受入条件を付けて `reject_task` を呼ぶ。計画・環境・依存が未解決で判定できない場合は、原因と再開条件を残して `release_claim` する。

## UI変更の受入条件

部品カタログと製品の表示が同じ実装・トークンであることを確認し、採用したムードボード/プロトタイプの視覚方向と製品画面を比較する。カタログの表示成功だけで画面適用済みとしない。

React UIの受入では `tips/frontend-quality-gates.md` に従い、ProjectのPolicy・構造検査結果と、対象SHAの実ブラウザの観測を照合する。Desktop・狭い画面の保存画像を実際に見て、操作、変更に関係する状態、文字切れ、余白、折返し、親layoutによる部品の伸張を確認する。同じsize契約は必要に応じて寸法を測り、異なる用途・sizeを同一寸法にはしない。ページが開けることだけで見た目を受け入れない。必須確認が未実施ならAcceptせず、自身で実施可能な残りを続行する。未確認項目があるだけで保留にせず、続行不能な外部阻害が残る場合に限り、試した操作・観測結果・再開に必要な変化を返す。確認済み証拠の再利用は対象Task・SHA・環境・データ・現在のACとの一致を確認する。

## Success Criteria

- Accept / Reject の判断が、Task、親 Story、Project の正本資料、実際の成果から追跡できる。
- テスト成功、Reviewer 承認、模擬実行のいずれか一つだけを根拠に Accept していない。
- UIの完了条件について、対象の成果物とブラウザでの観測結果を照合でき、必須の確認が未検証のままAcceptしていない。
- Reject の場合、修正すべき差分と再受入条件が実行可能な形で示されている。

## Anti Patterns

- Reviewer が通したことだけを理由に Accept する。
- Task の局所的な完了条件だけを見て、親 Story や Project 全体との矛盾を見落とす。
- Project 固有の責務や用語を推測し、正本資料を確認せずに判定する。
- 「後続 Task で直す予定」という未確定な説明だけで、現在の不整合を許容する。
- 具体的な外部阻害や実行基盤の上限で続行できない状態のまま、Claimを保持し続ける。
- 実施可能な検証の残りを外部阻害と扱い、代表画面だけ確認して保留する。

- 後続commitを先行 Task の受入SHAへ置き換える。
- 過去の `blocked` を、現在のAC・証拠・Claimを確認せずAcceptへ書き換える。
