---
name: design-review
description: 今回の変更と無関係な設計上の問題を評価し、必要なら再設計の Story / Task を起こす。
status: active
version: 2
allowRoles: [manager]
requiredKnowledge:
  - principles/development-principles.md
  - tips/incremental-design.md
  - tips/story-splitting.md
requiredTools:
  - list_tasks
  - list_task_comments
  - list_stories
  - issue_story
  - issue_task
  - edit_task
  - cancel_task
---

# design-review

## Purpose

worker / reviewer が現在の Task の範囲外として記録した設計上の問題（`[design-strain]` Task と Task comment）を評価し、再設計するかを判断する。

現在の変更に必要な設計改善は、その Task で行う。範囲外の再設計については manager が根拠と優先順位を判断する。

## 実施タイミング

- Story を `complete_story` する時
- 同一領域に `[design-strain]` シグナルが 3 件たまった時
- worker から Task の範囲変更が提案された時

## Steps

1. `list_tasks` で `[design-strain]` の付いた task を収集し、対象領域ごとに束ねる。
2. 各シグナルの根拠（元 task、対象ファイル、観測事実）を `list_task_comments` で確認する。
3. 今回の要件との関係、変更困難の具体的な根拠、予定された変更を確認し、対応不要のシグナル Task は理由付きで `cancel_task` する。
4. 再設計するものは、スコープ・守るべき既存挙動・検証方法を明記した Story を `issue_story` で起こし、必要に応じて Task に分解する。
5. 現在の Task に必要な構造変更の提案は、要件と範囲を確認して Task の説明を調整する。独立した変更に分ける場合も、歪んだ中間状態を残さない順序を示す。
6. 採用したシグナルTaskも、作成したStoryまたはTaskを理由に含めて `cancel_task` し、二重着手を防ぐ。保留は `edit_task` で判断に必要な条件をdescriptionへ追記する。

## 採用基準

次を満たすシグナルだけを再設計 Story にする。

- 変更が困難になっている具体的な証拠がある（歪んだ差分の実例、reject の反復、行数の推移）
- 次に予定される変更がその領域に触れる
- 既存挙動をテストまたは確認手順で検証できる見込みがある

## Success Criteria

- 収集したシグナルが「Story 化 / 見送り / 保留」に分類され、放置されていない。
- 再設計 Story に、壊してはいけない挙動とテスト方針が書かれている。
- 見送り・保留の理由がシグナル元の task に返されている。

## Anti Patterns

- 美しさを理由に、変更困難の証拠がない再設計 Story を起こす。
- 必要な構造変更を一律に別 Task へ先送りする。
- シグナルを溜めたまま判断せず、worker が歪んだ最小差分を積み続ける状態を放置する。
- 現在の Task と無関係な再設計を worker の判断だけで進める。
