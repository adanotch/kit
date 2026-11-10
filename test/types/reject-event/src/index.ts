// Must not type-check: there is no "weather.change" event.
AdanotchKit.activity({
  setup() {
    AdanotchKit.events.on("weather.change", () => undefined);
  },
  update() {
    return {};
  },
});
