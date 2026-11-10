// Must not type-check: there is no ui.carousel.
AdanotchKit.activity({
  update() {
    return { expanded: AdanotchKit.ui.carousel([]) };
  },
});
