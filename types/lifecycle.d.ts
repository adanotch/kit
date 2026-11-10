// Storage, network and the extension lifecycle (setup, update, actions, settings).
// Part of the Adanotch extension API; see index.d.ts.

declare namespace Adanotch {
  // MARK: Storage and network

  /** Per-extension store for JSON values, kept across restarts; 512 KB in all. */
  interface Storage {
    get<T = JSONValue>(key: string): T | null;
    /** Stored as JSON: Dates become strings, Maps and functions are lost. Throws a `QuotaExceededError` past 512 KB. `undefined` removes the key. */
    set(key: string, value: JSONValue | object | undefined): void;
    remove(key: string): void;
    keys(): string[];
    clear(): void;
  }

  interface Network {
    /** `fetch(url, init)` then `.json()`. */
    fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T>;
    /** Whether `fetch` may reach this URL: https and one of your `network:` hosts. */
    isAllowed(url: string): boolean;
  }

  // MARK: Lifecycle

  interface Context<S> {
    readonly extensionID: string;
    /** Values of the `settings` declared in manifest.json, as the user set them (not `secret` ones). */
    readonly settings: S;
    readonly storage: Storage;
    readonly network: Network;
    /** Shows a view now, without waiting for `update()`: keys you pass replace, `null` removes, the rest stays. */
    render(view: View): void;
    /** Runs `update()` again now (right after the one in flight, if any). */
    refresh(): void;
  }

  interface Extension<S> {
    /** Once, when the extension starts: subscribe to events, start timers, load what `update()` needs. */
    setup?(ctx: Context<S>): void | Promise<void>;
    /**
     * Builds the view. Runs after `setup`, every `refresh` from manifest.json, after `onAction` and
     * `onSettingsChange`, and on `ctx.refresh()`. Overlapping runs merge: a refresh asked for while one runs
     * starts once it ends. Return the view, or render it yourself with `ctx.render` and return nothing.
     */
    update?(ctx: Context<S>): View | void | Promise<View | void>;
    /** A control with this `action` was used; `value` is what it carries. `update` runs right after. */
    onAction?(action: string, ctx: Context<S>, value: JSONValue): void | Promise<void>;
    /** The user changed a setting; `ctx.settings` already has the new values. `update` runs right after. */
    onSettingsChange?(ctx: Context<S>): void | Promise<void>;
  }
}
