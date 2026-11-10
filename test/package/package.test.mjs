// Tests the package as a user gets it: packed into a tarball and installed into a clean project.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workdir = mkdtempSync(join(tmpdir(), "adanotch-kit-package-"));
let tarball = "";

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return { ok: result.status === 0, output: result.stdout + result.stderr, stdout: result.stdout };
};

before(() => {
  const pack = run("npm", ["pack", "--pack-destination", workdir, "--json", "--ignore-scripts"], root);
  assert.ok(pack.ok, pack.output);
  const [entry] = JSON.parse(pack.stdout);
  tarball = join(workdir, entry.filename);
  globalThis.packedFiles = entry.files.map((file) => file.path).toSorted();
});

after(() => rmSync(workdir, { recursive: true, force: true }));

test("the tarball holds the package and nothing else", () => {
  const files = globalThis.packedFiles;
  for (const required of [
    "CHANGELOG.md",
    "LICENSE",
    "README.md",
    "package.json",
    "schema/manifest.schema.json",
    "types/index.d.ts",
    "dist/runtime.js",
    "dist/testing/index.js",
    "dist/testing/index.d.ts",
  ]) {
    assert.ok(files.includes(required), `${required} is packed`);
  }
  const unwanted = files.filter(
    (file) => /^(src|test|scripts|contract|\.github)\//.test(file) || /\.(map|tsbuildinfo)$/.test(file),
  );
  assert.deepEqual(unwanted, []);
  // Every type file `index.d.ts` references ships with it.
  const referenced = ["view", "lifecycle", "data", "events", "kit", "globals"].map((name) => `types/${name}.d.ts`);
  for (const file of referenced) assert.ok(files.includes(file), `${file} is packed`);
});

test("a clean project installs it, type-checks against it and tests an extension through its entry points", () => {
  const project = join(workdir, "consumer");
  mkdirSync(join(project, "src"), { recursive: true });
  mkdirSync(join(project, "test"), { recursive: true });
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ name: "consumer", private: true, version: "0.0.0", type: "module" }),
  );
  writeFileSync(
    join(project, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { target: "ES2020", lib: ["ES2020"], types: ["@adanotch/kit"], strict: true, noEmit: true },
      include: ["src"],
    }),
  );
  writeFileSync(
    join(project, "manifest.json"),
    JSON.stringify({
      $schema: "./node_modules/@adanotch/kit/manifest.schema.json",
      id: "local.adanotch.consumer",
      name: "Consumer",
      version: "0.1.0",
      adanotchVersion: ">=0.1.0",
      main: "dist/index.js",
      slots: ["compact"],
      permissions: ["battery.read"],
      refresh: "manual",
    }),
  );
  writeFileSync(
    join(project, "src/index.ts"),
    `const { activity, ui, battery } = AdanotchKit;
activity({
  async update() {
    const state = await battery.read();
    return { compact: { leading: ui.pet("lokum", "nightShift"), trailing: ui.text(state.percentage + "%") } };
  },
});
`,
  );
  writeFileSync(
    join(project, "test/a.test.mjs"),
    `import assert from "node:assert/strict";
import { test } from "node:test";
import { loadExtension } from "@adanotch/kit/testing";
const battery = { percentage: 64, isCharging: false, isPluggedIn: false, hasInternalBattery: true, minutesRemaining: null, devices: [] };
test("runs on the packed kit", async () => {
  const ext = await loadExtension({ mocks: { "battery.read": () => battery } });
  assert.equal(ext.view.compact?.trailing?.value, "64%");
  assert.equal(ext.view.compact?.leading?.value, "nightShift");
});
`,
  );

  const install = run(
    "npm",
    ["install", "--no-audit", "--no-fund", "--save-dev", tarball, "esbuild", "typescript"],
    project,
  );
  assert.ok(install.ok, install.output);

  const typecheck = run(process.execPath, [join(project, "node_modules/typescript/bin/tsc"), "-p", "."], project);
  assert.ok(typecheck.ok, typecheck.output);

  const tests = run(process.execPath, ["--test", "test/a.test.mjs"], project);
  assert.ok(tests.ok, tests.output);
});

test("a project without esbuild is told what to install", () => {
  const project = join(workdir, "no-esbuild");
  mkdirSync(project, { recursive: true });
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "no-esbuild", private: true, type: "module" }));
  writeFileSync(
    join(project, "check.mjs"),
    `import { loadExtension } from "@adanotch/kit/testing";
try {
  await loadExtension({ root: ".", manifest: { id: "local.adanotch.none" } });
  console.log("loaded");
} catch (error) {
  console.log(error.message);
}
`,
  );
  const install = run("npm", ["install", "--no-audit", "--no-fund", "--omit=peer", tarball], project);
  assert.ok(install.ok, install.output);
  const result = run(process.execPath, ["check.mjs"], project);
  assert.match(result.stdout, /isn't installed/);
  assert.match(result.stdout, /npm install --save-dev esbuild/);
});
