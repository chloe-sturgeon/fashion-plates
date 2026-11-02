import type { Category } from "../../shared/types.ts";

/**
 * The places on the model where clothes go. Each slot has its own ◀ ▶ arrows at `y` (model SVG units)
 * and cycles through closet items in its categories.
 */
export interface Slot {
  id: string;
  label: string;
  categories: Category[];
  zone: string;
  y: number;
}

export const SLOTS: Slot[] = [
  { id: "hat", label: "Hat", categories: ["hat"], zone: "head", y: 48 },
  { id: "scarf", label: "Scarf", categories: ["scarf"], zone: "neck", y: 128 },
  { id: "top", label: "Top", categories: ["top"], zone: "torso", y: 205 },
  { id: "jacket", label: "Jacket", categories: ["jacket"], zone: "torso", y: 285 },
  { id: "belt", label: "Belt", categories: ["belt"], zone: "waist", y: 360 },
  { id: "dress", label: "Dress", categories: ["dress"], zone: "body", y: 450 },
  { id: "bottom", label: "Bottom", categories: ["pants", "skirt"], zone: "legs", y: 610 },
  { id: "shoes", label: "Shoes", categories: ["shoes"], zone: "feet", y: 830 },
];

export const slotFor = (c: Category): Slot => SLOTS.find((s) => s.categories.includes(c))!;

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Top",
  pants: "Pants",
  skirt: "Skirt",
  dress: "Dress",
  jacket: "Jacket",
  shoes: "Shoes",
  hat: "Hat",
  belt: "Belt",
  scarf: "Scarf",
};
