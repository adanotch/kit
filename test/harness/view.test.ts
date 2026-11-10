import assert from "node:assert/strict";
import { test } from "node:test";
import { find, texts } from "../../src/testing/view.ts";

const view = {
  compact: { leading: { type: "icon", name: "bell" }, trailing: { type: "badge", text: "3" } },
  expanded: {
    type: "stack",
    children: [
      { type: "text", value: "Title", tone: "accent" },
      { type: "markdown", value: "**bold**" },
      { type: "button", label: "Refresh", action: "refresh" },
      { type: "list", items: [{ title: "Row", subtitle: "detail", trailing: "2 min" }] },
      { type: "table", headers: ["A", "B"], rows: [["1", "2"]] },
      { type: "tabs", tabs: [{ title: "Tab", content: { type: "text", value: "inside" } }] },
    ],
  },
};

test("texts collects every visible string, in tree order", () => {
  assert.deepEqual(texts(view), [
    "3",
    "Title",
    "**bold**",
    "Refresh",
    "Row",
    "detail",
    "2 min",
    "A",
    "B",
    "1",
    "2",
    "Tab",
    "inside",
  ]);
});

test("texts of anything that is not a node is empty", () => {
  assert.deepEqual(texts(null), []);
  assert.deepEqual(texts("text"), []);
  assert.deepEqual(texts(42), []);
});

test("find returns the first match depth first, honours where, and misses cleanly", () => {
  assert.equal(find("text", () => true, view)?.["value"], "Title");
  assert.equal(find("text", (node) => node["tone"] !== "accent", view)?.["value"], "inside");
  assert.equal(find("button", (node) => node["action"] === "refresh", view)?.["label"], "Refresh");
  assert.equal(
    find("gauge", () => true, view),
    null,
  );
  assert.equal(
    find("text", () => true, null),
    null,
  );
});
