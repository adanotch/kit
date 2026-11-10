import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { load } from "./helpers.ts";

test("setup runs once, then the first update renders", async () => {
  const ext = await load(`
    AdanotchKit.activity({
      setup(ctx) { AdanotchKit.storage.set("setups", (AdanotchKit.storage.get("setups") ?? 0) + 1); },
      update() { return { compact: { trailing: AdanotchKit.ui.text("hi") }, expanded: AdanotchKit.ui.text("open") }; },
    });
  `);
  assert.equal(ext.view.compact?.trailing?.value, "hi");
  assert.deepEqual(ext.texts(), ["hi", "open"]);
  assert.equal(ext.storage["setups"], 1);
  await ext.update();
  assert.equal(ext.storage["setups"], 1);
});

test("manifest defaults reach ctx.settings, options override them and secrets stay out", async () => {
  const script = `AdanotchKit.activity({ update(ctx) { return { expanded: AdanotchKit.ui.text(JSON.stringify(ctx.settings)) }; } });`;
  const settings = [
    { key: "city", type: "text", default: "Ankara" },
    { key: "units", type: "text", default: "metric" },
    { key: "token", type: "secret" },
  ];
  const plain = await load(script, { manifest: { settings } });
  assert.deepEqual(JSON.parse(plain.texts()[0] ?? ""), { city: "Ankara", units: "metric" });

  const overridden = await load(script, { manifest: { settings }, settings: { city: "Izmir" } });
  assert.deepEqual(JSON.parse(overridden.texts()[0] ?? ""), { city: "Izmir", units: "metric" });
});

test("secrets are read through AdanotchKit.secrets and are null until set", async () => {
  const script = `AdanotchKit.activity({ async update() {
    return { expanded: AdanotchKit.ui.text(String(await AdanotchKit.secrets.get("token"))) };
  } });`;
  assert.deepEqual((await load(script, { secrets: { token: "abc" } })).texts(), ["abc"]);
  assert.deepEqual((await load(script)).texts(), ["null"]);
});

test("an action reaches onAction with its value, then update runs again", async () => {
  const ext = await load(`
    let clicks = 0;
    AdanotchKit.activity({
      onAction(action, ctx, value) { if (action === "add") clicks += value; },
      update() { return { expanded: AdanotchKit.ui.text("clicks " + clicks) }; },
    });
  `);
  await ext.action("add", 2);
  await ext.action("add", 3);
  assert.deepEqual(ext.texts(), ["clicks 5"]);
});

test("setSettings calls onSettingsChange with the new values and renders again", async () => {
  const ext = await load(
    `AdanotchKit.activity({ update(ctx) { return { expanded: AdanotchKit.ui.text(ctx.settings.name) }; } });`,
    { manifest: { settings: [{ key: "name", type: "text", default: "Ada" }] } },
  );
  assert.deepEqual(ext.texts(), ["Ada"]);
  await ext.setSettings({ name: "Grace" });
  assert.deepEqual(ext.texts(), ["Grace"]);
});

test("update rejects with the error update threw, and records it", async () => {
  const ext = await load(`
    let fail = false;
    AdanotchKit.activity({
      onAction() { fail = true; },
      update() { if (fail) throw new Error("boom"); return { expanded: AdanotchKit.ui.text("ok") }; },
    });
  `);
  await assert.rejects(ext.action("break"), /update failed: .*boom/);
  assert.equal(ext.errors.at(-1)?.during, "update");
});

test("a bundle that never calls AdanotchKit.activity fails to load", async () => {
  await assert.rejects(load(`const x = 1;`), /load failed: .*didn't call AdanotchKit.activity/);
});

test("a bundle that throws while loading says so", async () => {
  await assert.rejects(load(`throw new Error("nope");`), /The bundle threw while loading: .*nope/);
});

test("events: only subscribed events can be emitted, commands always can", async () => {
  const ext = await load(
    `
    let last = "none";
    AdanotchKit.activity({
      setup() {
        AdanotchKit.events.on("battery.change", (state) => { last = "battery " + state.percentage; });
        AdanotchKit.events.on("command", ({ name, data }) => { last = "command " + name + " " + JSON.stringify(data); });
      },
      update() { return { expanded: AdanotchKit.ui.text(last) }; },
    });
  `,
    { manifest: { permissions: ["battery.read"] } },
  );
  assert.ok(ext.subscriptions.has("battery.change"));
  await ext.emit("battery.change", { percentage: 42 });
  await ext.update();
  assert.deepEqual(ext.texts(), ["battery 42"]);

  await ext.command("reset", { all: true });
  await ext.update();
  assert.deepEqual(ext.texts(), ['command reset {"all":true}']);

  await assert.rejects(ext.emit("media.change"), /doesn't listen to "media.change"/);
});

test("the fake clock drives timers and performance.now", async () => {
  const ext = await load(`
    let ticks = 0;
    AdanotchKit.activity({
      setup(ctx) { setInterval(() => { ticks += 1; ctx.refresh(); }, 1000); },
      update() { return { expanded: AdanotchKit.ui.text(ticks + " at " + Math.round(performance.now())) }; },
    });
  `);
  assert.deepEqual(ext.texts(), ["0 at 0"]);
  await ext.advance(2500);
  // The view shows the clock of the render the second tick caused.
  assert.deepEqual(ext.texts(), ["2 at 2000"]);
  await ext.update();
  assert.deepEqual(ext.texts(), ["2 at 2500"]);
  ext.stop();
  await ext.advance(5000);
  assert.deepEqual(ext.texts(), ["2 at 2500"]);
});

test("storage: initial values are readable, writes and removals show in ext.storage", async () => {
  const ext = await load(
    `
    AdanotchKit.activity({
      onAction(action) {
        if (action === "write") AdanotchKit.storage.set("count", AdanotchKit.storage.get("count") + 1);
        if (action === "remove") AdanotchKit.storage.remove("count");
      },
      update() { return { expanded: AdanotchKit.ui.text(String(AdanotchKit.storage.get("count"))) }; },
    });
  `,
    { storage: { count: 41 } },
  );
  assert.deepEqual(ext.texts(), ["41"]);
  await ext.action("write");
  assert.deepEqual(ext.storage, { count: 42 });
  await ext.action("remove");
  assert.deepEqual(ext.storage, {});
});

test("fetch: an object body is JSON with a content type, a string body is sent as is", async () => {
  const script = `AdanotchKit.activity({ async update() {
    const json = await (await fetch("https://api.example.com/json")).json();
    const res = await fetch("https://api.example.com/text");
    return { expanded: AdanotchKit.ui.text(json.n + " " + (await res.text()) + " " + res.status + " " + res.headers.get("content-type")) };
  } });`;
  const ext = await load(script, {
    manifest: { permissions: ["network:example.com"] },
    mocks: {
      fetch: ({ url }) => (url.endsWith("/json") ? { body: { n: 7 } } : { status: 201, body: "plain" }),
    },
  });
  assert.deepEqual(ext.texts(), ["7 plain 201 null"]);
  assert.deepEqual(
    ext.requests.map((request) => request.method),
    ["fetch", "fetch"],
  );
});

test("fetch without a mock fails as a NetworkError that names the fix", async () => {
  const ext = await load(
    `AdanotchKit.activity({ async update() {
      try { await fetch("https://api.example.com/x"); return {}; }
      catch (error) { return { expanded: AdanotchKit.ui.text(error.name + ": " + error.message) }; }
    } });`,
    { manifest: { permissions: ["network:example.com"] } },
  );
  const [text = ""] = ext.texts();
  assert.match(text, /^NetworkError: No mock for fetch\(https:\/\/api.example.com\/x\)/);
});

test("a mock that throws a named error reaches the extension as that error", async () => {
  const ext = await load(
    `AdanotchKit.activity({ async update() {
      try { await fetch("https://api.example.com/x"); return {}; }
      catch (error) { return { expanded: AdanotchKit.ui.text(error.name + ":" + (error instanceof TimeoutError)) }; }
    } });`,
    {
      manifest: { permissions: ["network:example.com"] },
      mocks: {
        fetch: () => {
          const error = new Error("too slow");
          error.name = "TimeoutError";
          throw error;
        },
      },
    },
  );
  assert.deepEqual(ext.texts(), ["TimeoutError:true"]);
});

test("a request with no mock names the method to mock", async () => {
  await assert.rejects(
    load(`AdanotchKit.activity({ async update() { await AdanotchKit.system.stats(); return {}; } });`, {
      manifest: { permissions: ["system.stats"] },
    }),
    /No mock for "system.stats"; pass mocks: \{ "system.stats"/,
  );
});

test("an API without its permission throws PermissionError inside the extension", async () => {
  const ext = await load(
    `AdanotchKit.activity({ async update() {
      try { await AdanotchKit.system.stats(); return {}; }
      catch (error) { return { expanded: AdanotchKit.ui.text(error.name) }; }
    } });`,
    { mocks: { "system.stats": () => ({}) } },
  );
  assert.deepEqual(ext.texts(), ["PermissionError"]);
  // ...and the permission option can withdraw one the manifest asks for.
  const withdrawn = await load(
    `AdanotchKit.activity({ async update() {
      try { await AdanotchKit.system.stats(); return { expanded: AdanotchKit.ui.text("allowed") }; }
      catch (error) { return { expanded: AdanotchKit.ui.text(error.name) }; }
    } });`,
    { manifest: { permissions: ["system.stats"] }, permissions: [], mocks: { "system.stats": () => ({}) } },
  );
  assert.deepEqual(withdrawn.texts(), ["PermissionError"]);
});

test("clipboard, sound, open and timer controls are answered by the harness unless mocked", async () => {
  const ext = await load(
    `AdanotchKit.activity({
      async onAction(action) {
        if (action === "go") {
          await AdanotchKit.clipboard.writeText("copied");
          AdanotchKit.sound.play("Glass");
          AdanotchKit.timer.start();
        }
      },
      async update() { return { expanded: AdanotchKit.ui.text(String(await AdanotchKit.clipboard.readText())) }; },
    });`,
    {
      manifest: { permissions: ["clipboard.read", "clipboard.write", "timer.read", "timer.control"] },
      clipboard: "before",
    },
  );
  assert.deepEqual(ext.texts(), ["before"]);
  await ext.action("go");
  assert.equal(ext.clipboard, "copied");
  assert.deepEqual(ext.texts(), ["copied"]);
  assert.deepEqual(ext.sounds, ["Glass"]);
  assert.deepEqual(ext.timerCommands, ["start"]);
});

test("mocks replace the harness's own answers", async () => {
  const ext = await load(
    `AdanotchKit.activity({ async update() { return { expanded: AdanotchKit.ui.text(String(await AdanotchKit.clipboard.readText())) }; } });`,
    {
      manifest: { permissions: ["clipboard.read"] },
      clipboard: "ignored",
      mocks: { "clipboard.readText": () => "mocked" },
    },
  );
  assert.deepEqual(ext.texts(), ["mocked"]);
});

test("notifications and island activities are recorded", async () => {
  const ext = await load(
    `AdanotchKit.activity({
      onAction(action) {
        if (action === "show") AdanotchKit.island.show({ id: "a", compact: { leading: AdanotchKit.ui.icon("bell") }, duration: 5 });
        if (action === "hide") AdanotchKit.island.hide("a");
        if (action === "notify") AdanotchKit.notify.island({ text: "Done", tone: "success", duration: 4 });
      },
      update() { return {}; },
    });`,
    { manifest: { permissions: ["notifications"] } },
  );
  await ext.action("show");
  assert.deepEqual([...ext.activities.keys()], ["a"]);
  assert.equal(ext.activities.get("a")?.duration, 5);
  await ext.action("hide");
  assert.equal(ext.activities.size, 0);
  await ext.action("notify");
  assert.deepEqual(
    ext.notifications.map(({ text, tone, duration }) => ({ text, tone, duration })),
    [{ text: "Done", tone: "success", duration: 4 }],
  );
});

test("console lines are recorded, and printed with printLogs", async () => {
  const script = `AdanotchKit.activity({ update() { console.log("hello", 1); console.warn("careful"); return {}; } });`;
  const quiet = await load(script);
  assert.deepEqual(
    quiet.logs.map((entry) => entry.message),
    ["hello 1", "careful"],
  );
  assert.deepEqual(
    quiet.logs.map((entry) => entry.level),
    ["info", "warning"],
  );

  const log = mock.method(console, "log", () => undefined);
  try {
    await load(script, { printLogs: true });
    assert.equal(log.mock.callCount(), 2);
    assert.deepEqual(log.mock.calls[0]?.arguments, ["[local.kit.test] hello 1"]);
  } finally {
    log.mock.restore();
  }
});
