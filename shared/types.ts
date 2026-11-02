// Types and vocabularies shared by the server and the browser.

export const CATEGORIES = [
  "top",
  "pants",
  "skirt",
  "dress",
  "jacket",
  "shoes",
  "hat",
  "belt",
  "scarf",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const COLOR_FAMILIES = [
  "black",
  "white",
  "gray",
  "beige",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "navy",
  "purple",
  "pink",
  "gold",
  "silver",
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

export const PATTERNS = [
  "solid",
  "striped",
  "plaid",
  "floral",
  "polka dot",
  "animal print",
  "graphic",
  "geometric",
  "abstract",
  "paisley",
  "camouflage",
  "color block",
  "other",
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const SEASONS = ["spring", "summer", "fall", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export interface ItemColor {
  name: string; // human name, e.g. "dusty rose"
  hex: string; // "#c48a8a"
  family: ColorFamily;
}

/** Everything that describes a garment, whether it came from AI or was typed by hand. */
export interface ItemAttributes {
  name: string;
  category: Category;
  subcategory: string;
  colors: ItemColor[];
  pattern: Pattern;
  material: string;
  styleTags: string[];
  seasons: Season[];
  occasions: string[];
  features: string[];
  description: string;
}

export interface ClosetItem extends ItemAttributes {
  id: number;
  originalUrl: string;
  plateUrl: string;
  aiTagged: boolean;
  createdAt: string;
}

export interface AnalyzeResult {
  isClothing: boolean;
  attributes: ItemAttributes;
}

export const SKIN_TONES = [
  { id: "porcelain", label: "Porcelain", hex: "#F8DECB" },
  { id: "ivory", label: "Ivory", hex: "#EFC9A9" },
  { id: "sand", label: "Sand", hex: "#E2B28C" },
  { id: "honey", label: "Honey", hex: "#CF9A6B" },
  { id: "caramel", label: "Caramel", hex: "#B57D52" },
  { id: "chestnut", label: "Chestnut", hex: "#93603D" },
  { id: "espresso", label: "Espresso", hex: "#6C4429" },
  { id: "ebony", label: "Ebony", hex: "#47291A" },
] as const;
export type SkinTone = (typeof SKIN_TONES)[number]["id"];

export const HAIR_LENGTHS = [
  { id: "short", label: "Short" },
  { id: "chin", label: "Chin" },
  { id: "shoulder", label: "Shoulder" },
  { id: "long", label: "Long" },
] as const;
export type HairLength = (typeof HAIR_LENGTHS)[number]["id"];

export const HAIR_TEXTURES = [
  { id: "straight", label: "Straight" },
  { id: "wavy", label: "Wavy" },
  { id: "curly", label: "Curly" },
  { id: "coily", label: "Super curly" },
] as const;
export type HairTexture = (typeof HAIR_TEXTURES)[number]["id"];

export const HAIR_COLORS = [
  { id: "blonde", label: "Blonde", hex: "#E3C27D" },
  { id: "dirty-blonde", label: "Dirty blonde", hex: "#B49563" },
  { id: "strawberry-blonde", label: "Strawberry blonde", hex: "#D8935F" },
  { id: "red", label: "Red", hex: "#A3402A" },
  { id: "light-brown", label: "Light brown", hex: "#8A6143" },
  { id: "dark-brown", label: "Dark brown", hex: "#4A2F22" },
  { id: "black", label: "Black", hex: "#1D1918" },
] as const;
export type HairColor = (typeof HAIR_COLORS)[number]["id"];

export interface Avatar {
  displayName: string;
  skinTone: SkinTone;
  hairLength: HairLength;
  hairTexture: HairTexture;
  hairColor: HairColor;
}

export const DEFAULT_AVATAR: Avatar = {
  displayName: "",
  skinTone: "sand",
  hairLength: "shoulder",
  hairTexture: "wavy",
  hairColor: "dark-brown",
};

/** One garment placed on the model. Coordinates are in the model's SVG units. */
export interface OutfitLayer {
  itemId: number;
  dx: number;
  dy: number;
  scale: number;
  rotate: number;
  z: number;
}

export interface Outfit {
  id: number;
  name: string;
  layers: OutfitLayer[];
  createdAt: string;
}
