# Skill ガイド

## 位置づけ

Skill は agent のための再利用可能な実行パターンです。

既存の role instruction を補完します。

```txt
Role = 誰が責任を持つか
Task = 何をやるか
Skill = どうやるか
Tool = 実行可能な操作
```

## Skill が必要な理由

現在の system には次があります。

- role instruction がある (`agent/*.md`)
- task がある
- tool がある

不足しているもの:

- task をまたいで再利用できる実行パターン

## Skill の定義

Skill は次を定義するべきです。

- 明確な入力
- 明確な出力
- 再現可能な手順
- 成功条件

## Skill の例

### Task Implementation Skill

```txt
input:
  - Task の説明

steps:
  1. task を読む
  2. 対象 file を特定する
  3. 可能なら失敗する test を先に書く
  4. 実装する
  5. 検証する

successCriteria:
  - task の acceptance criteria を満たしている
  - regression がない
```

## Skill のライフサイクル

1. 繰り返し作業の中で発見される
2. 文書化される
3. 再利用される
4. review feedback で改善される

## Skill から MCP Tool への進化

安定した Skill は MCP Tool へ進化できます。

例:

```txt
Skill: test を実行する
-> MCP Tool: run_tests

Skill: patch を適用する
-> MCP Tool: apply_patch

Skill: story から task を作る
-> MCP Tool: decompose_story
```

## 設計ルール

- Skill は descriptive
- Tool は executable

両者を混ぜてはいけません。

## 保存方針

今後の候補:

- skill を DB または artifact に保存する
- version を持たせる
- agent が skill 更新を提案できるようにする

## 注意点

悪い Skill:

- 曖昧
- 大きすぎる
- 再利用できない

良い Skill:

- 小さい
- 再現できる
- 測定できる
