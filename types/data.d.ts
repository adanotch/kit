// Data Adanotch gives an extension, and what an extension can show beside the notch.
// Part of the Adanotch extension API; see index.d.ts.

declare namespace Adanotch {
  // MARK: Data from Adanotch

  interface SystemStats {
    cpuPercent: number;
    ramPercent: number;
    usedMemoryGB: number;
    totalMemoryGB: number;
  }
  interface BatteryState {
    percentage: number;
    isCharging: boolean;
    isPluggedIn: boolean;
    hasInternalBattery: boolean;
    /** Until full while charging, until empty otherwise; `null` while macOS is still estimating. */
    minutesRemaining: number | null;
    /** Connected Bluetooth devices that report a battery. */
    devices: { name: string; percentage: number }[];
  }
  interface NowPlaying {
    title: string;
    artist: string;
    album: string;
    /** Seconds. */
    duration: number;
    /** Seconds played. */
    elapsed: number;
    isPlaying: boolean;
    /** Bundle id of the player, e.g. "com.spotify.client". */
    app: string;
  }
  interface CalendarEvent {
    id: string;
    title: string;
    calendar: string;
    /** Milliseconds; `new Date(start)`. */
    start: number;
    end: number;
    /** Zoom, Meet, Teams… link found in the event. */
    meetingURL: string | null;
    attendees: number;
  }
  type TimerMode = "focus25" | "focus50" | "shortBreak5" | "longBreak15";
  /** The Odak (Pomodoro) timer. */
  interface TimerState {
    mode: TimerMode;
    isBreak: boolean;
    isRunning: boolean;
    /** Seconds left in this interval (the full length while idle). */
    remainingSeconds: number;
    /** Milliseconds since 1970 when the running interval ends; `null` while paused or idle. */
    endsAt: number | null;
    /** 1-based number of the running focus interval, as the island shows "2 / 4". */
    cycle: number;
    completedCycles: number;
  }
  interface Reminder {
    id: string;
    title: string;
    list: string;
    /** Milliseconds, or `null` without a due date. */
    due: number | null;
    isCompleted: boolean;
    isOverdue: boolean;
  }
  interface IslandNotification {
    text: string;
    icon?: Symbol;
    tone?: Tone;
    /** Seconds, 1–15; default 3. */ duration?: number;
  }
  interface IslandActivity {
    /** Yours to choose; `show` again with the same id updates it. At most 8 at a time. */
    id: string;
    compact?: Compact;
    expanded?: Node;
    /** Seconds (1–60) before it goes away on its own; without it, it stays until `hide(id)`. */
    duration?: number;
  }
}
