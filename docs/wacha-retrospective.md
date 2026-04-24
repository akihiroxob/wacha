# Wacha Retrospective

## Pros

- Task が小さく明確で、着手判断が速い。
- `todo / doing / in_review / rejected` が分かれていて、現在地が見えやすい。
- `rejectReason` が具体的で、修正方針へ落とし込みやすい。
- Story 単位で要件を持ちながら Task 単位で進められるので、実装順を保ちやすい。
- 「まず一歩進める」運用に向いていて、止まりにくい。

## Cons

- 関連する `rejected` が複数 Task にまたがると、実質 1 つの修正でもステータス更新が分散する。
- 仕様上は別 Task でも、実装上は同じ領域をまとめて直す必要があり、粒度が細かすぎる場面がある。
- reviewer の期待する完了条件が Task 文面だけでは足りず、実装後にズレが出やすい。
- `rejected` をいつ確認するか、どのタイミングでまとめて再レビューに出すかを運用で決めないと確認コストが積み上がる。
- `doing` 中の Task と、実際にコード変更で同時に解決した周辺 Task がズレやすい。

## Improvement Ideas

- auth や認可のような横断領域は、Task 文に受け入れ条件を明文化する。
  - 例: signup token 再検証、state 署名、DB 再照合、権限降格時の遮断
- 複数 `rejected` をまたぐ修正では、「主タスク 1 件を doing にして、関連 rejected はまとめて扱う」運用ルールを入れる。
- Story 開始時に、その Story 用の Definition of Done を 3-5 行で別途持つ。
- `in_review` に上げる前の自己確認テンプレートを持つ。
  - 例: 権限再確認あり、永続化確認あり、回帰確認あり、build 通過
- `rejectReason` の書式を揃える。
  - 推奨: 「問題」「影響」「再レビュー条件」の 3 点セット

## Skill Candidates

### `wacha-worker`

- `list_tasks` から次タスクを選ぶ
- Task を `doing` にする
- 完了時だけ `rejected` を確認する
- 関連 `rejected` をまとめて扱う

### `wacha-rejected-fix`

- `rejected` を読み、共通原因を束ねる
- 1 回の修正で何件解消できるかを整理する
- 修正後にどの Task を `complete_task` するか判断する

### `wacha-story-driver`

- Story 内の Task 順序を見て前提を崩さず進める
- `schema -> repository -> route/action -> UI -> verification` の流れを意識させる

### `wacha-review-gate`

- `in_review` 前チェックをテンプレート化する
- build/test、権限確認、既知 `rejected` 観点の再点検を行う

### `auth-task-checklist`

- 認証・認可 Task の専用チェックリスト
- state 改ざん、CSRF、セッション復元、権限降格時挙動、再ログイン時の同一性、未認証時遮断を確認する

## Recommended First Skills

- 最優先は `wacha-rejected-fix`
- 次点は `wacha-review-gate`

この 2 つを Skill 化すると、今回のようなレビュー往復のコストをかなり下げやすい。
