# Agent とのやり取り・MCP 改善アイデア

2026-07-05 の WebUI 再設計 (PdM向けダッシュボード化) の際に整理したアイデア集。
前提となる利用実態: **実運用では Worker AI のみを起動し、PdM が WebUI で manager + reviewer を兼ねる** ケースが支配的。

## 観測された実態

- manager / reviewer role の agent はほぼ起動されず、`in_review` の Task を PdM が UI から直接 accept / reject している
- Agent とのやり取りはすべて task comment 経由 (自由テキスト)
- `wacha-retrospective.md` の指摘とも一致: rejected の確認タイミング、複数 rejected をまたぐ修正、reviewer 期待とのズレが運用コストになっている

## Agent とのやり取り改善案

### 1. コメントの構造化 (kind の導入)

現状 comment は自由テキストで、「指示」「質問」「作業報告」が混在する。
`add_task_comment` に `kind: "instruction" | "question" | "report" | "answer"` を追加すると:

- UI: 未回答の `question` を「要対応」に昇格できる (PdM が見落とさない)
- Worker: claim 時に未消化の `instruction` を機械的に拾える
- 会話ログとしての可読性が上がる (現状の author による色分けの発展形)

最小実装: comment テーブルに `kind` カラム (nullable)。既存コメントは null = 自由テキスト扱い。

### 2. `request_human_input` tool (Agent → 人間へのブロッカー宣言)

Worker が判断に迷ったとき、現状はコメントを書いて `complete_task` するか放置するしかない。
専用 tool で「人間の入力待ち」を宣言できると:

- Task に `blocked` 相当の状態 (または flag) が付き、UI の「要対応」に質問文つきで表示される
- PdM が回答コメントを書くと解除され、Worker は次回 `list_tasks` / claim 時に回答を受け取る
- 「質問したのに気づかれない」「勝手に仮定して進めて reject される」の両方を防げる

### 3. Solo-worker モードの一級市民化

worker のみで回す場合、`in_review -> wait_accept` の reviewer 段階が形骸化する。
`accept_task` は既に `in_review` から直接受理できるので実害はないが、明示すると迷いが減る:

- project 設定に `reviewFlow: "full" | "solo"` を持たせる
- `solo` では UI が InReview / WaitAccept を「承認待ち」として同一扱いし、role instruction も solo 用の文面を配信する
- 将来 reviewer agent を追加したら `full` に戻すだけ

### 4. Reject 理由の構造化テンプレート

retrospective の推奨 (「問題 / 影響 / 再レビュー条件」) を UI とツールの両方で強制はせず誘導する:

- UI: Reject フォームの placeholder に 3 点セットを提示 (実装済み)
- MCP: `reject_task` の description に書式を明記し、`get_role_instructions` にも反映
- 発展形: `reject_task` の引数を `{ problem, impact, resumeCondition }` に分解し、Worker が機械的に修正計画へ変換できるようにする

### 5. 成果物 (artifact) の添付

PdM が accept 判断するとき、現状はコメント本文の「〜を実装しました」を信じるしかない。
`complete_task` に構造化フィールドを追加する:

- `{ branch?, commits?: string[], changedFiles?: string[], verification?: string }`
- UI のドロワーで「変更ブランチ / コミット / 検証内容」として表示
- レビュー往復が減り、accept 判断が速くなる

### 6. 関連 rejected の束ね (retrospective 対応)

1 つの修正で複数の rejected が解消されるケースに対して:

- `claim_task` に `relatedTaskIds` を渡せるようにし、主タスク完了時に関連タスクをまとめて `in_review` へ進める
- または `complete_task` に `alsoResolves: string[]` を追加
- UI 側は「一緒にレビューに来た Task」をグループ表示する

## MCP 側の改善案

### 1. Agent identity の永続化

session ベースの identity は server 再起動で失われ、membership も消える。
client 提供の `agentName` (+ 任意の token) を identity にすると:

- 再接続時に role / membership / 担当 Task を引き継げる
- UI の Agents 表示が「codex worker (再接続 3回)」のように安定する
- comment の author も sessionId ではなく agent 名になる

### 2. Heartbeat の自動更新

`lastHeartbeatAt` はスキーマにあるが更新経路が細い。任意の tool 呼び出しで membership の heartbeat を自動更新すれば、UI の接続インジケータ (緑ドット) が実態を反映する。専用 `heartbeat` tool より低コスト。

### 3. `list_tasks` の status フィルタ

Worker のループは実質「todo / rejected を拾う」なので、`list_tasks { status?: TaskStatus[] }` でトークン消費と誤読を減らせる。`next_task` (次の 1 件を自動選択して claim まで行う) まで進めると Worker skill が簡素になる。

### 4. Task イベントログ (タイムライン)

状態遷移の履歴 (`who / from -> to / when / reason`) を記録すると:

- UI ドロワーにタイムライン表示ができ、「いつ reject され、いつ再着手されたか」が追える
- retrospective 的な分析 (レビュー往復回数、滞留時間) が可能になる

### 5. Push / 通知の実装 (role-policy.md の宿題)

`agent/role-policy.md` に Push 対象イベントが定義済みだが未実装。現実的な順序:

1. UI 向け: `GET /api/projects/:id/events` の SSE (5秒ポーリングの置き換え)
2. Agent 向け: `wait_for_events` tool (long-poll)。Worker が「reject されたら起きる」動きを実現できる

### 6. Story 単位の Definition of Done

retrospective の「Story 開始時に DoD を 3-5 行持つ」を field 化する: `story.definitionOfDone`。
`get_skill_context` / claim 時に Worker へ配信し、UI では Story アコーディオンに表示する。

## 優先度の提案

利用実態 (worker-only + PdM が UI で判断) を踏まえた優先順:

1. **`request_human_input`** (§やり取り2) — コメント見落としが最大のリスク
2. **成果物添付** (§やり取り5) — accept 判断の質と速度に直結
3. **`list_tasks` フィルタ + heartbeat 自動更新** (§MCP 2,3) — 実装が軽い割に効果が出る
4. コメント kind (§やり取り1) — request_human_input の一般化として後追い
