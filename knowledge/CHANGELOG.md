# Knowledge Changelog

## 目的

knowledge / skill への変更と、その根拠になった提案・事象を追跡できるようにする。

`propose-knowledge-update` で出た提案を `apply-knowledge-update` で採否判断した結果は、必ずここに 1 エントリ残す。採用だけでなく、見送りも残す。見送り理由が残っていれば、同じ提案が再発したときに再検討の材料になる。

## 書式

新しいものを上に追加する。

```md
## YYYY-MM-DD

- 種別: adopted | rejected | deferred
- 対象: 変更した（または見送った）ファイルのパス
- 内容: 何を変えたか / 何を提案されたか（1〜3 行）
- 根拠: 元になった task ID・レビュー指摘・事象への参照
- 見送り理由: rejected / deferred の場合のみ
```

---

## 2026-07-07

- 種別: adopted
- 対象: `knowledge/tips/verification.md`（新規）, `knowledge/tips/self-review.md`（新規）, `skill/implement-task.md`（v4）, `skill/review-task.md`（v3）
- 内容: 検証を「型チェック・ビルド通過」で止めず実挙動の確認まで求める基準と、`complete_task` 前のセルフレビュー工程を追加。reviewer 側のチェックリストにも検証の実質性の観点を追加。
- 根拠: モデル間で開発品質の差が大きく、弱い実行では「実装した内容から完了条件を逆算して読む」「検証をビルド通過で済ませる」「迷った判断をコメントに残さない」傾向が観測されたため。

- 種別: adopted
- 対象: `knowledge/CHANGELOG.md`（新規）, `skill/apply-knowledge-update.md`（新規）, `skill/propose-knowledge-update.md`（v2）
- 内容: knowledge 更新提案を実ファイルへ反映する manager 向け skill と、採否履歴を残す changelog を追加し、提案→反映→追跡のループを閉じた。
- 根拠: `propose-knowledge-update` が提案（task comment）止まりで、反映の担い手と手順が未定義だったため。
