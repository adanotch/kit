import { SourceMap } from "node:module";

const SOURCE_MAP_COMMENT = /\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)\s*$/;

/** The inline source map esbuild appends to a bundle, if there is one and it parses. */
export function readInlineSourceMap(script: string): SourceMap | null {
  const match = SOURCE_MAP_COMMENT.exec(script);
  const encoded = match?.[1];
  if (!encoded) return null;
  try {
    return new SourceMap(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")));
  } catch {
    return null;
  }
}

const V8_FRAME = /^\s+at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?$/;

/**
 * V8's `    at fn (file:line:col)` into JavaScriptCore's `fn@file:line:col`, which the runtime reads. Only the
 * extension's own frames are kept, as in Adanotch; the test runner's are dropped. With a source map the position is
 * the one in the TypeScript source.
 */
export function mapStack(stack: string, sourceMap: SourceMap | null): string {
  return String(stack)
    .split("\n")
    .filter((line) => /^\s+at /.test(line))
    .map((line) => {
      const match = V8_FRAME.exec(line);
      if (!match) return "";
      const [, fn = "", file = "", row = "0", column = "0"] = match;
      if (!file.startsWith("extension://")) return "";
      let where = `${file}:${row}:${column}`;
      const entry = sourceMap?.findEntry(Number(row) - 1, Number(column) - 1);
      if (entry && "originalSource" in entry && entry.originalSource) {
        const source = entry.originalSource.replace(/^(\.\.\/)+/, "").replace(/^file:\/\/.*?\/(src\/)/, "$1");
        where = `${source}:${entry.originalLine + 1}:${entry.originalColumn + 1}`;
      }
      return `${fn}@${where}`;
    })
    .filter(Boolean)
    .join("\n");
}
