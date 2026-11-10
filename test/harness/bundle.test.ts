import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { bundle } from "../../src/testing/bundle.ts";
import { loadExtension } from "../../src/testing/index.ts";

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "kit-bundle-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const manifest = JSON.stringify({
  id: "local.kit.bundle",
  name: "Bundle",
  version: "0.1.0",
  adanotchVersion: ">=0.1.0",
  main: "dist/index.js",
  slots: ["expanded"],
  permissions: [],
});

test("loadExtension bundles src/index.ts, imports included, and runs it", async () => {
  const root = project({
    "manifest.json": manifest,
    "src/index.ts": `import { greeting } from "./greeting.ts";
      AdanotchKit.activity({ update() { return { expanded: AdanotchKit.ui.text(greeting("Ada")) }; } });`,
    "src/greeting.ts": `export const greeting = (name: string): string => "Hello " + name;`,
  });
  try {
    assert.deepEqual((await loadExtension({ root })).texts(), ["Hello Ada"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("errors in the extension point at the TypeScript source, not the bundle", async () => {
  const root = project({
    "manifest.json": manifest,
    "src/index.ts": `AdanotchKit.activity({
  update() {
    throw new Error("from source");
  },
});`,
  });
  try {
    await assert.rejects(loadExtension({ root }), (error: Error) => {
      assert.match(error.message, /update failed: .*from source/);
      assert.match(error.message, /src\/index\.ts:3:/);
      return true;
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a missing esbuild is explained, with the command that fixes it", async () => {
  const missing = Object.assign(new Error("Cannot find package 'esbuild' imported from kit"), {
    code: "ERR_MODULE_NOT_FOUND",
  });
  await assert.rejects(
    bundle("src/index.ts", () => Promise.reject(missing)),
    (error: Error) => {
      assert.match(error.message, /isn't installed/);
      assert.match(error.message, /npm install --save-dev esbuild/);
      assert.equal(error.cause, missing);
      return true;
    },
  );
});

test("any other failure to load esbuild is not disguised", async () => {
  const other = new Error("something else");
  await assert.rejects(
    bundle("src/index.ts", () => Promise.reject(other)),
    (error: Error) => error === other,
  );
});
