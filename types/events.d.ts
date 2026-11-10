// Events an extension can subscribe to.
// Part of the Adanotch extension API; see index.d.ts.

declare namespace Adanotch {
  // MARK: Events

  interface Events {
    /** Needs "media.read". The track or play state changed; `null` when nothing plays. */
    "media.change": NowPlaying | null;
    /** Needs "battery.read". */
    "battery.change": BatteryState;
    /** Needs "calendar.read". Something changed in Calendar; read `calendar.events()` again. */
    "calendar.change": null;
    /** Needs "reminders.read". */
    "reminders.change": null;
    /**
     * Needs "clipboard.read". `text` is `null` when the copy wasn't text. `kind` is "link" for an http(s) address and
     * "color" for `#RGB`/`#RRGGBB` (then `color` is the normalized `#RRGGBB`). `sourceApp` is the app in front when it
     * was copied. Copies marked concealed or transient (password managers) and copies from apps the user excluded in
     * Settings › Privacy › Clipboard history are never delivered.
     */
    "clipboard.change": {
      text: string | null;
      kind: "text" | "link" | "color" | "other";
      color?: string;
      sourceApp?: { id: string; name: string | null };
    };
    /**
     * Needs "devices.read", and the Connections (Bluetooth, VPN, displays, network) or Device events (disks) module
     * turned on, which is where the events come from. `kind` "network" has no name: a Wi-Fi name needs Location access,
     * which extensions can't ask for. Disks: "mounted", "ejected", "removedUnsafely".
     */
    "device.change": {
      kind: "bluetooth" | "network" | "vpn" | "display" | "volume";
      action: "connected" | "disconnected" | "lost" | "restored" | "mounted" | "ejected" | "removedUnsafely";
      name: string | null;
      /** Bluetooth only: "airPods", "headphones", "keyboard", "mouse", "trackpad" or "other". */
      deviceKind?: string;
      /** Network "restored" only. */
      interface?: "wifi" | "ethernet" | "other";
      /** Display only, in pixels. */
      width?: number;
      height?: number;
    };
    /** Needs "timer.read" and the Timer module on. The Focus timer started, paused, advanced or finished. */
    "timer.change": TimerState;
    "network.change": { online: boolean };
    "system.wake": null;
    "system.sleep": null;
    "appearance.change": { appearance: "light" | "dark" };
    /** `adanotch ext <id> <name> [data]` or a Shortcuts link `adanotch://ext/<id>/<name>?data=…`. */
    command: { name: string; data: JSONValue };
  }
}
