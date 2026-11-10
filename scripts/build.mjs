// Builds dist/: the test kit compiled from src/testing (JavaScript and declarations) and the runtime it runs on.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });

const tsc = spawnSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"], {
  cwd: root,
  stdio: "inherit",
});
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

// The harness loads the runtime from next to its folder (`../runtime.js`), in src/ and in dist/ alike.
mkdirSync(dist, { recursive: true });
cpSync(join(root, "src/runtime.js"), join(dist, "runtime.js"));
