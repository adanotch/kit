import assert from "node:assert/strict";
import { test } from "node:test";
import { mapStack, readInlineSourceMap } from "../../src/testing/stack.ts";

const stack = [
  "Error: boom",
  "    at update (extension://local.kit.test/dist/index.js:10:5)",
  "    at async Promise.all (index 0)",
  "    at TestContext.<anonymous> (file:///repo/test/harness/extension.test.ts:5:3)",
  "    at extension://local.kit.test/dist/index.js:20:1",
].join("\n");

test("only the extension's own frames survive, in JavaScriptCore's fn@file:row:col form", () => {
  assert.equal(
    mapStack(stack, null),
    "update@extension://local.kit.test/dist/index.js:10:5\n@extension://local.kit.test/dist/index.js:20:1",
  );
});

test("a stack without frames maps to nothing", () => {
  assert.equal(mapStack("Error: no frames", null), "");
});

test("an inline source map moves a frame back to the TypeScript source", () => {
  const map = {
    version: 3,
    sources: ["../src/index.ts"],
    names: [],
    // Generated line 1, column 0 -> source 0, line 4, column 2.
    mappings: "AAGE",
  };
  const script = `console.log(1);\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString("base64")}`;
  const sourceMap = readInlineSourceMap(script);
  assert.ok(sourceMap);
  assert.equal(
    mapStack("Error\n    at run (extension://local.kit.test/dist/index.js:1:1)", sourceMap),
    "run@src/index.ts:4:3",
  );
});

test("a missing or broken source map reads as none", () => {
  assert.equal(readInlineSourceMap("console.log(1);"), null);
  assert.equal(readInlineSourceMap("//# sourceMappingURL=data:application/json;base64,bm90IGpzb24="), null);
});
