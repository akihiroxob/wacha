---
name: decompose-story
description: Story を、実装・レビュー・受け入れまで進めやすい独立した task 群に分解する。
status: active
version: 4
allowRoles: [manager]
requiredKnowledge:
  - tips/story-splitting.md
  - tips/task-writing.md
requiredTools:
  - list_stories
  - list_tasks
  - issue_task
  - edit_task
  - issue_story
  - edit_story
---

# decompose-story

## Purpose

Story を、実装・レビュー・受け入れまで進めやすい独立した task 群に分解する。

## Steps

1. 対象 Story の目的・完了条件・制約を整理し、`list_stories`・`list_tasks` で既存の成果と割当を確認する。
2. `knowledge/tips/story-splitting.md` に従い、独立に検証できる成果単位を決める。別々の成果なら Story を分け、同じ Story に置く場合は各 Task の受入境界と統合条件の所有 Task を明記する。
3. 各 Task を `knowledge/tips/task-writing.md` の形式で記述する。ACごとに所有 Task、Given の準備操作、利用可能時点、観測方法、対象 revision、依存 Task ID・必要状態、環境制約を確認する。
4. 自身の受入に後続 Task が必要なら、順序変更・縦切りへの統合・ACの割当変更で実行可能にする。共通基盤も、その Task で観測できる結果を完了条件にする。
5. 必要な Story / Task を `issue_story`・`issue_task` で登録し、`edit_story`・`edit_task` で実際の ID と受入境界を反映する。移したACは移動先へ先に保存してから移動元を更新し、未割当・重複・循環を確認する。
6. 依存 Task ID、実装・受入のどちらを待つか、再選択条件を本文に明示する。`sortOrder` は選択材料であり依存を強制しない。サーバーに依存制御がない間は、候補に現れても前提未成立の Task を選択しないよう引き継ぐ。
7. 起票後・差し戻しでACを変更した後も、Given の成立と要件の割当を再確認する。未成立の依存が変わらないまま同じ計画を再試行しない。

## Success Criteria

- Story の完了に必要な task が過不足なく列挙されている。
- 各 Task が明示した先行条件の成立後、自身の対象 revision で実装・検証・受入できる。
- 重複 task がなく、依存関係が説明可能である。

## Anti Patterns

- レイヤ別（DB 実装だけ、UI 実装だけ）に分割して価値提供が見えない task を作る。
- 「調査する」「対応する」など完了条件が曖昧な task 名・説明にする。
- 既存 task を確認せず同じ内容を再発行する。

- Task の件数やレイヤ数を固定し、後続機能なしでは検証できないACを先行 Task に置く。
- Task番号・`sortOrder` を依存制御とみなす。
