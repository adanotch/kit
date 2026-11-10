import { loadExtension } from "../../src/testing/index.ts";
import type { ExtensionManifest, LoadOptions, TestExtension } from "../../src/testing/index.ts";

export const manifest = (overrides: Partial<ExtensionManifest> = {}): ExtensionManifest => ({
  id: "local.kit.test",
  name: "Test",
  version: "0.1.0",
  adanotchVersion: ">=0.1.0",
  main: "dist/index.js",
  slots: ["compact", "expanded"],
  permissions: [],
  ...overrides,
});

/** Starts `script` (a built bundle: JavaScript that calls `AdanotchKit.activity`) on the runtime. */
export function load(
  script: string,
  options: Omit<LoadOptions, "manifest"> & { manifest?: Partial<ExtensionManifest> } = {},
): Promise<TestExtension> {
  const { manifest: overrides, ...rest } = options;
  return loadExtension({ ...rest, manifest: manifest(overrides), script });
}
