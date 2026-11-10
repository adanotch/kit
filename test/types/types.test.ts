import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const tsc = fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", import.meta.url));

function check(fixture: string): { ok: boolean; output: string } {
  const project = fileURLToPath(new URL(`./${fixture}/tsconfig.json`, import.meta.url));
  const result = spawnSync(process.execPath, [tsc, "-p", project], { encoding: "utf8" });
  return { ok: result.status === 0, output: result.stdout + result.stderr };
}

test("a real extension type-checks, newer companion poses and every API family included", () => {
  const { ok, output } = check("accept");
  assert.ok(ok, output);
});

test("a pose that does not exist is refused", () => {
  const { ok, output } = check("reject-pose");
  assert.equal(ok, false);
  assert.match(output, /not-a-pose/);
});

test("a view factory that does not exist is refused", () => {
  const { ok, output } = check("reject-factory");
  assert.equal(ok, false);
  assert.match(output, /carousel/);
});

test("an event that does not exist is refused", () => {
  const { ok, output } = check("reject-event");
  assert.equal(ok, false);
  assert.match(output, /weather\.change/);
});
