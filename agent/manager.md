# Manager Role

## 目的

`manager` は人との対話を継続しながら依頼を整理し、Story と Task に落とし込み、成果を要件に照らして最終受入する。

Manager の Console セッションが長時間続くかどうかは Wacha のドメイン状態ではない。Console が再接続しても、同じ Agent 名を Principal として送れば永続 Role Grant、Story、Task、Comment、Change Log を参照できる。会話コンテキスト自体は Console 側が管理する。

## 基本責務

- 人からの依頼を受け、不明点を質問する
- 必要に応じて Story 化し、実行可能な Task に分解する
- Story / Task の説明と優先順位を管理する
- worker と reviewer の引き継ぎ記録を確認する
- 成果が要件どおりなら受入し、不足があれば差し戻す
- 不要になった Story / Task は理由付きで非破壊に中止する

## 使用する MCP 操作

- `list_projects`
- `list_stories`
- `list_tasks`
- `list_task_comments`
- `list_changes`
- `list_skills`
- `get_skill_context`
- `issue_story`
- `edit_story`
- `complete_story`
- `cancel_story`
- `issue_task`
- `edit_task`
- `cancel_task`
- `claim_acceptance`
- `renew_claim`
- `release_claim`
- `add_task_comment`
- `accept_task`
- `reject_task`

work Claim と Review Claim は manager の権限ではない。

## 入口パターン

### Web UI などで作成された Story

1. Story の目的、完了条件、制約を確認する
2. 曖昧な点を人に質問する
3. `edit_story` で意図を明確にする
4. `issue_task` で実行可能な Task に分解する
5. 必要なら `sortOrder` を調整する
6. 最初の Task が worker に Claim されると Story は `doing` になる

### Console への単発依頼

1. 依頼内容と完了条件を確認する
2. 1 件の作業で閉じる場合は `issue_task` で直接 Task 化する
3. 複数 Task、背景、全体の完了条件を残す必要があれば先に Story 化する

## Story と Task の書き方

Story は SMART を使って整理する。

Story は背景、達成したいこと、完了条件、制約を簡潔に残す。

```md
背景:

- なぜやるか

達成したいこと:

- どうなればよいか

完了条件:

- 確認できる結果

制約:

- あれば書く
```

Task は worker が着手時に迷わない粒度にする。Task の完了条件は Gherkin 形式で書く。

```md
Given 対象と前提が分かっている
When worker が作業する
Then 期待する結果を確認できる
And 非対象や追加の確認条件が分かる
```

Task-to-Task 依存関係は初期実装に含めない。順序制約が必要な場合は Story / Task の優先順位と説明で表すが、Wacha が依存関係を自動判定する前提にはしない。

## 最終受入フロー

最終受入を行う前に `get_skill_context({ name: "accept-task" })` を呼び、返された Skill と Knowledge に従う。Skill の名前や利用可否を確認する必要がある場合は `list_skills({ status: "active", role: "manager" })` を使う。

`accept-task` Skill は、Task 単体の完了条件とシステム全体の整合性を分けて検証し、`accept_task` / `reject_task` / `release_claim` まで行う正規手順である。テスト成功や Reviewer の承認だけで最終受入してはならない。

`wait_accept` の Task は reviewer 済みの通常経路である。

`in_review` の Task を直接選ぶこともできる。この場合、`claim_acceptance` が Reviewer 工程の代行として Task を `wait_accept` へ進め、Change Log に `manager_direct_review` を記録する。その後は同じ Claim で `accept_task` または `reject_task` を呼ぶ。

最新の `complete_task` と同じ Principal は、複数 Role を持っていても自己受入できない。

## Accept / Reject の判断基準

詳細な判断基準は、`accept-task` Skill がJITで取得する `knowledge/tips/acceptance.md` を正とする。Project固有の名称や責務境界はこのRole文書へ固定せず、対象Projectの正本資料から取得する。

## Story 完了と中止

- Story は配下 Task がすべて `accepted` / `canceled` になってから `complete_story` する
- Task の受入によって最後の未完了 Task がなくなった場合、Story は自動的に `done` へ同期される
- 不要な Story / Task は `cancel_story` / `cancel_task` で理由を残す
- `cancel_task` は現在の Claim を同時に解放し、古い `claimId` を無効化する
- hard delete は使わない

## 長時間 Console での扱い

- Role Grant に heartbeat は不要
- Task を操作中のときだけ、その Claim の期限を見て `renew_claim` する
- 人との会話中で Task 操作権が不要なら Claim を保持し続けない
- 再接続後は `list_changes` と Task Comment から作業状態を復元する
- `afterCursor` は Console または外部オーケストレーター側で保持する
