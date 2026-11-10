// Writes contract/nodes.json from contract/nodes.ts, for the consumers that are not TypeScript (Adanotch's Swift tests).
// `--check` writes nothing and fails when the file is behind.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nodes } from "../contract/nodes.ts";

const target = join(dirname(fileURLToPath(import.meta.url)), "../contract/nodes.json");
const json = `${JSON.stringify(nodes, null, 2)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    // Missing counts as behind.
  }
  if (current !== json) {
    console.error("contract/nodes.json is behind contract/nodes.ts; run `npm run contract`.");
    process.exit(1);
  }
} else {
  writeFileSync(target, json);
}
