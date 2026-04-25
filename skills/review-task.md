# review-task

## Purpose
`in_review` の task を品質観点で検証し、受け入れ可能性を明確に判定する。

## Required Knowledge
- `knowledge/tips/reviewing.md`
- `knowledge/tips/task-writing.md`

## Allowed Roles
- reviewer
- manager

## Required Tools
- Wacha MCP: `list_tasks`, `list_task_comments`, `reviewed_task`, `reject_task`, `add_task_comment`
- 開発ツール: 差分確認、テスト実行、静的解析
- 参照用: リポジトリ内の `knowledge/` ドキュメント

## Steps
1. `list_tasks` で `in_review` task を特定し、対象の完了条件を確認する。
2. `list_task_comments` で実装者コメントと判断履歴を把握する。
3. `knowledge/tips/reviewing.md` の観点（正確性・保守性・安全性など）で差分を評価する。
4. `knowledge/tips/task-writing.md` を基準に、task の完了条件が充足しているか検証する。
5. 指摘がある場合は具体的な再現手順・期待挙動を添えて `add_task_comment` する。
6. 受け入れ可能なら `reviewed_task`、追加修正が必要なら理由付きで `reject_task` を実行する。

## Success Criteria
- 判定理由が第三者にも追跡可能な形で残っている。
- 指摘内容が実行可能で、修正方針が明確である。
- 受け入れ/差し戻しの判断が完了条件に整合している。

## Anti Patterns
- 個人の好みだけで判断し、task の完了条件と無関係な差し戻しを行う。
- 根拠や再現手順がない抽象的な指摘を残す。
- 実装内容を確認せずに機械的に `reviewed_task` を実行する。
