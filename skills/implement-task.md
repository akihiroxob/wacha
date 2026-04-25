# implement-task

## Purpose
割り当てられた task を、設計原則と実装品質を満たしながらレビュー可能な状態まで実装する。

## Required Knowledge
- `knowledge/principles/development-principles.md`
- `knowledge/principles/ai-native-ddd.md`
- `knowledge/tips/task-writing.md`

## Allowed Roles
- worker

## Required Tools
- Wacha MCP: `claim_task`, `list_tasks`, `add_task_comment`, `complete_task`
- 開発ツール: エディタ、テストコマンド、静的解析
- 参照用: リポジトリ内の `knowledge/` ドキュメント

## Steps
1. `list_tasks` で対象 task の最新状態を確認し、`claim_task` で担当を確定する。
2. task の完了条件を `knowledge/tips/task-writing.md` に照らして再確認する。
3. `knowledge/principles/development-principles.md` に沿って変更方針と受け入れ観点を決める。
4. 必要に応じて `knowledge/principles/ai-native-ddd.md` を参照し、ドメイン境界と責務配置を確認する。
5. 実装・テスト・リファクタリングを行い、task の完了条件を満たす。
6. 実施内容・判断理由・未解決事項を `add_task_comment` で共有する。
7. レビュー可能と判断したら `complete_task` で `in_review` に進める。

## Success Criteria
- task の完了条件を満たす実装と検証結果が揃っている。
- 変更理由・トレードオフ・確認手順がコメントで追跡できる。
- レビュー担当者が追加調査なしで確認を開始できる。

## Anti Patterns
- task を claim せずに作業を始め、担当状態が不整合になる。
- 完了条件を満たしていないのに `complete_task` へ進める。
- 原則を無視して場当たり的に実装し、責務が崩壊する。
