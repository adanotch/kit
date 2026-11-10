// Globals an extension can use: the AdanotchKit object, its errors and the web APIs Adanotch provides.
// Part of the Adanotch extension API; see index.d.ts.

/** The Adanotch extension API. Calling an API without its permission throws a PermissionError. */
declare const AdanotchKit: Adanotch.Kit;

// MARK: Errors

/** An API, event or host your manifest.json doesn't ask for (or the user turned off). */
declare class PermissionError extends Error {}
/** No connection, DNS failure, refused connection, or a response over 5 MB. */
declare class NetworkError extends Error {}
/** A request took longer than its `timeout` (15 s unless set). */
declare class TimeoutError extends Error {}
/** `storage.set` past 512 KB. */
declare class QuotaExceededError extends Error {}

// MARK: Web APIs (the parts Adanotch provides)

/** Goes to Settings › Developer › Log and to `adanotch dev`; 200 lines per 10 s, 2000 characters each. */
declare const console: {
  log(...values: unknown[]): void;
  info(...values: unknown[]): void;
  debug(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
};

/** At most 200 timers at once; intervals run every 50 ms at the fastest. */
declare function setTimeout<A extends unknown[]>(callback: (...args: A) => void, ms?: number, ...args: A): number;
declare function setInterval<A extends unknown[]>(callback: (...args: A) => void, ms?: number, ...args: A): number;
declare function clearTimeout(id: number | undefined): void;
declare function clearInterval(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;
/** JSON-only: Dates become strings, Maps and functions are lost. */
declare function structuredClone<T>(value: T): T;

type HeadersInit = Headers | Record<string, string> | [string, string][];

interface RequestInit {
  /** GET, POST, PUT, PATCH, DELETE or HEAD. */
  method?: string;
  headers?: HeadersInit;
  /** A string is sent as is; `URLSearchParams` as a form; any other value as JSON. Up to 1 MB. */
  body?: string | URLSearchParams | Adanotch.JSONValue | object;
  /** Milliseconds, 1000–60000; default 15000. */
  timeout?: number;
}

/**
 * HTTPS only, to hosts listed as `network:<domain>` permissions (redirects too). No cookies or cache; responses up to
 * 5 MB; 6 requests at once and 120 a minute. Rejects with `NetworkError`, `TimeoutError` or `PermissionError`.
 */
declare function fetch(input: string | URL, init?: RequestInit): Promise<Response>;

declare class Headers {
  constructor(init?: HeadersInit);
  get(name: string): string | null;
  set(name: string, value: string): void;
  append(name: string, value: string): void;
  has(name: string): boolean;
  delete(name: string): void;
  forEach(callback: (value: string, name: string, headers: Headers) => void): void;
  entries(): IterableIterator<[string, string]>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}

declare class Response {
  readonly status: number;
  readonly statusText: string;
  /** `status` is 200–299. */
  readonly ok: boolean;
  /** The final URL, after redirects. */
  readonly url: string;
  readonly redirected: boolean;
  readonly headers: Headers;
  readonly bodyUsed: boolean;
  text(): Promise<string>;
  // `any` as in the web standard's `Response.json()`: the body of an API you call is yours to describe.
  // oxlint-disable-next-line typescript/no-explicit-any
  json<T = any>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
  bytes(): Promise<Uint8Array>;
}

declare class URLSearchParams {
  constructor(init?: string | Record<string, string | number | boolean> | [string, string][]);
  append(name: string, value: string | number | boolean): void;
  set(name: string, value: string | number | boolean): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  delete(name: string): void;
  forEach(callback: (value: string, name: string, params: URLSearchParams) => void): void;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  entries(): IterableIterator<[string, string]>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
  readonly size: number;
  toString(): string;
}

declare class URL {
  constructor(url: string, base?: string | URL);
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  pathname: string;
  hash: string;
  search: string;
  searchParams: URLSearchParams;
  readonly host: string;
  readonly origin: string;
  readonly href: string;
  toString(): string;
  toJSON(): string;
}

declare class TextEncoder {
  readonly encoding: "utf-8";
  encode(text?: string): Uint8Array;
}

declare class TextDecoder {
  readonly encoding: "utf-8";
  decode(bytes?: Uint8Array | ArrayBuffer): string;
}

declare function atob(base64: string): string;
declare function btoa(latin1: string): string;

declare const performance: {
  /** Milliseconds since an arbitrary start; never goes backwards. */
  now(): number;
};

declare const crypto: {
  getRandomValues<
    T extends Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array,
  >(
    array: T,
  ): T;
  randomUUID(): string;
};
