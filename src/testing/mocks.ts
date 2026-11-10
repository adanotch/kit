import type { JSONValue } from "./protocol.ts";

export interface MockRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

export interface MockResponse {
  /** Default 200. */
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  /** A string is sent as is; anything else as JSON (with `content-type: application/json`). */
  body?: string | JSONValue | object;
  url?: string;
}

/**
 * What Adanotch would answer, by request method. Throw to fail the request; the error's `name` picks the class the
 * extension sees (`NetworkError`, `TimeoutError`, `PermissionError`, …).
 */
export interface Mocks {
  fetch?: (request: MockRequest) => MockResponse | Promise<MockResponse>;
  "system.stats"?: () => unknown;
  "system.online"?: () => boolean;
  "system.appearance"?: () => "light" | "dark";
  "battery.read"?: () => unknown;
  "clipboard.readText"?: () => string | null;
  "clipboard.writeText"?: (params: { text: string }) => void;
  "media.nowPlaying"?: () => unknown;
  "media.control"?: (params: { command: string; seconds?: number }) => void;
  "timer.read"?: () => unknown;
  "timer.control"?: (params: { command: string }) => unknown;
  "calendar.events"?: (params: { days: number }) => unknown[];
  "reminders.today"?: () => unknown[];
  [method: string]: ((params: never) => unknown) | undefined;
}

/** A mock as the harness calls it: the specific parameter types are the test author's concern. */
export type AnyMock = (params: unknown) => unknown;

export const defaultMocks: Mocks = {
  "system.online": () => true,
  "system.appearance": () => "dark",
};
