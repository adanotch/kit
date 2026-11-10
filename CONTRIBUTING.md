# Contributing

## Setup

```sh
npm install
npm run check   # lint, format, typecheck, tests, the package itself: what CI runs
```

Node 22.18 or newer. The source is TypeScript that Node runs directly (type stripping), so tests need no build step.

## Layout

| Path             | What it is                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `types/`         | The public API as global declarations, one file per topic, `index.d.ts` loads them.              |
| `src/runtime.js` | The runtime every extension runs on. **Adanotch embeds this exact file** (see below).            |
| `src/testing/`   | The test kit (`loadExtension`), TypeScript; `dist/` is compiled from it.                         |
| `schema/`        | The JSON Schema of `manifest.json`.                                                              |
| `contract/`      | Valid view nodes of every type: `nodes.ts` is the source, `nodes.json` is generated.             |
| `test/`          | Harness, schema, contract and type tests, plus `test/package` which installs the packed tarball. |

## How Adanotch uses this repository

The Adanotch app includes this repository as a git submodule, pinned to a release tag. It loads `src/runtime.js` into
its JavaScript engine and tests its Swift view decoder against `contract/nodes.json`. So a change here is a change to
the app's contract:

- A new or changed node, API or event: update `types/`, the runtime, the schema if a manifest field or permission is
  involved, and `contract/nodes.ts` (then `npm run contract`). The compiler refuses a node type missing from the
  corpus, and the tests send every node through the real runtime.
- Removing something: mark it `@deprecated` with the replacement and the release it goes away in, and list it in
  `CHANGELOG.md`.
- The app must implement what the types promise. Release only after the app side is ready, then pin the new tag there.

## Releasing

1. Update `version` in `package.json` and write the `CHANGELOG.md` entry.
2. `npm run check`, commit, and tag `vX.Y.Z`.
3. Pushing the tag runs the release workflow: it checks the tag matches `package.json` and publishes with provenance.
