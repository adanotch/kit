import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SourceMap } from "node:module";
import vm from "node:vm";
import { bundle } from "./bundle.ts";
import { defaultMocks } from "./mocks.ts";
import type { AnyMock, Mocks } from "./mocks.ts";
import type {
  ActivityMessage,
  JSONValue,
  LogLevel,
  NativeBridge,
  Reply,
  RequestMessage,
  RuntimeConfig,
  RuntimeHandle,
  RuntimeMessage,
  View,
  ViewNode,
} from "./protocol.ts";
import { mapStack, readInlineSourceMap } from "./stack.ts";
import { find, texts } from "./view.ts";

const runtimeSource = readFileSync(new URL("../runtime.js", import.meta.url), "utf8");

/** The parts of `manifest.json` the harness reads. */
export interface ExtensionManifest {
  id: string;
  main?: string;
  permissions?: string[];
  settings?: { key: string; type: string; default?: JSONValue }[];
  [field: string]: unknown;
}

export interface LoadOptions {
  /** The extension folder; default the current directory (where `npm test` runs). */
  root?: string;
  /** Default `src/index.ts`, bundled with esbuild like `npm run build`. */
  entry?: string;
  /** An already built bundle instead of `entry`. */
  script?: string;
  /** Default `manifest.json` in `root`. */
  manifest?: ExtensionManifest;
  /** Granted permissions; default all of the manifest's. Leave some out to test what happens without them. */
  permissions?: string[];
  /** Over the manifest's defaults. */
  settings?: Record<string, JSONValue>;
  /** `secret` settings, for `AdanotchKit.secrets.get`. */
  secrets?: Record<string, string>;
  /** What `storage` holds at start. */
  storage?: Record<string, JSONValue>;
  clipboard?: string | null;
  mocks?: Mocks;
  /** Also print the extension's console lines. */
  printLogs?: boolean;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
}

/** An error your code threw outside a call you awaited: during `update`, an action, an event or a timer. */
export interface ErrorEntry {
  during: string;
  message: string;
  id?: number | null;
}

export interface RequestEntry {
  method: string;
  params: JSONValue | null;
}

export type NotificationEntry = Extract<RuntimeMessage, { type: "notify" }>;

const STARTUP_FAILURES = new Set(["load", "setup", "update"]);

/**
 * An extension running on Adanotch's own runtime under Node, with Adanotch's side played by mocks. Obtain one with
 * `loadExtension`.
 */
export class TestExtension {
  readonly manifest: ExtensionManifest;
  readonly id: string;
  /** Everything the extension sent, in order. */
  readonly messages: RuntimeMessage[] = [];
  /** `console.*` lines. */
  readonly logs: LogEntry[] = [];
  /** Errors your code threw outside a call you awaited. */
  readonly errors: ErrorEntry[] = [];
  /** Every request to Adanotch: fetch, system.stats, open, … */
  readonly requests: RequestEntry[] = [];
  /** `notify.island(...)` calls. */
  readonly notifications: NotificationEntry[] = [];
  /** Names passed to `sound.play`. */
  readonly sounds: string[] = [];
  /** Commands passed to `timer.start()`, `pause()`, `reset()`, `skip()`, `select()` while `timer.control` isn't mocked. */
  readonly timerCommands: string[] = [];
  /** Activities from `island.show`, by id; `island.hide` removes them. */
  readonly activities = new Map<string, ActivityMessage>();
  /** What `storage` holds, decoded. */
  readonly storage: Record<string, JSONValue> = {};
  /** Event names the extension listens to. */
  readonly subscriptions = new Set<string>();
  /** URLs passed to `open()`. */
  readonly opened: string[] = [];
  /** What `clipboard.writeText` wrote last, and `readText` reads unless it is mocked. */
  clipboard: string | null;

  #view: View = { compact: null, expanded: null };
  readonly #options: LoadOptions;
  readonly #mocks: Mocks;
  readonly #secrets: Record<string, string>;
  readonly #script: string;
  readonly #sourceMap: SourceMap | null;
  readonly #config: RuntimeConfig;
  readonly #timers = new Map<number, number>();
  #clock = 0;
  #inFlight = 0;
  #nextOperation = 1;
  #runtime!: RuntimeHandle;

  private constructor(manifest: ExtensionManifest, script: string, options: LoadOptions) {
    this.manifest = manifest;
    this.id = manifest.id;
    this.clipboard = options.clipboard ?? null;
    this.#options = options;
    this.#mocks = { ...defaultMocks, ...options.mocks };
    this.#secrets = options.secrets ?? {};
    this.#script = script;
    this.#sourceMap = readInlineSourceMap(script);

    const storage: Record<string, string> = {};
    for (const [key, value] of Object.entries(options.storage ?? {})) {
      storage[key] = JSON.stringify(value);
      this.storage[key] = value;
    }
    this.#config = {
      extensionID: manifest.id,
      permissions: options.permissions ?? manifest.permissions ?? [],
      settings: { ...defaultSettings(manifest), ...options.settings },
      storage,
    };
  }

  /** Bundles (unless given a script), starts the extension and waits for `setup()` and the first `update()`. */
  static async create(manifest: ExtensionManifest, script: string, options: LoadOptions): Promise<TestExtension> {
    const extension = new TestExtension(manifest, script, options);
    await extension.#start();
    return extension;
  }

  /** The last view rendered. */
  get view(): View {
    return this.#view;
  }

  async #start(): Promise<void> {
    const native: NativeBridge = {
      send: (json) => this.#receive(JSON.parse(json) as RuntimeMessage),
      setTimer: (id, ms) => void this.#timers.set(id, this.#clock + ms),
      clearTimer: (id) => void this.#timers.delete(id),
      random: (count) => Array.from(randomBytes(count)),
      now: () => this.#clock,
      mapStack: (stack) => mapStack(stack, this.#sourceMap),
    };
    const context = vm.createContext({ __native: native });
    vm.runInContext(runtimeSource, context, { filename: "adanotch-runtime://runtime.js" });
    this.#runtime = vm.runInContext("__adanotchRuntime", context) as RuntimeHandle;
    vm.runInContext("delete globalThis.__adanotchRuntime", context);
    this.#runtime.configure(this.#config);
    try {
      vm.runInContext(this.#script, context, {
        filename: `extension://${this.id}/${this.manifest.main ?? "dist/index.js"}`,
        timeout: 1000,
      });
    } catch (error) {
      throw new Error(`The bundle threw while loading: ${this.#runtime.describe(error)}`, { cause: error });
    }
    void this.#runtime.start();
    await this.settle();
    const failed = this.errors.find((error) => STARTUP_FAILURES.has(error.during));
    if (failed) throw new Error(`${failed.during} failed: ${failed.message}`);
  }

  // MARK: Driving the extension

  /** Runs `update()`, as a refresh does. Rejects with the error `update()` threw. */
  update(): Promise<void> {
    return this.#operate({ type: "update" });
  }

  /** Uses a control: `onAction(action, ctx, value)`, then `update()`. */
  action(action: string, value: JSONValue = null): Promise<void> {
    return this.#operate({ type: "action", name: action, value });
  }

  /** Changes settings as the user would in Settings: `onSettingsChange`, then `update()`. */
  setSettings(values: Record<string, JSONValue>): Promise<void> {
    this.#config.settings = { ...this.#config.settings, ...values };
    return this.#operate({ type: "settings", settings: this.#config.settings });
  }

  /** Sends an event (`"media.change"`, `"command"`, …) to the extension's listeners; throws when it has none. */
  async emit(event: string, payload: unknown = null): Promise<void> {
    if (event !== "command" && !this.subscriptions.has(event)) {
      throw new Error(`The extension doesn't listen to "${event}"`);
    }
    this.#runtime.receive(JSON.stringify({ type: "event", name: event, payload }));
    await this.settle();
  }

  /** `adanotch ext <id> <name> [data]`. */
  command(name: string, data: JSONValue = null): Promise<void> {
    return this.emit("command", { name, data });
  }

  /** Moves the fake clock (timers, `performance.now()`) forward by `ms`, firing what comes due, in order. */
  async advance(ms: number): Promise<void> {
    const end = this.#clock + ms;
    for (;;) {
      const next = this.#nextTimer(end);
      if (!next) break;
      this.#clock = Math.max(this.#clock, next.due);
      this.#timers.delete(next.id);
      this.#runtime.fireTimer(next.id);
      // Timers fire one at a time, in order: each may schedule the next.
      // oxlint-disable-next-line no-await-in-loop
      await this.settle();
    }
    this.#clock = end;
    await this.settle();
  }

  /** Waits for promises, mocked requests and renders to finish. */
  async settle(): Promise<void> {
    for (let quiet = 0, rounds = 0; quiet < 3; rounds++) {
      if (rounds > 10_000) throw new Error("The extension never settled (a promise loop?)");
      const before = this.messages.length;
      // Polling until the extension is quiet: each round depends on the last.
      // oxlint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => setImmediate(resolve));
      quiet = this.#inFlight === 0 && this.messages.length === before ? quiet + 1 : 0;
    }
  }

  /** Stops timers; the extension can't run anymore. */
  stop(): void {
    this.#timers.clear();
  }

  // MARK: Reading what it shows

  /** Every text in the view or `node`: text, markdown, badges, labels, titles. */
  texts(node: unknown = this.#view): string[] {
    return texts(node);
  }

  /** The first node of `type`, depth first, matching `where` when given. */
  find(type: string, where: (node: ViewNode) => boolean = () => true, node: unknown = this.#view): ViewNode | null {
    return find(type, where, node);
  }

  // MARK: Messages from the runtime

  #nextTimer(until: number): { id: number; due: number } | null {
    let next: { id: number; due: number } | null = null;
    for (const [id, due] of this.#timers) {
      if (due > until) continue;
      if (next === null || due < next.due || (due === next.due && id < next.id)) next = { id, due };
    }
    return next;
  }

  async #operate(message: Record<string, unknown>): Promise<void> {
    const id = this.#nextOperation++;
    const errorsBefore = this.errors.length;
    this.#runtime.receive(JSON.stringify({ ...message, id }));
    await this.settle();
    const failed = this.errors.slice(errorsBefore).find((error) => error.id === id);
    if (failed) throw new Error(`${failed.during} failed: ${failed.message}`);
  }

  #receive(message: RuntimeMessage): void {
    this.messages.push(message);
    switch (message.type) {
      case "render":
        this.#view = message.view;
        break;
      case "log":
        this.logs.push({ level: message.level, message: message.message });
        if (this.#options.printLogs) console.log(`[${this.id}] ${message.message}`);
        break;
      case "error":
        this.errors.push({ during: message.during, message: message.message, id: message.id ?? null });
        break;
      case "storage":
        if (message.value === null) delete this.storage[message.key];
        else this.storage[message.key] = JSON.parse(message.value) as JSONValue;
        break;
      case "subscribe":
        if (message.on) this.subscriptions.add(message.event);
        else this.subscriptions.delete(message.event);
        break;
      case "notify":
        this.notifications.push(message);
        break;
      case "activity":
        if (message.remove) this.activities.delete(message.id);
        else this.activities.set(message.id, message);
        break;
      case "request":
        void this.#answer(message);
        break;
      case "started":
      case "done":
        break;
    }
  }

  async #answer({ id, method, params }: RequestMessage): Promise<void> {
    this.requests.push({ method, params });
    this.#inFlight += 1;
    let reply: Reply;
    try {
      const value = await this.#handle(method, (params ?? {}) as Record<string, unknown>);
      reply = { type: "reply", id, ok: true, value: (value === undefined ? null : value) as JSONValue };
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      reply = { type: "reply", id, ok: false, errorName: failure.name, error: failure.message };
    }
    this.#inFlight -= 1;
    this.#runtime.receive(JSON.stringify(reply));
  }

  /** Requests the harness answers itself unless a mock replaces them, then the mocks. */
  async #handle(method: string, params: Record<string, unknown>): Promise<unknown> {
    const mocked = method in this.#mocks && this.#mocks[method] !== undefined;
    switch (method) {
      case "fetch":
        return this.#fetch(params);
      case "secrets.get":
        return this.#secrets[String(params["key"])] ?? null;
      case "open":
        this.opened.push(String(params["url"]));
        return null;
      case "sound.play":
        this.sounds.push(String(params["name"]));
        return null;
      case "clipboard.writeText":
        if (!mocked) {
          this.clipboard = String(params["text"]);
          return null;
        }
        break;
      case "clipboard.readText":
        if (!mocked) return this.clipboard;
        break;
      case "media.control":
        if (!mocked) return null;
        break;
      case "timer.control":
        if (!mocked) {
          this.timerCommands.push(String(params["command"]));
          return this.#call("timer.read", {}) ?? null;
        }
        break;
      default:
        break;
    }
    if (!mocked) throw namedError("Error", `No mock for "${method}"; pass mocks: { "${method}": (params) => … }`);
    return this.#call(method, params);
  }

  #call(method: string, params: unknown): unknown {
    const mock = this.#mocks[method] as AnyMock | undefined;
    return mock?.(params);
  }

  async #fetch(params: Record<string, unknown>): Promise<unknown> {
    const mock = this.#mocks.fetch;
    const url = String(params["url"]);
    if (!mock) throw namedError("NetworkError", `No mock for fetch(${url}); pass mocks: { fetch: (request) => … }`);
    const response = await mock({
      url,
      method: String(params["method"]),
      headers: params["headers"] as Record<string, string>,
      body: params["body"] as string | null,
    });
    const isText = typeof response.body === "string" || response.body === undefined;
    const headers = { ...response.headers };
    if (!isText && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
      headers["content-type"] = "application/json";
    }
    return {
      status: response.status ?? 200,
      statusText: response.statusText ?? "",
      url: response.url ?? url,
      redirected: false,
      headers,
      body: response.body === undefined ? "" : isText ? response.body : JSON.stringify(response.body),
      encoding: "utf8",
    };
  }
}

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** The defaults of the manifest's settings, as the host starts the extension with them (secrets have none). */
function defaultSettings(manifest: ExtensionManifest): Record<string, JSONValue> {
  const values: Record<string, JSONValue> = {};
  for (const setting of manifest.settings ?? []) {
    if (setting.type !== "secret" && setting.default !== undefined) values[setting.key] = setting.default;
  }
  return values;
}

/** Reads `manifest.json`, bundles the entry unless a script is given, and starts the extension. */
export async function loadExtension(options: LoadOptions = {}): Promise<TestExtension> {
  const { join, resolve } = await import("node:path");
  const root = resolve(options.root ?? process.cwd());
  const manifest =
    options.manifest ?? (JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as ExtensionManifest);
  const script = options.script ?? (await bundle(resolve(root, options.entry ?? "src/index.ts")));
  return TestExtension.create(manifest, script, options);
}
