// Adanotch extension runtime: the `AdanotchKit` global and the web APIs an extension can use.
//
// It runs before the extension's bundle, in the extension's own worker process (JavaScriptCore), and under Node in
// `adanotch/testing.js`. It reaches the host only through `__native`, which it takes off the global object:
//   send(json)            one message to Adanotch (see ExtensionWireProtocol.swift)
//   setTimer(id, ms)      call __adanotchRuntime.fireTimer(id) after ms
//   clearTimer(id)
//   random(count)         cryptographically random bytes
//   now()                 monotonic milliseconds
//   mapStack(stack)       rewrites bundle positions to source positions (source maps)
// Adanotch drives it through `__adanotchRuntime.configure(config)`, `.start()` and `.receive(json)`.
(function (global) {
  "use strict";

  const native = global.__native;
  delete global.__native;

  // MARK: Limits (kept in step with the host, which enforces them again)

  const LIMITS = {
    timers: 200,
    minIntervalMs: 50,
    logLines: 200, // per 10 s
    storageBytes: 512 * 1024,
    messageBytes: 2 * 1024 * 1024,
  };

  let config = { extensionID: "", permissions: [], settings: {}, storage: {}, manifest: {} };
  let permissions = new Set();
  let networkDomains = [];
  let extension = null;
  let started = false;

  function send(message) {
    let json;
    try {
      json = JSON.stringify(message);
    } catch (error) {
      reportError("render", new TypeError("Value can't be sent to Adanotch: " + error.message));
      return false;
    }
    if (json.length > LIMITS.messageBytes) {
      reportError("render", new RangeError("Message over " + LIMITS.messageBytes / 1048576 + " MB was dropped"));
      return false;
    }
    native.send(json);
    return true;
  }

  // MARK: Errors

  class PermissionError extends Error {}
  PermissionError.prototype.name = "PermissionError";
  class NetworkError extends Error {}
  NetworkError.prototype.name = "NetworkError";
  class TimeoutError extends Error {}
  TimeoutError.prototype.name = "TimeoutError";
  class QuotaExceededError extends Error {}
  QuotaExceededError.prototype.name = "QuotaExceededError";

  function deny(permission) {
    throw new PermissionError(
      "'" + permission + "' is not granted to " + config.extensionID + ". Add it to \"permissions\" in manifest.json.",
    );
  }

  function requirePermission(permission) {
    if (!permissions.has(permission)) deny(permission);
  }

  /** "TypeError: x is not a function\n    at update (src/index.ts:12:5)". */
  function describe(error) {
    if (!(error instanceof Error)) {
      return "Uncaught " + safeString(error);
    }
    let text = error.name + ": " + error.message;
    const stack = typeof error.stack === "string" ? native.mapStack(error.stack) : "";
    const frames = stack
      .split("\n")
      .filter((line) => line && !line.startsWith("[native code]") && line.indexOf("adanotch-runtime") === -1)
      .slice(0, 6)
      .map((line) => {
        const at = line.lastIndexOf("@");
        const fn = at > 0 ? line.slice(0, at) : "";
        const where = at >= 0 ? line.slice(at + 1) : line;
        return "    at " + (fn && fn !== "global code" ? fn + " (" + where + ")" : where);
      });
    if (frames.length) text += "\n" + frames.join("\n");
    return text;
  }

  function reportError(during, error, id) {
    send({ type: "error", during, message: describe(error), id });
  }

  function safeString(value) {
    if (typeof value === "string") return value;
    if (value instanceof Error) return describe(value);
    try {
      const json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch (_) {
      return String(value);
    }
  }

  // MARK: console

  let logWindowStart = 0;
  let logCount = 0;
  let logDropped = false;

  function writer(level) {
    return function (...values) {
      const now = native.now();
      if (now - logWindowStart > 10000) {
        logWindowStart = now;
        logCount = 0;
        logDropped = false;
      }
      if (logCount >= LIMITS.logLines) {
        if (!logDropped) {
          logDropped = true;
          send({ type: "log", level: "warning", message: "console: over " + LIMITS.logLines + " lines in 10 s, dropping the rest" });
        }
        return;
      }
      logCount += 1;
      send({ type: "log", level, message: values.map(safeString).join(" ").slice(0, 2000) });
    };
  }

  const console = {
    log: writer("info"),
    info: writer("info"),
    debug: writer("info"),
    warn: writer("warning"),
    error: writer("error"),
  };

  // MARK: Timers

  const timers = new Map();
  let nextTimerID = 1;

  function addTimer(callback, ms, args, repeats) {
    if (typeof callback !== "function") throw new TypeError("Timer callback must be a function");
    if (timers.size >= LIMITS.timers) throw new RangeError("More than " + LIMITS.timers + " timers");
    const id = nextTimerID++;
    const delay = Math.max(repeats ? LIMITS.minIntervalMs : 0, Number(ms) || 0);
    timers.set(id, { callback, args, repeats, delay });
    native.setTimer(id, delay);
    return id;
  }

  function clearTimer(id) {
    if (timers.delete(id)) native.clearTimer(id);
  }

  function fireTimer(id) {
    const timer = timers.get(id);
    if (!timer) return;
    if (timer.repeats) {
      native.setTimer(id, timer.delay);
    } else {
      timers.delete(id);
    }
    try {
      const result = timer.callback(...timer.args);
      if (result && typeof result.then === "function") result.then(undefined, (error) => reportError("timer", error));
    } catch (error) {
      reportError("timer", error);
    }
  }

  // MARK: Requests to Adanotch

  const pending = new Map();
  let nextRequestID = 1;

  const errorTypes = { PermissionError, NetworkError, TimeoutError, QuotaExceededError, TypeError, RangeError };

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextRequestID++;
      pending.set(id, { resolve, reject });
      if (!send({ type: "request", id, method, params: params === undefined ? null : params })) {
        pending.delete(id);
        reject(new RangeError("Request too large"));
      }
    });
  }

  function settle(message) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.ok) {
      waiter.resolve(message.value === undefined ? null : message.value);
    } else {
      const ErrorType = errorTypes[message.errorName] || Error;
      waiter.reject(new ErrorType(message.error || "Request failed"));
    }
  }

  // MARK: Encoding helpers (no DOM in JavaScriptCore)

  const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const base64Lookup = {};
  for (let i = 0; i < base64Alphabet.length; i++) base64Lookup[base64Alphabet[i]] = i;
  base64Lookup["-"] = 62;
  base64Lookup["_"] = 63;

  function bytesToBase64(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      out += base64Alphabet[a >> 2] + base64Alphabet[((a & 3) << 4) | (b >> 4)];
      out += i + 1 < bytes.length ? base64Alphabet[((b & 15) << 2) | (c >> 6)] : "=";
      out += i + 2 < bytes.length ? base64Alphabet[c & 63] : "=";
    }
    return out;
  }

  function base64ToBytes(text) {
    const clean = String(text).replace(/[\s=]/g, "");
    const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
    let buffer = 0;
    let bits = 0;
    let index = 0;
    for (const char of clean) {
      const value = base64Lookup[char];
      if (value === undefined) throw new TypeError("Invalid base64 character '" + char + "'");
      buffer = (buffer << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out[index++] = (buffer >> bits) & 0xff;
      }
    }
    return out.subarray(0, index);
  }

  function utf8Encode(text) {
    const string = String(text);
    const out = [];
    for (let i = 0; i < string.length; i++) {
      let code = string.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < string.length) {
        const next = string.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          i++;
        }
      }
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
      else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    }
    return new Uint8Array(out);
  }

  function utf8Decode(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input.buffer || input);
    let out = "";
    for (let i = 0; i < bytes.length; ) {
      const a = bytes[i++];
      let code;
      if (a < 0x80) code = a;
      else if (a >= 0xf0) code = ((a & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      else if (a >= 0xe0) code = ((a & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      else if (a >= 0xc0) code = ((a & 31) << 6) | (bytes[i++] & 63);
      else code = 0xfffd;
      out += String.fromCodePoint(code);
    }
    return out;
  }

  class TextEncoder {
    get encoding() {
      return "utf-8";
    }
    encode(text = "") {
      return utf8Encode(text);
    }
  }

  class TextDecoder {
    get encoding() {
      return "utf-8";
    }
    decode(bytes) {
      return bytes === undefined ? "" : utf8Decode(bytes);
    }
  }

  function btoa(text) {
    const string = String(text);
    const bytes = new Uint8Array(string.length);
    for (let i = 0; i < string.length; i++) {
      const code = string.charCodeAt(i);
      if (code > 255) throw new TypeError("btoa: characters outside Latin-1; encode with TextEncoder first");
      bytes[i] = code;
    }
    return bytesToBase64(bytes);
  }

  function atob(text) {
    let out = "";
    for (const byte of base64ToBytes(text)) out += String.fromCharCode(byte);
    return out;
  }

  // MARK: URL, URLSearchParams

  class URLSearchParams {
    constructor(init) {
      this._entries = [];
      if (typeof init === "string") {
        for (const part of init.replace(/^\?/, "").split("&")) {
          if (!part) continue;
          const eq = part.indexOf("=");
          const key = eq < 0 ? part : part.slice(0, eq);
          const value = eq < 0 ? "" : part.slice(eq + 1);
          this._entries.push([decode(key), decode(value)]);
        }
      } else if (Array.isArray(init)) {
        for (const [key, value] of init) this.append(key, value);
      } else if (init && typeof init === "object") {
        for (const key of Object.keys(init)) this.append(key, init[key]);
      }
      function decode(text) {
        try {
          return decodeURIComponent(text.replace(/\+/g, " "));
        } catch (_) {
          return text;
        }
      }
    }
    append(key, value) {
      this._entries.push([String(key), String(value)]);
    }
    set(key, value) {
      this.delete(key);
      this.append(key, value);
    }
    get(key) {
      const entry = this._entries.find((pair) => pair[0] === String(key));
      return entry ? entry[1] : null;
    }
    getAll(key) {
      return this._entries.filter((pair) => pair[0] === String(key)).map((pair) => pair[1]);
    }
    has(key) {
      return this._entries.some((pair) => pair[0] === String(key));
    }
    delete(key) {
      this._entries = this._entries.filter((pair) => pair[0] !== String(key));
    }
    forEach(callback) {
      for (const [key, value] of this._entries) callback(value, key, this);
    }
    keys() {
      return this._entries.map((pair) => pair[0])[Symbol.iterator]();
    }
    values() {
      return this._entries.map((pair) => pair[1])[Symbol.iterator]();
    }
    entries() {
      return this._entries.map((pair) => pair.slice())[Symbol.iterator]();
    }
    [Symbol.iterator]() {
      return this.entries();
    }
    get size() {
      return this._entries.length;
    }
    toString() {
      return this._entries
        .map(([key, value]) => encodeURIComponent(key) + "=" + encodeURIComponent(value))
        .join("&")
        .replace(/%20/g, "+");
    }
  }

  const urlPattern = /^([a-zA-Z][a-zA-Z0-9+.-]*:)\/\/(?:([^:@/]*)(?::([^@/]*))?@)?([^:/?#]*)(?::(\d+))?([^?#]*)(\?[^#]*)?(#.*)?$/;

  class URL {
    constructor(input, base) {
      let text = String(input);
      if (base !== undefined && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) {
        const root = new URL(base);
        if (text.startsWith("//")) text = root.protocol + text;
        else if (text.startsWith("/")) text = root.origin + text;
        else if (text.startsWith("?")) text = root.origin + root.pathname + text;
        else if (text.startsWith("#")) text = root.origin + root.pathname + root.search + text;
        else text = root.origin + root.pathname.replace(/[^/]*$/, "") + text;
      }
      const match = urlPattern.exec(text);
      if (!match) throw new TypeError("Invalid URL: " + text);
      this.protocol = match[1].toLowerCase();
      this.username = match[2] || "";
      this.password = match[3] || "";
      this.hostname = match[4].toLowerCase();
      this.port = match[5] || "";
      this.pathname = normalizePath(match[6] || "/");
      this.searchParams = new URLSearchParams(match[7] || "");
      this.hash = match[8] || "";
    }
    get host() {
      return this.hostname + (this.port ? ":" + this.port : "");
    }
    get origin() {
      return this.protocol + "//" + this.host;
    }
    get search() {
      const query = this.searchParams.toString();
      return query ? "?" + query : "";
    }
    set search(value) {
      this.searchParams = new URLSearchParams(String(value));
    }
    get href() {
      const auth = this.username ? this.username + (this.password ? ":" + this.password : "") + "@" : "";
      return this.protocol + "//" + auth + this.host + this.pathname + this.search + this.hash;
    }
    toString() {
      return this.href;
    }
    toJSON() {
      return this.href;
    }
  }

  function normalizePath(path) {
    const out = [];
    for (const segment of path.split("/")) {
      if (segment === "..") out.pop();
      else if (segment !== ".") out.push(segment);
    }
    const joined = out.join("/");
    return joined.startsWith("/") ? joined : "/" + joined;
  }

  // MARK: fetch

  function allowedHost(hostname) {
    return networkDomains.some((domain) => hostname === domain || hostname.endsWith("." + domain));
  }

  function checkNetworkTarget(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      throw new TypeError("Invalid URL: " + url);
    }
    if (parsed.protocol !== "https:") throw new PermissionError("Only https:// URLs are allowed (got " + url + ")");
    if (!allowedHost(parsed.hostname)) deny("network:" + parsed.hostname);
    return parsed;
  }

  class Headers {
    constructor(init) {
      this._map = {};
      if (init instanceof Headers) init.forEach((value, key) => this.set(key, value));
      else if (Array.isArray(init)) for (const [key, value] of init) this.append(key, value);
      else if (init) for (const key of Object.keys(init)) this.set(key, init[key]);
    }
    get(name) {
      const value = this._map[String(name).toLowerCase()];
      return value === undefined ? null : value;
    }
    set(name, value) {
      this._map[String(name).toLowerCase()] = String(value);
    }
    append(name, value) {
      const key = String(name).toLowerCase();
      this._map[key] = this._map[key] === undefined ? String(value) : this._map[key] + ", " + value;
    }
    has(name) {
      return this._map[String(name).toLowerCase()] !== undefined;
    }
    delete(name) {
      delete this._map[String(name).toLowerCase()];
    }
    forEach(callback) {
      for (const key of Object.keys(this._map)) callback(this._map[key], key, this);
    }
    entries() {
      return Object.entries(this._map)[Symbol.iterator]();
    }
    [Symbol.iterator]() {
      return this.entries();
    }
    toObject() {
      return Object.assign({}, this._map);
    }
  }

  class Response {
    constructor(raw) {
      this.status = raw.status;
      this.statusText = raw.statusText || "";
      this.ok = raw.status >= 200 && raw.status < 300;
      this.url = raw.url;
      this.headers = new Headers(raw.headers || {});
      this.redirected = Boolean(raw.redirected);
      this._raw = raw;
      this.bodyUsed = false;
    }
    _consume() {
      if (this.bodyUsed) return Promise.reject(new TypeError("Body has already been read"));
      this.bodyUsed = true;
      return Promise.resolve(this._raw);
    }
    async text() {
      const raw = await this._consume();
      return raw.encoding === "base64" ? utf8Decode(base64ToBytes(raw.body)) : raw.body;
    }
    async json() {
      const text = await this.text();
      try {
        return JSON.parse(text);
      } catch (_) {
        throw new SyntaxError("Response from " + this.url + " is not JSON: " + text.slice(0, 80));
      }
    }
    async arrayBuffer() {
      const raw = await this._consume();
      const bytes = raw.encoding === "base64" ? base64ToBytes(raw.body) : utf8Encode(raw.body);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    async bytes() {
      return new Uint8Array(await this.arrayBuffer());
    }
  }

  async function fetch(input, init) {
    const options = init || {};
    const url = typeof input === "string" ? input : input && input.url ? input.url : String(input);
    checkNetworkTarget(url);
    const headers = new Headers(options.headers);
    let body = options.body;
    if (body !== undefined && body !== null && typeof body !== "string") {
      if (body instanceof URLSearchParams) {
        body = body.toString();
        if (!headers.has("content-type")) headers.set("content-type", "application/x-www-form-urlencoded");
      } else if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
        throw new TypeError("fetch: binary request bodies aren't supported; send text or JSON");
      } else {
        body = JSON.stringify(body);
        if (!headers.has("content-type")) headers.set("content-type", "application/json");
      }
    }
    const raw = await request("fetch", {
      url,
      method: String(options.method || "GET").toUpperCase(),
      headers: headers.toObject(),
      body: body === undefined ? null : body,
      timeoutMs: options.timeout === undefined ? null : Number(options.timeout),
    });
    return new Response(raw);
  }

  // MARK: Storage

  let storageValues = {};
  let storageBytes = 0;

  function measure(values) {
    let total = 0;
    for (const key of Object.keys(values)) total += key.length + values[key].length;
    return total;
  }

  const storage = {
    get(key) {
      const raw = storageValues[String(key)];
      if (raw === undefined) return null;
      try {
        return JSON.parse(raw);
      } catch (_) {
        return raw; // written by an older Adanotch, which kept plain strings
      }
    },
    set(key, value) {
      const name = String(key);
      if (value === undefined) return storage.remove(name);
      const json = JSON.stringify(value);
      if (json === undefined) throw new TypeError("storage.set: value can't be stored as JSON");
      const previous = storageValues[name];
      const next = storageBytes - (previous === undefined ? 0 : name.length + previous.length) + name.length + json.length;
      if (next > LIMITS.storageBytes) {
        throw new QuotaExceededError("storage is limited to " + LIMITS.storageBytes / 1024 + " KB per extension");
      }
      storageValues[name] = json;
      storageBytes = next;
      send({ type: "storage", key: name, value: json });
    },
    remove(key) {
      const name = String(key);
      if (storageValues[name] === undefined) return;
      storageBytes -= name.length + storageValues[name].length;
      delete storageValues[name];
      send({ type: "storage", key: name, value: null });
    },
    keys() {
      return Object.keys(storageValues);
    },
    clear() {
      for (const key of Object.keys(storageValues)) storage.remove(key);
    },
  };

  // MARK: UI

  function tone(options) {
    return options && options.tone ? options.tone : undefined;
  }

  const ui = {
    text: (value, options) => ({ type: "text", value: String(value), style: options && options.style, tone: tone(options) }),
    markdown: (value, options) => ({ type: "markdown", value: String(value), tone: tone(options) }),
    icon: (name, options) => ({ type: "icon", name: String(name), tone: tone(options) }),
    image: (src, options) => ({ type: "image", src: String(src), shape: options && options.shape, size: options && options.size }),
    pet: (id, pose, options) => ({ type: "pet", pet: String(id), value: String(pose || "idle"), size: options && options.size }),
    swatch: (color, options) => ({ type: "swatch", value: String(color), size: options && options.size }),
    badge: (text, options) => ({ type: "badge", text: String(text), tone: tone(options) }),
    gauge: (label, value, options) => ({ type: "gauge", label: String(label), value: Number(value), tone: tone(options) }),
    ring: (value, options) => ({ type: "ring", value: Number(value), label: options && options.label, tone: tone(options) }),
    progress: (value, options) => ({ type: "progress", value: Number(value), tone: tone(options) }),
    chart: (values, options) => ({
      type: "chart",
      values: Array.from(values, Number),
      style: (options && options.style) || "line",
      min: options && options.min,
      max: options && options.max,
      tone: tone(options),
    }),
    timer: (date, options) => ({
      type: "timer",
      date: date instanceof Date ? date.getTime() : Number(date),
      style: (options && options.style) || "timer",
      textStyle: options && options.textStyle,
      tone: tone(options),
    }),
    stack: (children, options) => ({
      type: "stack",
      axis: (options && options.axis) || "v",
      spacing: options && options.spacing,
      align: options && options.align,
      children: compact(children),
    }),
    grid: (children, options) => ({ type: "grid", columns: (options && options.columns) || 2, spacing: options && options.spacing, children: compact(children) }),
    scroll: (child, options) => ({ type: "scroll", child, maxHeight: options && options.maxHeight }),
    tabs: (tabs) => ({ type: "tabs", tabs: tabs.map((tab) => ({ title: String(tab.title), icon: tab.icon, content: tab.content })) }),
    divider: () => ({ type: "divider" }),
    spacer: () => ({ type: "spacer" }),
    button: (label, action, options) => ({
      type: "button",
      label: String(label),
      action: String(action),
      icon: options && options.icon,
      primary: Boolean(options && options.primary),
      value: options && options.value,
    }),
    toggle: (label, action, isOn) => ({ type: "toggle", label: String(label), action: String(action), value: Boolean(isOn) }),
    slider: (action, value, options) => ({
      type: "slider",
      action: String(action),
      value: Number(value),
      min: options && options.min !== undefined ? Number(options.min) : 0,
      max: options && options.max !== undefined ? Number(options.max) : 100,
      step: options && options.step,
      label: options && options.label,
    }),
    textField: (action, options) => ({
      type: "textField",
      action: String(action),
      value: options && options.value,
      placeholder: options && options.placeholder,
      changeAction: options && options.changeAction !== undefined ? String(options.changeAction) : undefined,
    }),
    picker: (action, value, choices, options) => ({
      type: "picker",
      action: String(action),
      value: String(value),
      options: choices.map((choice) => (typeof choice === "string" ? { value: choice, label: choice } : { value: String(choice.value), label: String(choice.label) })),
      label: options && options.label,
    }),
    list: (items) => ({ type: "list", items: compact(items) }),
    textArea: (action, options) => ({
      type: "textArea",
      action: String(action),
      value: options && options.value,
      placeholder: options && options.placeholder,
      changeAction: options && options.changeAction,
      lines: options && options.lines,
    }),
    datePicker: (action, value, options) => ({
      type: "datePicker",
      action: String(action),
      value: value instanceof Date ? value.getTime() : Number(value),
      mode: (options && options.mode) || "dateTime",
      label: options && options.label,
    }),
    table: (headers, rows) => ({
      type: "table",
      headers: Array.from(headers, String),
      rows: Array.from(rows, (row) => Array.from(row, String)),
    }),
    calendarDay: (day) => ({ type: "calendarDay", value: Number(day) }),
    countdown: (start, end, options) => ({
      type: "countdown",
      start: start instanceof Date ? start.getTime() : Number(start),
      end: end instanceof Date ? end.getTime() : Number(end),
      label: options && options.label,
      tone: tone(options),
    }),
  };

  function compact(items) {
    return Array.from(items || []).filter((item) => item !== null && item !== undefined && item !== false);
  }

  // MARK: Rendering

  const currentView = { compact: null, expanded: null };
  let renderScheduled = false;

  /** Replaces the parts of the view it names; `null` removes one, a part left out stays as it is. */
  function render(view) {
    if (!view || typeof view !== "object") throw new TypeError("render(view): view must be an object");
    if ("compact" in view) currentView.compact = view.compact || null;
    if ("expanded" in view) currentView.expanded = view.expanded || null;
    if (renderScheduled) return;
    renderScheduled = true;
    // Once per turn: several render() calls in one update cost one message.
    Promise.resolve().then(flushRender);
  }

  /** Sends a render that is waiting for the end of the turn; before `done`, so Adanotch sees the view first. */
  function flushRender() {
    if (!renderScheduled) return;
    renderScheduled = false;
    send({ type: "render", view: { compact: currentView.compact, expanded: currentView.expanded } });
  }

  const island = {
    /** An extra activity beside the notch, or a toast when `duration` is set. */
    show(activity) {
      if (!activity || !activity.id) throw new TypeError("island.show: needs an id");
      send({
        type: "activity",
        id: String(activity.id),
        compact: activity.compact || null,
        expanded: activity.expanded || null,
        duration: activity.duration === undefined ? null : Number(activity.duration),
      });
    },
    hide(id) {
      send({ type: "activity", id: String(id), remove: true });
    },
  };

  // MARK: Events

  const eventPermissions = {
    "media.change": "media.read",
    "battery.change": "battery.read",
    "calendar.change": "calendar.read",
    "reminders.change": "reminders.read",
    "clipboard.change": "clipboard.read",
    "device.change": "devices.read",
    "timer.change": "timer.read",
    "network.change": null,
    "system.wake": null,
    "system.sleep": null,
    "appearance.change": null,
    command: null,
  };
  const listeners = new Map();

  const events = {
    on(name, handler) {
      const event = String(name);
      if (!(event in eventPermissions)) throw new TypeError("Unknown event '" + event + "'");
      if (typeof handler !== "function") throw new TypeError("events.on: handler must be a function");
      const permission = eventPermissions[event];
      if (permission) requirePermission(permission);
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
        if (event !== "command") send({ type: "subscribe", event, on: true });
      }
      set.add(handler);
      return () => events.off(event, handler);
    },
    off(name, handler) {
      const set = listeners.get(String(name));
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) {
        listeners.delete(String(name));
        if (name !== "command") send({ type: "subscribe", event: String(name), on: false });
      }
    },
  };

  function dispatchEvent(name, payload) {
    const set = listeners.get(name);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try {
        const result = handler(payload, context);
        if (result && typeof result.then === "function") result.then(undefined, (error) => reportError("event", error));
      } catch (error) {
        reportError("event", error);
      }
    }
  }

  // MARK: Capabilities behind permissions

  function gated(permission, method, params) {
    requirePermission(permission);
    return request(method, params);
  }

  const system = {
    stats: () => gated("system.stats", "system.stats"),
    isOnline: () => request("system.online"),
    appearance: () => request("system.appearance"),
  };
  const battery = { read: () => gated("battery.read", "battery.read") };
  /** A short system sound by name; the host checks the name, the user's sound setting and how often it is used. */
  const sound = { play: (name) => request("sound.play", { name: String(name) }) };
  const clipboard = {
    readText: () => gated("clipboard.read", "clipboard.readText"),
    writeText: (text) => gated("clipboard.write", "clipboard.writeText", { text: String(text) }),
  };
  const notify = {
    island(notification) {
      requirePermission("notifications");
      send({
        type: "notify",
        text: String((notification && notification.text) || ""),
        icon: notification && notification.icon,
        tone: notification && notification.tone,
        duration: notification && notification.duration,
      });
    },
  };
  const media = {
    nowPlaying: () => gated("media.read", "media.nowPlaying"),
    play: () => gated("media.control", "media.control", { command: "play" }),
    pause: () => gated("media.control", "media.control", { command: "pause" }),
    toggle: () => gated("media.control", "media.control", { command: "toggle" }),
    next: () => gated("media.control", "media.control", { command: "next" }),
    previous: () => gated("media.control", "media.control", { command: "previous" }),
    seek: (seconds) => gated("media.control", "media.control", { command: "seek", seconds: Number(seconds) }),
  };
  const timer = {
    read: () => gated("timer.read", "timer.read"),
    start: () => gated("timer.control", "timer.control", { command: "start" }),
    pause: () => gated("timer.control", "timer.control", { command: "pause" }),
    reset: () => gated("timer.control", "timer.control", { command: "reset" }),
    skip: () => gated("timer.control", "timer.control", { command: "skip" }),
    select: (mode) => gated("timer.control", "timer.control", { command: String(mode) }),
  };
  const calendar = {
    events: (options) => gated("calendar.read", "calendar.events", { days: (options && options.days) || 1 }),
  };
  const reminders = {
    today: () => gated("reminders.read", "reminders.today"),
  };
  const secrets = {
    get: (key) => request("secrets.get", { key: String(key) }),
  };
  const network = {
    fetchJSON: async (url, init) => (await fetch(url, init)).json(),
    isAllowed: (url) => {
      try {
        checkNetworkTarget(url);
        return true;
      } catch (_) {
        return false;
      }
    },
  };

  function open(url) {
    return request("open", { url: String(url) });
  }

  // MARK: Extension lifecycle

  const context = {
    get extensionID() {
      return config.extensionID;
    },
    get settings() {
      return config.settings;
    },
    storage,
    network,
    render,
    refresh: () => scheduleUpdate([]),
  };

  function activity(spec) {
    if (!spec || typeof spec !== "object") throw new TypeError("activity(spec): spec must be an object");
    if (extension) throw new Error("activity() was called twice; an extension registers once");
    extension = spec;
    return spec;
  }

  let updateRunning = false;
  let updateAgain = false;
  let updateWaiters = [];

  /** Runs update() now or right after the one in flight; overlapping refreshes merge into one. */
  function scheduleUpdate(ids) {
    updateWaiters.push(...ids);
    if (updateRunning) {
      updateAgain = true;
      return;
    }
    runUpdates();
  }

  async function runUpdates() {
    updateRunning = true;
    do {
      updateAgain = false;
      const waiting = updateWaiters;
      updateWaiters = [];
      const started = native.now();
      try {
        if (extension && typeof extension.update === "function") {
          const view = await extension.update(context);
          if (view) render(view);
        }
        flushRender();
        const ms = native.now() - started;
        if (waiting.length) for (const id of waiting) send({ type: "done", id, ms });
        else send({ type: "done", id: null, ms });
      } catch (error) {
        if (waiting.length) for (const id of waiting) reportError("update", error, id);
        else reportError("update", error, null);
      }
    } while (updateAgain || updateWaiters.length);
    updateRunning = false;
  }

  async function runAction(id, name, value) {
    try {
      if (extension && typeof extension.onAction === "function") await extension.onAction(name, context, value);
    } catch (error) {
      reportError("action", error, id);
      return;
    }
    scheduleUpdate([id]);
  }

  async function applySettings(id, settings) {
    config.settings = settings || {};
    try {
      if (extension && typeof extension.onSettingsChange === "function") await extension.onSettingsChange(context);
    } catch (error) {
      reportError("settings", error, id);
      return;
    }
    scheduleUpdate([id]);
  }

  const runtime = {
    configure(next) {
      config = Object.assign({}, config, next);
      permissions = new Set(config.permissions || []);
      networkDomains = Array.from(permissions)
        .filter((permission) => permission.startsWith("network:"))
        .map((permission) => permission.slice("network:".length).toLowerCase());
      storageValues = Object.assign({}, config.storage || {});
      storageBytes = measure(storageValues);
    },

    /** After the bundle ran: setup(), then the first update(). */
    async start() {
      if (started) return;
      started = true;
      if (!extension) {
        reportError("load", new Error("The bundle didn't call AdanotchKit.activity({ ... })"));
        return;
      }
      try {
        if (typeof extension.setup === "function") await extension.setup(context);
      } catch (error) {
        reportError("setup", error);
        return;
      }
      send({ type: "started" });
      scheduleUpdate([]);
    },

    receive(json) {
      const message = JSON.parse(json);
      switch (message.type) {
        case "reply":
          settle(message);
          break;
        case "update":
          scheduleUpdate([message.id]);
          break;
        case "action":
          runAction(message.id, String(message.name), message.value === undefined ? null : message.value);
          break;
        case "settings":
          applySettings(message.id, message.settings);
          break;
        case "event":
          dispatchEvent(String(message.name), message.payload === undefined ? null : message.payload);
          break;
        default:
          break;
      }
    },

    fireTimer,
    describe,
  };

  // MARK: Globals

  const kit = {
    activity,
    ui,
    render,
    storage,
    network,
    island,
    events,
    system,
    battery,
    clipboard,
    notify,
    media,
    timer,
    calendar,
    reminders,
    secrets,
    open,
    sound,
  };
  Object.freeze(ui);
  Object.freeze(kit);

  function define(name, value) {
    Object.defineProperty(global, name, { value, writable: true, configurable: true, enumerable: false });
  }

  define("AdanotchKit", kit);
  define("__adanotchRuntime", runtime);
  define("console", console);
  define("setTimeout", (callback, ms, ...args) => addTimer(callback, ms, args, false));
  define("setInterval", (callback, ms, ...args) => addTimer(callback, ms, args, true));
  define("clearTimeout", clearTimer);
  define("clearInterval", clearTimer);
  define("queueMicrotask", (callback) => {
    Promise.resolve().then(callback).then(undefined, (error) => reportError("timer", error));
  });
  define("fetch", fetch);
  define("Headers", Headers);
  define("Response", Response);
  define("URL", URL);
  define("URLSearchParams", URLSearchParams);
  define("TextEncoder", TextEncoder);
  define("TextDecoder", TextDecoder);
  define("atob", atob);
  define("btoa", btoa);
  define("structuredClone", (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value))));
  define("performance", { now: () => native.now() });
  define("crypto", {
    getRandomValues(array) {
      const bytes = native.random(array.byteLength);
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes);
      return array;
    },
    randomUUID() {
      const b = native.random(16);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    },
  });
  for (const [name, type] of Object.entries({ PermissionError, NetworkError, TimeoutError, QuotaExceededError })) define(name, type);
})(globalThis);
