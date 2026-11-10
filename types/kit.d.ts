// The AdanotchKit object.
// Part of the Adanotch extension API; see index.d.ts.

declare namespace Adanotch {
  interface Kit {
    /** Registers the extension; call it once at the top level of your script. */
    activity<S = Record<string, never>>(extension: Extension<S>): Extension<S>;
    /** Same as `ctx.render`, for code that has no `ctx` at hand. */
    render(view: View): void;

    ui: {
      text(value: string | number, options?: { style?: TextStyle; tone?: Tone }): TextNode;
      markdown(value: string, options?: { tone?: Tone }): MarkdownNode;
      icon(name: Symbol, options?: { tone?: Tone }): IconNode;
      /** `size` is 16–120 points; default 40. */
      image(src: string, options?: { shape?: "rounded" | "circle"; size?: number }): ImageNode;
      pet(id: string, pose: PetPose, options?: { size?: number }): PetNode;
      swatch(color: string, options?: { size?: number }): SwatchNode;
      badge(text: string, options?: { tone?: Tone }): BadgeNode;
      gauge(label: string, value: number, options?: { tone?: Tone }): GaugeNode;
      ring(value: number, options?: { label?: string; tone?: Tone }): RingNode;
      progress(value: number, options?: { tone?: Tone }): ProgressNode;
      chart(
        values: Iterable<number>,
        options?: { style?: "line" | "area" | "bar"; min?: number; max?: number; tone?: Tone },
      ): ChartNode;
      timer(
        date: Date | number,
        options?: { style?: "timer" | "relative"; textStyle?: TextStyle; tone?: Tone },
      ): TimerNode;
      /** Vertical unless `axis: "h"`. `null`, `undefined` and `false` children are skipped: `cond && ui.text(…)`. */
      stack(
        children: (Node | null | undefined | false)[],
        options?: { axis?: "h" | "v"; spacing?: number; align?: "start" | "center" | "end" },
      ): StackNode;
      grid(children: (Node | null | undefined | false)[], options?: { columns?: number; spacing?: number }): GridNode;
      scroll(child: Node, options?: { maxHeight?: number }): ScrollNode;
      tabs(tabs: Tab[]): TabsNode;
      divider(): DividerNode;
      spacer(): SpacerNode;
      button(
        label: string,
        action: string,
        options?: { icon?: Symbol; primary?: boolean; value?: JSONValue },
      ): ButtonNode;
      toggle(label: string, action: string, isOn: boolean): ToggleNode;
      /** `min` 0 and `max` 100 unless given. */
      slider(
        action: string,
        value: number,
        options?: { min?: number; max?: number; step?: number; label?: string },
      ): SliderNode;
      textField(
        action: string,
        options?: { value?: string; placeholder?: string; changeAction?: string },
      ): TextFieldNode;
      textArea(
        action: string,
        options?: { value?: string; placeholder?: string; changeAction?: string; lines?: number },
      ): TextAreaNode;
      datePicker(
        action: string,
        value: Date | number,
        options?: { mode?: "date" | "time" | "dateTime"; label?: string },
      ): DatePickerNode;
      table(headers: Iterable<string>, rows: Iterable<Iterable<string | number>>): TableNode;
      calendarDay(day: number): CalendarDayNode;
      countdown(start: Date | number, end: Date | number, options?: { label?: string; tone?: Tone }): CountdownNode;
      picker(action: string, value: string, options: (string | PickerOption)[], extra?: { label?: string }): PickerNode;
      list(items: (ListItem | null | undefined | false)[]): ListNode;
    };

    storage: Storage;
    network: Network;

    /** More activities of yours beside the notch, e.g. one per running timer, or a short-lived toast. */
    island: {
      show(activity: IslandActivity): void;
      hide(id: string): void;
    };

    events: {
      /** Returns a function that unsubscribes. Throws a `PermissionError` without the event's permission. */
      // `Context<any>`: the events API cannot know the extension's own settings type, and a handler written against
      // `Context<MySettings>` is only assignable if this one is `any` (it would not be for `unknown`).
      on<E extends keyof Events>(
        event: E,
        // oxlint-disable-next-line typescript/no-explicit-any
        handler: (payload: Events[E], ctx: Context<any>) => void | Promise<void>,
      ): () => void;
      off<E extends keyof Events>(
        event: E,
        // oxlint-disable-next-line typescript/no-explicit-any
        handler: (payload: Events[E], ctx: Context<any>) => void | Promise<void>,
      ): void;
    };

    system: {
      /** Needs "system.stats". */
      stats(): Promise<SystemStats>;
      isOnline(): Promise<boolean>;
      appearance(): Promise<"light" | "dark">;
    };
    /** Needs "battery.read". */
    battery: { read(): Promise<BatteryState> };
    clipboard: {
      /** Needs "clipboard.read". `null` when the clipboard holds no text. */
      readText(): Promise<string | null>;
      /** Needs "clipboard.write". Up to 1 MB. */
      writeText(text: string): Promise<void>;
    };
    /** Needs "notifications": a short toast in the island. */
    notify: { island(notification: IslandNotification): void };
    /** Uses what the Music module sees, so that module must be on. */
    media: {
      /** Needs "media.read". `null` when nothing plays. */
      nowPlaying(): Promise<NowPlaying | null>;
      /** The rest need "media.control". */
      play(): Promise<void>;
      pause(): Promise<void>;
      toggle(): Promise<void>;
      next(): Promise<void>;
      previous(): Promise<void>;
      seek(seconds: number): Promise<void>;
    };
    /** Uses the Timer module, so it must be on. */
    timer: {
      /** Needs "timer.read". */
      read(): Promise<TimerState>;
      /** The rest need "timer.control" and resolve with the new state. */
      start(): Promise<TimerState>;
      pause(): Promise<TimerState>;
      reset(): Promise<TimerState>;
      skip(): Promise<TimerState>;
      /** Picks an interval and resets the countdown to its full length. */
      select(mode: TimerMode): Promise<TimerState>;
    };
    /** Needs "calendar.read", and calendar access for Adanotch itself. */
    calendar: { events(options?: { days?: number }): Promise<CalendarEvent[]> };
    /** Needs "reminders.read", and reminders access for Adanotch itself. */
    reminders: { today(): Promise<Reminder[]> };
    /**
     * Values of `"type": "secret"` settings (API tokens), which the user types in Settings and Adanotch keeps in the
     * Keychain. `null` until the user sets one.
     */
    secrets: { get(key: string): Promise<string | null> };
    /**
     * Plays a short system sound: "Basso", "Blow", "Bottle", "Frog", "Funk", "Glass", "Hero", "Morse", "Ping", "Pop",
     * "Purr", "Sosumi", "Submarine" or "Tink". Silent when the user turned sound effects off in Settings › General;
     * at most one a second and 12 a minute. Needs no permission.
     */
    sound: {
      play(
        name:
          | "Basso"
          | "Blow"
          | "Bottle"
          | "Frog"
          | "Funk"
          | "Glass"
          | "Hero"
          | "Morse"
          | "Ping"
          | "Pop"
          | "Purr"
          | "Sosumi"
          | "Submarine"
          | "Tink",
      ): Promise<void>;
    };
    /** Opens an https:// or mailto: link, only within 10 s of the user using one of your controls. */
    open(url: string): Promise<void>;
  }
}
