// Must not type-check: "not-a-pose" is no companion pose.
AdanotchKit.activity({
  update() {
    return { compact: { leading: AdanotchKit.ui.pet("lokum", "not-a-pose") } };
  },
});
