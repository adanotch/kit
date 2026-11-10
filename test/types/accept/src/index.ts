// A real extension that touches most of the API. It must type-check against @adanotch/kit's types.

const { activity, ui, events, system, battery, media, calendar, reminders, clipboard, notify, island, secrets, timer } =
  AdanotchKit;

interface Settings {
  city: string;
  rows: number;
  sound: boolean;
}

interface Weather {
  temp: number;
}

activity<Settings>({
  async setup(ctx) {
    events.on("battery.change", (state) => ctx.storage.set("battery", state.percentage));
    events.on("command", ({ name, data }) => {
      if (name === "reset") ctx.storage.clear();
      console.log(JSON.stringify(data));
    });
    setInterval(() => ctx.refresh(), 60_000);
  },

  async update(ctx) {
    const [stats, power, track, agenda, due, text, token, timerState] = await Promise.all([
      system.stats(),
      battery.read(),
      media.nowPlaying(),
      calendar.events({ days: 2 }),
      reminders.today(),
      clipboard.readText(),
      secrets.get("token"),
      timer.read(),
    ]);
    const weather = await ctx.network.fetchJSON<Weather>(`https://api.example.com/${ctx.settings.city}`);
    ctx.storage.set("last", { at: Date.now(), temp: weather.temp });

    return {
      compact: {
        leading: ui.pet("lokum", power.isCharging ? "happy" : "zen"),
        trailing: ui.text(`${Math.round(stats.cpuPercent)}%`, { tone: stats.cpuPercent > 80 ? "warning" : "default" }),
      },
      expanded: ui.stack(
        [
          ui.text(`${weather.temp}°`, { style: "display" }),
          track && ui.text(`${track.title} · ${track.artist}`),
          ui.chart([1, 2, 3], { style: "area", tone: "accent" }),
          ui.list(agenda.slice(0, ctx.settings.rows).map((event) => ({ title: event.title, trailing: "soon" }))),
          ui.button("Refresh", "refresh", { icon: "arrow.clockwise", primary: true }),
          ui.toggle("Sound", "sound", ctx.settings.sound),
          ui.badge(String(due.length)),
          ui.timer(Date.now() + 60_000, { style: "timer" }),
          text ? ui.markdown(text) : null,
          token ? ui.icon("key.fill") : ui.icon("key"),
          ui.progress(timerState.isRunning ? 50 : 0),
        ],
        { axis: "v", spacing: 8 },
      ),
    };
  },

  async onAction(action, ctx, value) {
    if (action === "refresh") ctx.refresh();
    if (action === "sound" && typeof value === "boolean" && value) AdanotchKit.sound.play("Glass");
    if (action === "open") await AdanotchKit.open("https://example.com");
    await clipboard.writeText("copied");
    notify.island({ text: "Done", icon: "checkmark", tone: "success", duration: 4 });
    island.show({ id: "a", compact: { leading: ui.icon("bell") }, duration: 5 });
  },

  onSettingsChange(ctx) {
    ctx.refresh();
  },
});

// The errors are classes an extension can tell apart.
export async function guarded(): Promise<string> {
  try {
    await AdanotchKit.system.stats();
    return "ok";
  } catch (error) {
    if (error instanceof PermissionError) return "permission";
    if (error instanceof NetworkError || error instanceof TimeoutError) return "network";
    throw error;
  }
}
