# Changelog

Every release, newest first. Deprecations are announced here and with `@deprecated` in the types; the entry says in
which version the API goes away.

## 0.1.0

First release.

- `@adanotch/kit`: the `AdanotchKit` global and the `Adanotch` namespace, as types.
- `@adanotch/kit/testing`: `loadExtension`, which runs your extension under Node on Adanotch's own runtime with the
  answers you mock. A missing `esbuild` is explained instead of failing with Node's module error.
- `@adanotch/kit/manifest.schema.json`: the JSON Schema of `manifest.json`. It accepts every permission the app does
  (`timer.read`, `timer.control`, `devices.read` and `files.drop` were missing).
- Companion poses: the ten newer ones (`recording`, `posing`, `celebrating`, `dizzy`, `melting`, `yawning`,
  `nightShift`, `alert`, `zen`, `searching`) are part of `PetPose`.
- Deprecated and ignored: the `triggers` and `priority` manifest fields. Subscribe to events in code with
  `AdanotchKit.events.on(...)`; the user decides the order in Settings.
