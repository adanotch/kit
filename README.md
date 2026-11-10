# @adanotch/kit

Types and a test kit for [Adanotch](https://www.adanotch.com) extensions.

An extension is a TypeScript program bundled to one JavaScript file. It runs in its own process and draws its view
beside the MacBook notch. This package is what your editor and your tests need to know about that environment.

| Import                               | What it is                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `@adanotch/kit`                      | The `AdanotchKit` global and the `Adanotch` namespace, as types. Nothing to import at runtime.    |
| `@adanotch/kit/testing`              | `loadExtension`: runs your extension under Node on Adanotch's own runtime, with answers you mock. |
| `@adanotch/kit/manifest.schema.json` | The JSON Schema of `manifest.json`.                                                               |

Guide and API reference: <https://www.adanotch.com/docs/en>. Working examples: [adanotch/kit-examples](https://github.com/adanotch/kit-examples).

## Use it

```sh
npm install --save-dev @adanotch/kit esbuild typescript
```

Load the types in `tsconfig.json`:

```json
{
  "compilerOptions": { "types": ["@adanotch/kit"], "strict": true, "noEmit": true },
  "include": ["src"]
}
```

Point `manifest.json` at the schema for completion and deprecation hints:

```json
{ "$schema": "./node_modules/@adanotch/kit/manifest.schema.json" }
```

Test your extension:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadExtension } from "@adanotch/kit/testing";

test("shows the temperature", async () => {
  const ext = await loadExtension({ mocks: { fetch: () => ({ body: { temp: 18 } }) } });
  assert.ok(ext.texts().includes("18°"));
});
```

`loadExtension` bundles `src/index.ts` with esbuild (a peer dependency, only needed for testing) and runs it on the same
runtime Adanotch uses; pass `{ script }` to test an already built bundle. It needs Node 22.18 or newer.

What you can read and drive on the result: `view`, `texts()`, `find()`, `action()`, `setSettings()`, `emit()`,
`command()`, `advance()` (a fake clock), and what the extension did: `requests`, `notifications`, `activities`,
`storage`, `opened`, `sounds`, `logs`, `errors`.

## Versions

The package follows [SemVer](https://semver.org). `adanotch.minimumAppVersion` in its `package.json` is the oldest
Adanotch app that implements the API the types describe. An extension that uses an API newer than the Adanotch a user
runs fails there, so set `adanotchVersion` in your manifest to the oldest Adanotch you support.

Removing an API is announced first: it is marked `@deprecated` in the types with the replacement and the release it
goes away in (editors strike it through), and listed in the [changelog](CHANGELOG.md). While the version is `0.x`, a
minor release may remove what was deprecated.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). `npm run check` runs everything CI does.

## License

[MIT](LICENSE)
