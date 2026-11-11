import type { ViewNode } from "./protocol.ts";

type Visitable = Record<string, unknown> | unknown[];

const isObject = (value: unknown): value is Visitable => typeof value === "object" && value !== null;

/** Every text in `node`: text, markdown, badges, alerts, labels, list titles, buttons and table cells. */
export function texts(node: unknown): string[] {
  const out: string[] = [];
  const visit = (value: unknown): void => {
    if (!isObject(value)) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const keys =
      value["type"] === "text" || value["type"] === "markdown"
        ? ["value"]
        : ["text", "label", "title", "subtitle", "trailing", "message", "hint"];
    for (const key of keys) {
      const field = value[key];
      if (typeof field === "string") out.push(field);
    }
    if (value["type"] === "table") {
      out.push(...(value["headers"] as string[]), ...(value["rows"] as string[][]).flat());
    }
    Object.values(value).forEach(visit);
  };
  visit(node);
  return out;
}

/** The first node of `type` in `node`, depth first, that `where` accepts. */
export function find(type: string, where: (node: ViewNode) => boolean, node: unknown): ViewNode | null {
  if (!isObject(node)) return null;
  if (!Array.isArray(node) && node["type"] === type && where(node as ViewNode)) return node as ViewNode;
  for (const child of Array.isArray(node) ? node : Object.values(node)) {
    const found = find(type, where, child);
    if (found) return found;
  }
  return null;
}
