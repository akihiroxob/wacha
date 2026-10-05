# Frontend Architecture

## 目的

この文書は、フロントエンド開発における構成判断を安定させるための原則をまとめる。

基本方針は Bulletproof React を参考にする。

ただし、目的はディレクトリを増やすことではなく、機能単位で変更しやすく、再利用しやすく、テストしやすい構成を維持することである。

## 基本方針

- UI の実装前に既存の React コンポーネントとスタイルを確認し、再利用・拡張・新規作成を判断する
- 画面固有の重複を避け、共通の修正が利用箇所へ反映される再利用可能な単位でコンポーネントを作る
- 必要に応じてデザインシステムを整備する。少なくとも、共通コンポーネントとデザイントークンを一元管理する
- スタイルは SCSS（Sass）を基本とし、Tailwind CSS を新たな UI の実装方針として採用しない
- Project Policy に明示的な指定がある場合はそれを優先する
- ルーティングと画面合成は app 側に寄せる
- 機能固有の UI・hooks・logic は feature に閉じる
- 汎用 UI は shared / components 側に置く
- 汎用 utility は lib / utils 側に置く
- project 固有の実際のディレクトリ名は、その project の docs/ を優先する

## 推奨構成

project に明示された構成がない場合は、次の考え方を使う。

```txt
    src/
      app/          # アプリ初期化、ルーティング、Provider、画面合成
      features/     # 機能単位の実装
      components/   # 再利用可能な UI
      lib/          # 汎用 utility
      hooks/        # 汎用 hook
      types/        # 汎用 type
```

Next.js の場合は、routing の `app/` と実装の `src/` が分かれることがある。

```txt
    app/             # Next.js routing
    src/
      features/
      components/
      lib/
      hooks/
      types/
      server/
```

## 配置ルール

## 実装前の探索ルール

新規 UI を作る前に、最低 1 回は次を探索する。

- `components` 配下の類似 UI
- `features` 配下の類似 section / form / interaction
- `app` 配下の類似 page / route 直下 UI

探索後は、再利用・拡張・新規作成の判断を FileChangePlan または task comment に残す。共通の見た目や振る舞いを変更する場合は、利用箇所全体への影響も確認する。

### app に置くもの

- routing
- layout
- provider
- page composition
- feature の呼び出し

app に business logic を直接置かない。

page 直書きは次の条件を満たす場合に限って許容する。

- その page でしか使わない
- 要素数が少ない
- 独立したコンポーネントにする利点がない

この条件を外れる場合は、feature または components への切り出しを検討する。

### features に置くもの

- 特定機能に閉じた UI
- 特定機能に閉じた hooks
- 特定機能に閉じた API 呼び出し
- 特定機能に閉じた type
- 特定機能に閉じた validation

他 feature から安易に内部ファイルを参照しない。

### components に置くもの

- 複数 feature から使う UI
- Button、Input、Dialog などのプリミティブ UI
- Header、Card、Section などの汎用的な組み合わせ UI

特定 feature の業務知識を components に持ち込まない。

同種 UI が既にある場合は、components に上げるか、feature 内共有に留めるかを判断して記録する。Button などの基本部品だけでなく、繰り返す section や form も再利用しやすい大きさで切り出す。Atomic Design の粒度への細分化は必須としない。

## スタイルとデザイントークン

- 色、文字、余白、角丸、境界線など、複数箇所で共有する値は SCSS の変数・mixin または CSS カスタムプロパティとして一元管理する
- コンポーネントのスタイルは責務に合わせて整理し、画面ごとの重複指定や固定値の散在を避ける
- 共通の見た目を変更するときは、トークンや共有スタイルを修正し、利用画面を確認する
- 既存 UI を変更する際は、関連するコンポーネントとスタイルをこの方針に合わせて整える

### lib / utils に置くもの

- UI や feature に依存しない純粋関数
- format、parse、date、className 結合などの汎用処理

便利置き場にしない。

## 新規 feature 作成ルール

新しい feature を作る前に、次を確認する。

- 既存 feature に統合できないか
- 既存 feature の一部として扱う方が自然ではないか
- feature 名が business concept として説明できるか
- その feature に実際の責務があるか

次の場合は新しい feature を作らない。

- 1 component だけを置くため
- 将来使うかもしれないため
- 既存の置き場所が分からないため
- 名前だけ独立しているが、実態は既存 feature の一部であるため

既存 feature で代替できない理由を説明できない場合は、新しい feature を作らない。

## 新規ディレクトリ作成ルール

- 空ディレクトリは作らない
- api / components / hooks / types / utils などの標準フォルダを先に全部作らない
- 必要なファイルが発生した時点で、そのファイルに必要な最小ディレクトリだけ作る
- 既存構成と異なる命名を導入しない

既存の再利用候補が見つからない場合は、コンポーネント化の必要性を先に判断する。画面固有で単純な要素は page または既存 feature 内に置いてよい。同種要素が再登場した場合は共有する。

## Bulletproof React の扱い

Bulletproof React は、構成の参考であって絶対ルールではない。

優先順位は次の通り。

1. 明示された Project Policy と要件
2. project の正本となる docs/
3. この文書の原則
4. 既存コードの構成
5. Bulletproof React の一般的な考え方

## 避けること

- app に business logic を直接書く
- feature を細かく作りすぎる
- components に業務固有ロジックを置く
- 汎用化されていないものを shared / components に上げる
- 使われていない汎用 component を先回りで作る
- atomic design や layer 分割を理由に、必要以上にファイルを増やす
