# Frontend Quality Gates

## 適用と導入

React UIを新規作成・変更するときに使う。Projectの明示Policyを優先し、未指定部分には `principles/frontend-architecture.md` の共通デフォルトを適用する。既存の不整合があることだけを、デフォルトを上書きするPolicyとは扱わない。

WorkerはProjectの実際の配置へ次を対応付け、AGENTS.mdまたは正本の設計資料へ残す。既存の同等な検査があれば再利用する。

| 責務 | 対応付けるもの |
| --- | --- |
| app | 起動、routing、Provider、Featureを合成するlayout・page |
| features | 機能固有のUI、hook、API呼び出し、型、validation |
| 共通UI | 機能に依存しないButton、LinkButton、Input、表示切替等 |
| 共通処理 | Featureに依存しないhook、utility、型 |
| 検査 | 構造・部品利用を検査する実行コマンドと対象範囲 |
| 例外 | 具体的な対象、理由、代替検証。一時例外は解消条件・追跡Task |

構造検査がなければ、変更領域を保護する検査を導入する。Taskを超える整備が必要なら、Managerが前提整備Taskと実装Taskに分割する。既存違反の一括許可や、全体整理の無断追加はしない。既存違反を段階的に解消する場合は対象を明記し、新規違反・違反の増加を検出する。

## 完了・承認・受入のゲート

- Worker: 適用Policy、配置と依存、再利用する部品、検査コマンドを実装計画に記載する。変更後は構造検査・関連テスト・型チェックと、対象UIの画面確認を行う。
- Reviewer: 計画と実際の依存・部品利用・SCSSを照合し、構造検査を対象SHAで実行する。型チェックだけのlintを構造検査と扱わない。共通部品の変更は利用箇所への影響も確認する。
- Manager: UIの受入条件を実ブラウザで独立確認する。画面を開けたことや操作の成功だけで、見た目の条件を満たしたとしない。
- 実行コマンド、対象SHA、結果、画像等の証跡、未検証をClaimコメントまたはRunner指定の結果へ残す。同じ証跡を複数の場所へ複製する必要はない。
- CIへの接続は任意。CIがなくてもRoleの検証を省略しない。必須検査が未実施なら承認・受入済みにせず、環境・計画・実装のどこに不足があるかと再開条件を返す。Policyが適用外とする場合はその根拠を残す。

## 実行可能な構造検査テンプレート

次はNode.js・TypeScriptが既にあるReact Project向けの例。既存の依存解析・lintが同等の規則を検査していれば追加不要。Projectへコピーし、`sourceRoot`、`configPath`、共通層・基本部品の配置、公開入口を実際の構成に合わせる。命名を合わせるためだけにコードを移動しない。

`scripts/check-frontend.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const sourceRoot = resolve('src');
const configPath = resolve('tsconfig.json');
const featureRoot = join(sourceRoot, 'features');
const appRoot = join(sourceRoot, 'app');
const sharedRoots = ['components', 'hooks', 'lib', 'utils', 'types'].map(p => join(sourceRoot, p));
const primitiveRoot = join(sourceRoot, 'components/ui');
const primitiveTags = new Set(['button', 'input', 'select', 'textarea']);
const inside = (file, root) => file === root || file.startsWith(root + sep);
const featureOf = file => inside(file, featureRoot) ? relative(featureRoot, file).split(sep)[0] : null;
const publicEntry = file => inside(file, featureRoot)
  && /^[^/]+\/index\.(ts|tsx|js|jsx)$/.test(relative(featureRoot, file).split(sep).join('/'));
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.ok(!config.error, 'Cannot read frontend tsconfig');
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
assert.equal(parsed.errors.length, 0, 'Invalid frontend tsconfig');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = join(dir, entry.name);
  if (entry.isDirectory()) return ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : walk(file);
  return /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(file) && !file.endsWith('.d.ts') ? [file] : [];
});
const files = walk(sourceRoot);
assert.ok(files.length > 0, 'No frontend sources were scanned');

test('frontend dependency boundaries and primitive ownership', () => {
  const errors = [];
  for (const file of files) {
    const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const checkImport = specifier => {
      const target = ts.resolveModuleName(specifier, file, parsed.options, ts.sys).resolvedModule?.resolvedFileName;
      if (!target) {
        const local = specifier.startsWith('.') || specifier.startsWith('/')
          || Object.keys(parsed.options.paths ?? {}).some(pattern => specifier.startsWith(pattern.split('*')[0]));
        // Styles and assets use the bundler's resolver; verify those separately if required.
        if (local && !/\.(scss|sass|css|svg|png|jpg|webp)(\?.*)?$/.test(specifier))
          errors.push(`${relative(sourceRoot, file)}: unresolved local import ${specifier}`);
        return;
      }
      const fromFeature = featureOf(file), toFeature = featureOf(target);
      const sharedToFeature = sharedRoots.some(root => inside(file, root)) && (toFeature || inside(target, appRoot));
      const featureToApp = fromFeature && inside(target, appRoot);
      const privateCrossFeature = fromFeature && toFeature && fromFeature !== toFeature && !publicEntry(target);
      if (sharedToFeature || featureToApp || privateCrossFeature)
        errors.push(`${relative(sourceRoot, file)} -> ${relative(sourceRoot, target)}`);
    };
    const visit = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
        checkImport(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
          && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) checkImport(node.arguments[0].text);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal))
        checkImport(node.argument.literal.text);
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && !inside(file, primitiveRoot)) {
        const tag = node.tagName.getText(tree);
        if (primitiveTags.has(tag)) errors.push(`${relative(sourceRoot, file)}: use shared UI instead of <${tag}>`);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.deepEqual(errors, []);
});
```

実行: `node --test scripts/check-frontend.test.mjs`。既存のtest/lintまたは完了前Hookから呼び出す。検査自体も、許可した依存で成功し、禁止した依存・独自基本部品で失敗するfixtureで確認する。

この例は相対import・tsconfigで解決できるalias・再export・文字列のdynamic importとrequire・import型を対象とする。Feature同士は公開indexだけを許可する例であり、循環依存や公開APIの妥当性まで保証しない。文字列でないdynamic import、bundler固有alias、SCSS依存、独自classを付けたLinkのボタン化、実行時に生成するUIは別途検査・レビューする。raw要素を基本部品へ集約する前に、その配置を調整し、必要な正当例外を狭く定義する。先回りの基本部品一式は作らない。

## UIの観測テンプレート

Playwright等の利用可能なブラウザ手段で、実際の対象ページから測定する。特定のProviderやMCP名を必須にしない。

```js
// pageは既存のブラウザ確認手順で開いた対象ページ。
const controls = page.getByTestId('project-actions').getByRole('link');
const measurements = await controls.evaluateAll(elements => elements.map(element => {
  const box = element.getBoundingClientRect(), style = getComputedStyle(element);
  return { text: element.textContent, height: box.height, width: box.width,
    minHeight: style.minHeight, padding: style.padding, margin: style.margin };
}));
console.log(measurements);
```

`project-actions`は例であり、実際のrole・labelまたは安定したtest IDへ置き換える。認証・データ準備は対象Projectの正規手順に従い、表示だけを差し替えない。

- Desktop・狭い画面で画像を保存し、実際に見る。対象操作の成功、空・選択中・disabled・エラー等の変更に関係する状態も確認する。
- 同じsize契約の部品は、font・padding・高さがトークンに一致するかを確認する。異なる用途・size・幅まで一律にそろえない。小数pxの差は描画誤差を考慮する。
- toolbar内の伸張、折返し、余白の混入、文字切れ、横スクロールを確認する。部品のサイズだけでなく親layoutとの組合せを見る。
- 自動測定だけでデザインの妥当性を判定しない。画像・操作結果・計測を要件と照合し、何が未検証かも残す。
