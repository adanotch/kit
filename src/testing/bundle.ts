import type * as Esbuild from "esbuild";

type EsbuildModule = Pick<typeof Esbuild, "build">;

/** Loads esbuild; replaceable so a missing install can be tested. */
export type EsbuildLoader = () => Promise<EsbuildModule>;

const loadEsbuild: EsbuildLoader = () => import("esbuild");

const isMissingEsbuild = (error: unknown): boolean =>
  error instanceof Error &&
  (error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND" &&
  error.message.includes("esbuild");

/** Bundles `entry` the way `npm run build` does (one IIFE, inline source map) and returns the script. */
export async function bundle(entry: string, load: EsbuildLoader = loadEsbuild): Promise<string> {
  let esbuild: EsbuildModule;
  try {
    esbuild = await load();
  } catch (error) {
    if (!isMissingEsbuild(error)) throw error;
    throw new Error(
      `@adanotch/kit/testing bundles ${entry} with esbuild, which isn't installed. ` +
        `Run: npm install --save-dev esbuild (or pass { script } with an already built bundle).`,
      { cause: error },
    );
  }
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    target: "es2020",
    sourcemap: "inline",
    write: false,
    logLevel: "silent",
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error(`esbuild produced no output for ${entry}`);
  return output.text;
}
