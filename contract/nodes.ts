// Valid view nodes, a few of every type, as they cross the line between an extension and Adanotch.
//
// This is the contract both sides test against: the kit's tests send each node through the real runtime, and
// Adanotch's own tests decode `nodes.json` (generated from this file by `npm run contract`) with its Swift types.
// The `satisfies` clause makes the compiler refuse a missing node type or a node that doesn't fit its type.

const TIMESTAMP = 1_700_000_000_000;

const text: Adanotch.TextNode = { type: "text", value: "Hello" };

export const nodes = {
  text: [text, { type: "text", value: "Title", style: "title", tone: "accent" }],
  markdown: [
    { type: "markdown", value: "**bold**, *italic*, `code` and [a link](https://example.com)" },
    { type: "markdown", value: "Quiet", tone: "secondary" },
  ],
  icon: [
    { type: "icon", name: "cpu" },
    { type: "icon", name: "exclamationmark.triangle", tone: "warning" },
  ],
  image: [
    { type: "image", src: "https://example.com/logo.png" },
    { type: "image", src: "https://example.com/avatar.png", shape: "circle", size: 32 },
  ],
  pet: [
    { type: "pet", pet: "lokum", value: "idle" },
    { type: "pet", pet: "active", value: "nightShift", size: 48 },
  ],
  swatch: [
    { type: "swatch", value: "#FF8800" },
    { type: "swatch", value: "#f80", size: 24 },
  ],
  badge: [
    { type: "badge", text: "3" },
    { type: "badge", text: "New", tone: "success" },
    { type: "badge", text: "Live", tone: "warning", live: true },
    { type: "badge", text: "Synced", tone: "success", dot: true, icon: "checkmark", filled: true },
  ],
  alert: [
    { type: "alert", title: "Saved" },
    {
      type: "alert",
      title: "This module is off",
      message: "Settings are saved but it won't show on the island.",
      tone: "warning",
      variant: "tinted",
      button: { label: "Turn on", action: "enable", value: { id: 1 } },
    },
  ],
  card: [
    { type: "card", children: [text] },
    {
      type: "card",
      children: [text, { type: "badge", text: "3" }],
      variant: "brand",
      selected: true,
      action: "open",
      value: { id: 7 },
    },
  ],
  iconBadge: [
    { type: "iconBadge", name: "bolt.fill" },
    { type: "iconBadge", name: "checkmark", tone: "success", variant: "solid", size: "lg", round: true },
  ],
  gauge: [
    { type: "gauge", label: "CPU", value: 42 },
    { type: "gauge", label: "Disk", value: 91, tone: "warning" },
  ],
  ring: [
    { type: "ring", value: 60 },
    { type: "ring", value: 75, label: "Disk", tone: "accent" },
  ],
  progress: [
    { type: "progress", value: 30 },
    { type: "progress", value: 100, tone: "success" },
  ],
  chart: [
    { type: "chart", values: [1, 2, 3, 2], style: "line" },
    { type: "chart", values: [3, 1, 2], style: "bar", min: 0, max: 5, tone: "accent" },
  ],
  timer: [
    { type: "timer", date: TIMESTAMP, style: "timer" },
    { type: "timer", date: TIMESTAMP, style: "relative", textStyle: "caption", tone: "secondary" },
  ],
  stack: [
    { type: "stack", axis: "v", children: [text] },
    {
      type: "stack",
      axis: "h",
      spacing: 8,
      align: "center",
      children: [{ type: "icon", name: "bell" }, text, { type: "spacer" }],
    },
  ],
  grid: [
    { type: "grid", columns: 2, children: [text, text] },
    { type: "grid", columns: 3, spacing: 4, children: [text, text, text] },
  ],
  scroll: [
    { type: "scroll", child: text },
    { type: "scroll", child: text, maxHeight: 120 },
  ],
  tabs: [
    {
      type: "tabs",
      tabs: [
        { title: "One", content: text },
        { title: "Two", icon: "star", content: { type: "text", value: "Second" } },
      ],
    },
    { type: "tabs", style: "underline", tabs: [{ title: "One", content: text }] },
  ],
  divider: [{ type: "divider" }],
  spacer: [{ type: "spacer" }],
  button: [
    { type: "button", label: "Refresh", action: "refresh", primary: false },
    {
      type: "button",
      label: "Open",
      action: "open",
      icon: "arrow.up.right",
      primary: true,
      value: { id: 1, tags: ["a"] },
    },
    { type: "button", label: "Delete", action: "delete", primary: false, variant: "destructive", size: "small" },
  ],
  toggle: [{ type: "toggle", label: "Sound", action: "sound", value: true }],
  slider: [
    { type: "slider", action: "volume", value: 50, min: 0, max: 100 },
    { type: "slider", action: "volume", value: 5, min: 0, max: 10, step: 1, label: "Volume" },
  ],
  textField: [
    { type: "textField", action: "add" },
    { type: "textField", action: "add", value: "milk", placeholder: "Add an item…", changeAction: "typing" },
    { type: "textField", action: "search", placeholder: "Search", icon: "magnifyingglass", hint: "⌘F", invalid: true },
  ],
  textArea: [
    { type: "textArea", action: "send" },
    { type: "textArea", action: "send", value: "Draft", placeholder: "Write…", changeAction: "draft", lines: 6 },
  ],
  datePicker: [
    { type: "datePicker", action: "when", value: TIMESTAMP, mode: "date" },
    { type: "datePicker", action: "when", value: TIMESTAMP, mode: "dateTime", label: "Remind me" },
  ],
  table: [
    { type: "table", headers: ["Name", "Qty"], rows: [["Milk", "2"]] },
    { type: "table", headers: ["A"], rows: [] },
  ],
  calendarDay: [{ type: "calendarDay", value: 14 }],
  countdown: [
    { type: "countdown", start: TIMESTAMP, end: TIMESTAMP + 1_500_000 },
    { type: "countdown", start: TIMESTAMP, end: TIMESTAMP + 3_000_000, label: "Focus", tone: "accent" },
  ],
  picker: [
    {
      type: "picker",
      action: "units",
      value: "c",
      options: [
        { value: "c", label: "°C" },
        { value: "f", label: "°F" },
      ],
    },
    { type: "picker", action: "units", value: "f", label: "Units", options: [{ value: "f", label: "°F" }] },
    {
      type: "picker",
      action: "view",
      value: "a",
      style: "segmented",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    },
  ],
  list: [
    { type: "list", items: [{ title: "Row" }] },
    {
      type: "list",
      items: [
        {
          title: "Pull request",
          subtitle: "acme/app#12",
          icon: "arrow.triangle.pull",
          action: "select",
          trailing: "2 min",
          tone: "warning",
          value: { number: 12 },
          buttons: [{ icon: "checkmark", label: "Approve", action: "approve", value: 12 }],
        },
        { title: "Safari", appIcon: "com.apple.Safari" },
        { title: "Accent", swatch: "#0A84FF" },
      ],
    },
  ],
} satisfies Record<Adanotch.Node["type"], Adanotch.Node[]>;
