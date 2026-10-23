import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FileSkillRepository } from "@repository/FileSkillRepository.ts";
import { FileKnowledgeRepository } from "@repository/FileKnowledgeRepository.ts";
import { GetSkillContextUseCase } from "@application/usecase/skills/GetSkillContextUseCase.ts";

const context = new GetSkillContextUseCase(new FileSkillRepository(), new FileKnowledgeRepository());
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("UIを実装・レビュー・受入するSkillが構成方針と検査テンプレートを実際に解決して配信する", async () => {
  for (const name of ["implement-task", "review-task", "accept-task"]) {
    const result = await context.execute({ name });
    for (const path of ["principles/frontend-architecture.md", "tips/frontend-quality-gates.md"]) {
      assert.ok(result.knowledge.some((item) => item.path === path && item.content.length > 0), `${name}: ${path}`);
    }
  }
});

test("配信する構造検査テンプレートは許可依存を通し、境界違反と独自基本部品を拒否する", async (t) => {
  const result = await context.execute({ name: "implement-task" });
  const document = result.knowledge.find((item) => item.path === "tips/frontend-quality-gates.md")!;
  const script = document.content.match(/```js\n([\s\S]*?)\n```/)?.[1];
  assert.ok(script, "実行するテンプレートが配信される");
  const valid: Record<string, string> = {
    "src/app/main.tsx": "import '../features/a';",
    "src/features/a/index.ts": "export const a = 1;",
    "src/features/a/View.tsx": "import { b } from '../b'; import { Input } from '../../components/ui/Input'; export const View = () => <Input />;",
    "src/features/b/index.ts": "export const b = 1;",
    "src/features/b/internal.ts": "export const secret = 1;",
    "src/components/ui/Input.tsx": "export const Input = () => <input />;",
    "src/lib/text.ts": "// import forbidden from '../features/a'\nexport const label = '<button>';",
  };
  const cases: { name: string; override: Record<string, string>; passes: boolean }[] = [
    { name: "appの合成・公開入口・共通部品・コメントと文字列", override: {}, passes: true },
    { name: "alias経由の共通層からFeatureへの依存", override: { "src/lib/bad.ts": "import '@/features/a';" }, passes: false },
    { name: "Featureからappへの依存", override: { "src/features/a/bad.ts": "import '../../app/main';" }, passes: false },
    { name: "別Featureの内部参照", override: { "src/features/a/bad.ts": "import '../b/internal';" }, passes: false },
    { name: "Feature内の独自基本部品", override: { "src/features/a/bad.tsx": "export const Bad = () => <button>Save</button>;" }, passes: false },
    { name: "解決できないローカルalias", override: { "src/features/a/bad.ts": "import '@/missing';" }, passes: false },
    { name: "再export経由の境界違反", override: { "src/lib/bad.ts": "export * from '../features/a';" }, passes: false },
    { name: "dynamic import経由の境界違反", override: { "src/lib/bad.ts": "export const load = () => import('../features/a');" }, passes: false },
    { name: "import型経由の境界違反", override: { "src/lib/bad.ts": "type Bad = typeof import('../features/a');" }, passes: false },
  ];
  for (const scenario of cases) await t.test(scenario.name, () => {
    const root = mkdtempSync(join(tmpdir(), "frontend-gate-"));
    try {
      symlinkSync(join(repositoryRoot, "node_modules"), join(root, "node_modules"), "dir");
      mkdirSync(join(root, "scripts"));
      writeFileSync(join(root, "scripts/check-frontend.test.mjs"), script);
      writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", baseUrl: ".", paths: { "@/*": ["src/*"] },
      }, include: ["src"] }));
      for (const [name, content] of Object.entries({ ...valid, ...scenario.override })) {
        const path = join(root, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      }
      const environment = { ...process.env };
      delete environment.NODE_TEST_CONTEXT; // The fixture starts its own Node test runner.
      const execution = spawnSync(process.execPath, ["--test", "scripts/check-frontend.test.mjs"], { cwd: root, env: environment, encoding: "utf8", timeout: 15_000 });
      assert.ifError(execution.error);
      assert.equal(execution.signal, null);
      assert.equal(execution.status === 0, scenario.passes, execution.stdout + execution.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
