// Adanotch extension API. Everything here is global (`AdanotchKit`, `fetch`, `setTimeout`, …); there is nothing to import.
//
// Your script runs in its own process on JavaScriptCore: no DOM, no Node. A synchronous stretch of code (one "turn")
// may take 200 ms at most; await network calls and timers instead of busy-waiting.
//
// Load it with `"types": ["@adanotch/kit"]` in tsconfig.json.

/// <reference path="./view.d.ts" />
/// <reference path="./lifecycle.d.ts" />
/// <reference path="./data.d.ts" />
/// <reference path="./events.d.ts" />
/// <reference path="./kit.d.ts" />
/// <reference path="./globals.d.ts" />
