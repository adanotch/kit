import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import nodesJson from "../../contract/nodes.json" with { type: "json" };
import { load } from "../harness/helpers.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

type Corpus = Record<string, { type: string }[]>;
const nodes = nodesJson as unknown as Corpus;
const entries = Object.entries(nodes);

const viewTypes = read("../../types/view.d.ts");
const interfaceTypes = new Map(
  [...viewTypes.matchAll(/interface (\w+Node) \{\s*type: "(\w+)"/g)].map((match) => [match[1] ?? "", match[2] ?? ""]),
);

/** The node types a `type X = A | B | …;` union of `view.d.ts` lists. */
function union(name: string): string[] {
  const body = new RegExp(`type ${name} =([^;]+);`).exec(viewTypes)?.[1] ?? "";
  return [...body.matchAll(/\b(\w+Node)\b/g)].map((match) => interfaceTypes.get(match[1] ?? "") ?? `?${match[1]}`);
}

test("the corpus covers every node type the types declare, and no other", () => {
  const declared = union("Node");
  assert.ok(declared.length >= 28, `found ${declared.length} node types in view.d.ts`);
  assert.deepEqual(Object.keys(nodes).toSorted(), declared.toSorted());
});

test("every example carries the type it is filed under, and each type has a minimal and a fuller example", () => {
  for (const [type, examples] of entries) {
    assert.ok(examples.length >= 1, `${type} has an example`);
    for (const example of examples) assert.equal(example.type, type);
  }
  const lone = entries
    .filter(([, examples]) => examples.length < 2)
    .map(([type]) => type)
    .toSorted();
  // Nodes with nothing optional have one shape only.
  assert.deepEqual(lone, ["calendarDay", "divider", "spacer", "tabs", "toggle"]);
});

test("contract/nodes.json is the corpus in contract/nodes.ts, as JSON", () => {
  const script = fileURLToPath(new URL("../../scripts/build-contract.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("the runtime renders every node unchanged, in the open card", async () => {
  for (const [type, examples] of entries) {
    for (const example of examples) {
      const ext = await load(
        `AdanotchKit.activity({ update() { return { expanded: ${JSON.stringify(example)} }; } });`,
      );
      assert.deepEqual(ext.view.expanded, example, `${type} comes back as sent`);
    }
  }
});

test("the runtime renders every node that fits beside the notch, in both slots", async () => {
  const compact = union("CompactNode");
  assert.ok(compact.length >= 9, `found ${compact.length} compact node types`);
  for (const type of compact) {
    for (const example of nodes[type] ?? []) {
      const ext = await load(
        `AdanotchKit.activity({ update() { return { compact: { leading: ${JSON.stringify(example)}, trailing: ${JSON.stringify(example)} } }; } });`,
      );
      assert.deepEqual(ext.view.compact, { leading: example, trailing: example }, `${type} fits beside the notch`);
    }
  }
});

test("the factories build the corpus's minimal examples", async () => {
  const ext = await load(`AdanotchKit.activity({ update() {
    const { ui } = AdanotchKit;
    return { expanded: ui.stack([
      ui.text("Hello"), ui.icon("cpu"), ui.badge("3"), ui.gauge("CPU", 42), ui.ring(60), ui.progress(30),
      ui.divider(), ui.spacer(), ui.pet("lokum", "idle"), ui.calendarDay(14),
    ]) };
  } });`);
  const children = (ext.view.expanded?.["children"] ?? []) as { type: string }[];
  const built = ["text", "icon", "badge", "gauge", "ring", "progress", "divider", "spacer", "pet", "calendarDay"];
  assert.deepEqual(
    children.map((child) => child.type),
    built,
  );
  built.forEach((type, index) => assert.deepEqual(children[index], nodes[type]?.[0], `ui factory for ${type}`));
});
