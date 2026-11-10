/** JSON as it crosses the line between an extension and Adanotch. */
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

/**
 * A node of a rendered view, as the extension sent it: `{ type: "text", value: "42%", tone: "warning" }`.
 * Tests read fields straight off it (`ext.view.compact?.trailing?.value`), so beyond `type` the shape is open.
 */
export interface ViewNode {
  type: string;
  // oxlint-disable-next-line typescript/no-explicit-any
  [field: string]: any;
}

/** What the extension last rendered: beside the notch (`compact`) and in the open card (`expanded`). */
export interface View {
  compact: { leading?: ViewNode | null; trailing?: ViewNode | null } | null;
  expanded: ViewNode | null;
}

export type LogLevel = "info" | "warning" | "error";

/** A message from the runtime to Adanotch (what the real runtime posts to the app, here recorded for tests). */
export type RuntimeMessage =
  | { type: "started" }
  | { type: "render"; view: View }
  | { type: "log"; level: LogLevel; message: string }
  | { type: "error"; during: string; message: string; id?: number | null }
  | { type: "storage"; key: string; value: string | null }
  | { type: "subscribe"; event: string; on: boolean }
  | { type: "notify"; text: string; icon?: string; tone?: string; duration?: number }
  | ActivityMessage
  | RequestMessage
  | { type: "done"; id: number | null; ms: number };

/** `island.show(...)` (with the activity's content) or `island.hide(id)` (`remove: true`). */
export interface ActivityMessage {
  type: "activity";
  id: string;
  remove?: true;
  compact?: ViewNode | null;
  expanded?: ViewNode | null;
  duration?: number | null;
}

/** The extension asks Adanotch for something: a fetch, system stats, opening a link… */
export interface RequestMessage {
  type: "request";
  id: number;
  method: string;
  params: JSONValue | null;
}

/** The answer to a request, sent back to the runtime. */
export type Reply =
  | { type: "reply"; id: number; ok: true; value: JSONValue }
  | { type: "reply"; id: number; ok: false; errorName: string; error: string };

/** What the host hands to `runtime.configure`. */
export interface RuntimeConfig {
  extensionID: string;
  permissions: string[];
  settings: Record<string, JSONValue>;
  /** Stored values, each already JSON encoded, as the real host keeps them. */
  storage: Record<string, string>;
}

/** What the runtime calls on its host: the functions Adanotch provides to the JavaScript context. */
export interface NativeBridge {
  send(json: string): void;
  setTimer(id: number, ms: number): void;
  clearTimer(id: number): void;
  random(count: number): number[];
  now(): number;
  mapStack(stack: string): string;
}

/** What the host calls on the runtime. */
export interface RuntimeHandle {
  configure(config: RuntimeConfig): void;
  start(): Promise<void>;
  receive(json: string): void;
  fireTimer(id: number): void;
  describe(error: unknown): string;
}
