// The view an extension draws: nodes, the compact slot and the expanded card.
// Part of the Adanotch extension API; see index.d.ts.

declare namespace Adanotch {
  // MARK: View

  /** Semantic colours; Adanotch picks the actual shade so every extension matches the island. */
  type Tone = "default" | "secondary" | "accent" | "success" | "warning" | "danger";
  type TextStyle = "title" | "body" | "caption" | "mono" | "display";
  /** An SF Symbols name, e.g. "cpu", "cloud.sun.fill", "checkmark.circle". */
  type Symbol = string;
  /** Anything JSON can carry; what buttons, list items and inputs hand to `onAction`. */
  type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

  interface TextNode {
    type: "text";
    value: string;
    style?: TextStyle;
    tone?: Tone;
  }
  /** A small subset of Markdown: **bold**, *italic*, `code`, [links](https://…). */
  interface MarkdownNode {
    type: "markdown";
    value: string;
    tone?: Tone;
  }
  interface IconNode {
    type: "icon";
    name: Symbol;
    tone?: Tone;
  }
  /** HTTPS only, and only from your `network:` hosts. */
  interface ImageNode {
    type: "image";
    src: string;
    shape?: "rounded" | "circle";
    size?: number;
  }
  /** A companion's pose; Lokum picks them itself (music: dance, low battery: sad, a recording: recording…). */
  type PetPose =
    | "idle"
    | "dance"
    | "sad"
    | "sleep"
    | "happy"
    | "surprised"
    | "exhausted"
    | "loved"
    | "recording"
    | "posing"
    | "celebrating"
    | "dizzy"
    | "melting"
    | "yawning"
    | "nightShift"
    | "alert"
    | "zen"
    | "searching";
  /**
   * A companion. `pet` is the id of an installed pet, "lokum" for Lokum herself, or "active" for whichever the user
   * chose in Settings › Lokum; an id that isn't installed shows the active one. `size` is 16–120 points; default 40.
   */
  interface PetNode {
    type: "pet";
    pet: string;
    value: PetPose;
    size?: number;
  }
  /** A colour chip. `color` is `#RGB` or `#RRGGBB`; `size` is 12–48 points, default 20. */
  interface SwatchNode {
    type: "swatch";
    value: string;
    size?: number;
  }
  /** A short status or count: one or two words. */
  interface BadgeNode {
    type: "badge";
    text: string;
    tone?: Tone;
    /** A small dot before the text. */
    dot?: boolean;
    /** A pulsing dot for something happening right now (implies `dot`). Still under Reduce Motion. */
    live?: boolean;
    /** An SF Symbol before the text. */
    icon?: Symbol;
    /** A solid ground with light text, for one badge that should stand out ("New"). */
    filled?: boolean;
  }
  /** Alert looks: no ground, the tone at 12 % with a tone edge, or the card ground with a hairline. */
  type AlertVariant = "ghost" | "tinted" | "border";
  /**
   * A message under a header or above a form: a status dot, a title and an optional sentence. `tone` sets the dot,
   * the ground and the edge: `accent` reads as information, `default` and `secondary` as plain information too.
   * Not for the compact slot.
   */
  interface AlertNode {
    type: "alert";
    title: string;
    message?: string;
    tone?: Tone;
    variant?: AlertVariant;
    /** One small button at the trailing edge; it calls `onAction(action, ctx, value)`. */
    button?: { label: string; action: string; value?: JSONValue };
  }
  /** Card looks. `tinted` is a soft accent ground; `brand` is the one highlighted card of a view. */
  type CardVariant = "bordered" | "borderless" | "tinted" | "brand";
  /**
   * A group of related content on a card ground. With an `action` the whole card is a button
   * (`onAction(action, ctx, value)`); `selected` marks the chosen one in a set of cards. Not for the compact slot.
   */
  interface CardNode {
    type: "card";
    children: Node[];
    variant?: CardVariant;
    selected?: boolean;
    action?: string;
    value?: JSONValue;
  }
  type IconBadgeVariant = "tinted" | "solid" | "ghost" | "border" | "outline" | "gradient";
  type IconBadgeSize = "sm" | "md" | "lg" | "xl";
  /** An SF Symbol on a tile in the tone's colour: the leading mark of a row or a card. */
  interface IconBadgeNode {
    type: "iconBadge";
    name: Symbol;
    tone?: Tone;
    variant?: IconBadgeVariant;
    /** 24, 28, 40 or 56 points; default `md`. */
    size?: IconBadgeSize;
    /** A circle instead of a rounded square. */
    round?: boolean;
  }
  /** `value` is 0–100. */
  interface GaugeNode {
    type: "gauge";
    label: string;
    value: number;
    tone?: Tone;
  }
  /** `value` is 0–100. */
  interface RingNode {
    type: "ring";
    value: number;
    label?: string;
    tone?: Tone;
  }
  /** `value` is 0–100. */
  interface ProgressNode {
    type: "progress";
    value: number;
    tone?: Tone;
  }
  /** Up to 500 values; `min`/`max` default to the data's own range. */
  interface ChartNode {
    type: "chart";
    values: number[];
    style: "line" | "area" | "bar";
    min?: number;
    max?: number;
    tone?: Tone;
  }
  /**
   * Counts on its own, without re-rendering: `date` is a timestamp in milliseconds.
   * "timer" shows 04:59 (down to a future date, up from a past one); "relative" shows "in 5 minutes".
   */
  interface TimerNode {
    type: "timer";
    date: number;
    style: "timer" | "relative";
    textStyle?: TextStyle;
    tone?: Tone;
  }
  interface StackNode {
    type: "stack";
    axis: "h" | "v";
    spacing?: number;
    align?: "start" | "center" | "end";
    children: Node[];
  }
  interface GridNode {
    type: "grid";
    columns: number;
    spacing?: number;
    children: Node[];
  }
  interface ScrollNode {
    type: "scroll";
    child: Node;
    maxHeight?: number;
  }
  interface Tab {
    title: string;
    icon?: Symbol;
    content: Node;
  }
  /** Switching tabs happens inside Adanotch; your extension isn't called. */
  interface TabsNode {
    type: "tabs";
    tabs: Tab[];
    /** `container` (default): the active tab is a raised pill. `underline`: a line under the active title. */
    style?: "container" | "underline";
  }
  interface DividerNode {
    type: "divider";
  }
  /** Pushes its neighbours apart inside a stack. */
  interface SpacerNode {
    type: "spacer";
  }
  /** `primary` is the one main action of a view; `secondary` and `outline` are quieter; `destructive` deletes. */
  type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "tinted" | "destructive";
  interface ButtonNode {
    type: "button";
    label: string;
    action: string;
    icon?: Symbol;
    /** Same as `variant: "primary"`; `variant` wins when both are given. */
    primary: boolean;
    variant?: ButtonVariant;
    size?: "small" | "regular";
    value?: JSONValue;
  }
  /** `onAction(action, ctx, isOn)`. */
  interface ToggleNode {
    type: "toggle";
    label: string;
    action: string;
    value: boolean;
  }
  /** `onAction(action, ctx, value)` when the user lets go. */
  interface SliderNode {
    type: "slider";
    action: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    label?: string;
  }
  /**
   * `onAction(action, ctx, text)` on Return. With `changeAction`, also `onAction(changeAction, ctx, text)` as the user
   * types, once they pause for a moment: for search and filters.
   */
  interface TextFieldNode {
    type: "textField";
    action: string;
    value?: string;
    placeholder?: string;
    changeAction?: string;
    /** An SF Symbol at the start of the field. */
    icon?: Symbol;
    /** Short text at the end of the field: a unit, a shortcut. */
    hint?: string;
    /** Draws the field's edge in the danger colour. */
    invalid?: boolean;
  }
  /** Several lines. `onAction(action, ctx, text)` on ⌘Return; `changeAction` also as the user types, after a pause. `lines` 2–12, default 4. */
  interface TextAreaNode {
    type: "textArea";
    action: string;
    value?: string;
    placeholder?: string;
    changeAction?: string;
    lines?: number;
  }
  /** `onAction(action, ctx, ms)` with the picked time as a timestamp in milliseconds. */
  interface DatePickerNode {
    type: "datePicker";
    action: string;
    value: number;
    mode: "date" | "time" | "dateTime";
    label?: string;
  }
  /** At most 8 columns and 100 rows; a cell is cut at 200 characters, and a row's extra cells are dropped. */
  interface TableNode {
    type: "table";
    headers: string[];
    rows: string[][];
  }
  /** A calendar tile with the day of the month (1–31); also fits beside the notch. */
  interface CalendarDayNode {
    type: "calendarDay";
    value: number;
  }
  /** Time left until `end` (ms) and a bar filling from `start` to `end`; counts on its own, without re-rendering. */
  interface CountdownNode {
    type: "countdown";
    start: number;
    end: number;
    label?: string;
    tone?: Tone;
  }
  interface PickerOption {
    value: string;
    label: string;
  }
  /** `onAction(action, ctx, value)` with the picked option's value. */
  interface PickerNode {
    type: "picker";
    action: string;
    value: string;
    options: PickerOption[];
    label?: string;
    /** `menu` (default): a drop-down. `segmented`: a row of segments, for 2–4 short options. */
    style?: "menu" | "segmented";
  }
  interface ListItem {
    title: string;
    subtitle?: string;
    icon?: Symbol;
    /** Makes the row clickable: `onAction(action, ctx, value)`. */
    action?: string;
    /** Short text on the right: "3 min", "$42". */
    trailing?: string;
    tone?: Tone;
    value?: JSONValue;
    /** Bundle id of an installed app, e.g. `sourceApp.id`: Adanotch draws its icon at the start of the row. */
    appIcon?: string;
    /** `#RGB` or `#RRGGBB`: a colour chip at the start of the row. Wins over `appIcon` and `icon`. */
    swatch?: string;
    /** Up to 3 small round buttons at the end of the row, each sending its own `action` and `value` to `onAction`. */
    buttons?: { icon: Symbol; label: string; action: string; value?: JSONValue }[];
  }
  interface ListNode {
    type: "list";
    items: ListItem[];
  }

  type Node =
    | TextNode
    | MarkdownNode
    | IconNode
    | ImageNode
    | PetNode
    | SwatchNode
    | BadgeNode
    | GaugeNode
    | RingNode
    | ProgressNode
    | ChartNode
    | TimerNode
    | StackNode
    | GridNode
    | ScrollNode
    | TabsNode
    | DividerNode
    | SpacerNode
    | ButtonNode
    | ToggleNode
    | SliderNode
    | TextFieldNode
    | PickerNode
    | ListNode
    | TextAreaNode
    | AlertNode
    | CardNode
    | IconBadgeNode
    | DatePickerNode
    | TableNode
    | CalendarDayNode
    | CountdownNode;
  /**
   * Beside the notch there is room for an icon, a short text, a badge, a companion, a timer, a ring or progress (drawn as a small
   * ring) or a gauge (drawn as "42%").
   */
  type CompactNode =
    TextNode | IconNode | PetNode | CalendarDayNode | BadgeNode | TimerNode | GaugeNode | RingNode | ProgressNode;

  interface Compact {
    leading?: CompactNode | null;
    trailing?: CompactNode | null;
  }

  /** A view has at most 2000 nodes, 32 levels deep. */
  interface View {
    /** The closed island: `leading` left of the notch, `trailing` right of it ("compact" slot). */
    compact?: Compact | null;
    /** The open island card ("expanded" slot). */
    expanded?: Node | null;
  }
}
