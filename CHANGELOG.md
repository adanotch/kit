# Changelog

Every release, newest first. Deprecations are announced here and with `@deprecated` in the types; the entry says in
which version the API goes away.

## 0.2.0

The design system, as nodes. Everything here is optional and additive: a view written for 0.1.0 draws the same.

**Needs a newer Adanotch.** `alert`, `card` and `iconBadge` are new node types. An older Adanotch doesn't know them and
rejects the whole view that holds one, so use them only when your extension targets the Adanotch that ships 0.2.0.
Every other addition is an optional field that an older Adanotch ignores.

- `ui.alert(title, { message, tone, variant, button })`: a message under a header or above a form. `variant`:
  `ghost`, `tinted` or `border`.
- `ui.card(children, { variant, selected, action, value })`: a group of content on a card ground. `variant`:
  `bordered`, `borderless`, `tinted` or `brand`. With an `action` the whole card is a button.
- `ui.iconBadge(name, { tone, variant, size, round })`: a symbol on a tile.
- `ui.badge`: `dot`, `live` (a pulsing dot), `icon` and `filled`.
- `ui.button`: `variant` (`primary`, `secondary`, `outline`, `ghost`, `tinted`, `destructive`) and `size`. `primary`
  stays and means `variant: "primary"`.
- `ui.tabs(tabs, { style })`: `container` or `underline`.
- `ui.textField`: `icon`, `hint` and `invalid`.
- `ui.picker`: `style: "segmented"`.
- Testing: `texts()` reads an alert's `message` and a field's `hint`.

Not in the kit, on purpose: the Pro badge, module hues and raw colours (a `tone` is a meaning, and `swatch` is the one
colour you pick), and the window surface (extensions draw on the island).

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
