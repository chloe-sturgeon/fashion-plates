import type { ClosetItem } from "../../shared/types.ts";

const textCache = new WeakMap<ClosetItem, string>();

function itemText(it: ClosetItem): string {
  let t = textCache.get(it);
  if (!t) {
    t = [
      it.name,
      it.category,
      it.subcategory,
      it.pattern,
      it.material,
      it.description,
      ...it.colors.flatMap((c) => [c.name, c.family]),
      ...it.styleTags,
      ...it.seasons,
      ...it.occasions,
      ...it.features,
    ]
      .join(" ")
      .toLowerCase();
    textCache.set(it, t);
  }
  return t;
}

/** True when every word of the query appears somewhere in the item's description. */
export function itemMatches(it: ClosetItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = itemText(it);
  return words.every((w) => text.includes(w));
}
