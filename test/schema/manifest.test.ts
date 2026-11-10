import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = JSON.parse(read("../../schema/manifest.schema.json")) as {
  properties: { permissions: { items: { pattern: string } } };
};
const validate = new Ajv2020.default({ strict: true, allowUnionTypes: true, allErrors: true }).compile(schema);

const minimal = {
  id: "local.you.my-extension",
  name: "My extension",
  version: "1.0.0",
  adanotchVersion: ">=0.1.0",
  main: "dist/index.js",
  slots: ["compact"],
  permissions: [],
};

const errors = (manifest: unknown): string[] => {
  validate(manifest);
  return (validate.errors ?? []).map((error) => `${error.instancePath} ${error.message}`);
};

test("the schema compiles in strict mode and accepts the smallest manifest", () => {
  assert.deepEqual(errors(minimal), []);
});

test("a full manifest is accepted: every slot, setting type, refresh form and the editor's $schema", () => {
  const full = {
    ...minimal,
    $schema: "./node_modules/@adanotch/kit/manifest.schema.json",
    description: "Everything at once.",
    author: "Ada",
    license: "MIT",
    categories: ["developer"],
    slots: ["compact", "expanded", "hud"],
    refresh: "manual",
    permissions: [
      "system.stats",
      "network:api.github.com",
      "timer.read",
      "timer.control",
      "devices.read",
      "files.drop",
    ],
    settings: [
      { key: "token", type: "secret", label: "Token" },
      { key: "on", type: "toggle", label: "On", default: true },
      { key: "rows", type: "number", label: "Rows", default: 6, unit: "rows" },
      { key: "city", type: "text", label: "City", default: "Ankara" },
      { key: "units", type: "select", label: "Units", default: "c", options: [{ value: "c", label: "°C" }] },
      { key: "tabs", type: "multiselect", label: "Tabs", default: ["a"], options: [{ value: "a", label: "A" }] },
      { key: "tint", type: "color", label: "Tint", default: "#FF8800" },
      { key: "when", type: "date", label: "When", default: 1_700_000_000_000 },
    ],
  };
  assert.deepEqual(errors(full), []);
});

test("every permission the host accepts is allowed, and unknown ones are not", () => {
  const permissions = [
    "system.stats",
    "battery.read",
    "notifications",
    "timer.read",
    "timer.control",
    "devices.read",
    "media.read",
    "media.control",
    "calendar.read",
    "reminders.read",
    "clipboard.read",
    "clipboard.write",
    "files.drop",
  ];
  for (const permission of permissions)
    assert.deepEqual(errors({ ...minimal, permissions: [permission] }), [], permission);
  assert.ok(errors({ ...minimal, permissions: ["system.root"] }).length > 0);
  assert.ok(errors({ ...minimal, permissions: ["network:"] }).length > 0);
});

test("every permission the runtime asks for is in the schema", () => {
  const runtime = read("../../src/runtime.js");
  const asked = [...runtime.matchAll(/(?:requirePermission|gated)\("([a-z.]+)"/g)].map((match) => match[1] ?? "");
  assert.ok(asked.length > 5, "found the runtime's permission checks");
  const pattern = new RegExp(schema.properties.permissions.items.pattern);
  for (const permission of new Set(asked)) assert.match(permission, pattern, `the runtime asks for ${permission}`);
});

test("required fields are required, and shapes are enforced", () => {
  for (const field of Object.keys(minimal)) {
    const { [field as keyof typeof minimal]: _omitted, ...rest } = minimal;
    assert.ok(
      errors(rest).some((message) => message.includes(field)),
      `${field} is required`,
    );
  }
  assert.ok(errors({ ...minimal, id: "two.parts" }).length > 0, "an id has at least three parts");
  assert.ok(errors({ ...minimal, id: "Local.You.Ext" }).length > 0, "an id is lowercase");
  assert.ok(errors({ ...minimal, version: "1.0" }).length > 0);
  assert.ok(errors({ ...minimal, main: "dist/index.ts" }).length > 0, "main is a .js file");
  assert.ok(errors({ ...minimal, slots: [] }).length > 0);
  assert.ok(errors({ ...minimal, slots: ["sidebar"] }).length > 0);
  assert.ok(errors({ ...minimal, refresh: "0s" }).length > 0);
  assert.ok(errors({ ...minimal, refresh: "5 seconds" }).length > 0);
  assert.ok(errors({ ...minimal, unknownField: 1 }).length > 0, "unknown fields are refused");
});

test("settings: a default is required except for secrets, select needs its options", () => {
  assert.ok(errors({ ...minimal, settings: [{ key: "a", type: "text", label: "A" }] }).length > 0);
  assert.deepEqual(errors({ ...minimal, settings: [{ key: "a", type: "secret", label: "A" }] }), []);
  assert.ok(
    errors({ ...minimal, settings: [{ key: "a", type: "select", label: "A", default: "x", options: [] }] }).length > 0,
  );
  assert.ok(errors({ ...minimal, settings: [{ key: "a", type: "slider", label: "A", default: 1 }] }).length > 0);
});

test("triggers and priority are still accepted, and marked deprecated so editors say so", () => {
  assert.deepEqual(errors({ ...minimal, triggers: ["interval"], priority: "high" }), []);
  const properties = (schema as unknown as { properties: Record<string, { deprecated?: boolean }> }).properties;
  assert.equal(properties["triggers"]?.deprecated, true);
  assert.equal(properties["priority"]?.deprecated, true);
});
