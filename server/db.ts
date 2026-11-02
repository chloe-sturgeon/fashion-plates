import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_AVATAR,
  type Avatar,
  type ClosetItem,
  type ItemAttributes,
  type Outfit,
  type OutfitLayer,
} from "../shared/types.ts";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "closet.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    subcategory   TEXT NOT NULL DEFAULT '',
    colors        TEXT NOT NULL DEFAULT '[]',
    pattern       TEXT NOT NULL DEFAULT 'solid',
    material      TEXT NOT NULL DEFAULT '',
    style_tags    TEXT NOT NULL DEFAULT '[]',
    seasons       TEXT NOT NULL DEFAULT '[]',
    occasions     TEXT NOT NULL DEFAULT '[]',
    features      TEXT NOT NULL DEFAULT '[]',
    description   TEXT NOT NULL DEFAULT '',
    search_text   TEXT NOT NULL DEFAULT '',
    original_file TEXT NOT NULL,
    plate_file    TEXT NOT NULL,
    ai_tagged     INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS items_category ON items(category);

  CREATE TABLE IF NOT EXISTS avatar (
    id   INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outfits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    layers     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

type Row = Record<string, unknown>;

function searchText(a: ItemAttributes): string {
  return [
    a.name,
    a.category,
    a.subcategory,
    a.pattern,
    a.material,
    a.description,
    ...a.colors.flatMap((c) => [c.name, c.family]),
    ...a.styleTags,
    ...a.seasons,
    ...a.occasions,
    ...a.features,
  ]
    .join(" ")
    .toLowerCase();
}

function rowToItem(r: Row): ClosetItem {
  return {
    id: Number(r.id),
    name: String(r.name),
    category: r.category as ClosetItem["category"],
    subcategory: String(r.subcategory),
    colors: JSON.parse(String(r.colors)),
    pattern: r.pattern as ClosetItem["pattern"],
    material: String(r.material),
    styleTags: JSON.parse(String(r.style_tags)),
    seasons: JSON.parse(String(r.seasons)),
    occasions: JSON.parse(String(r.occasions)),
    features: JSON.parse(String(r.features)),
    description: String(r.description),
    originalUrl: `/uploads/${r.original_file}`,
    plateUrl: `/uploads/${r.plate_file}`,
    aiTagged: Boolean(r.ai_tagged),
    createdAt: String(r.created_at),
  };
}

export interface ItemQuery {
  q?: string;
  category?: string;
  color?: string;
}

export function listItems({ q, category, color }: ItemQuery): ClosetItem[] {
  const where: string[] = [];
  const params: string[] = [];
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (color) {
    // colors is a JSON array; match on the family field.
    where.push("EXISTS (SELECT 1 FROM json_each(items.colors) WHERE json_extract(value, '$.family') = ?)");
    params.push(color);
  }
  // Every word must appear somewhere in the item's searchable text.
  for (const word of (q ?? "").toLowerCase().split(/\s+/).filter(Boolean)) {
    where.push("search_text LIKE ?");
    params.push(`%${word}%`);
  }
  const sql = `SELECT * FROM items ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC`;
  return (db.prepare(sql).all(...params) as Row[]).map(rowToItem);
}

export function getItem(id: number): ClosetItem | undefined {
  const r = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as Row | undefined;
  return r ? rowToItem(r) : undefined;
}

export function getItemFiles(id: number): string[] {
  const r = db.prepare("SELECT original_file, plate_file FROM items WHERE id = ?").get(id) as Row | undefined;
  return r ? [String(r.original_file), String(r.plate_file)] : [];
}

function attrParams(a: ItemAttributes) {
  return [
    a.name,
    a.category,
    a.subcategory,
    JSON.stringify(a.colors),
    a.pattern,
    a.material,
    JSON.stringify(a.styleTags),
    JSON.stringify(a.seasons),
    JSON.stringify(a.occasions),
    JSON.stringify(a.features),
    a.description,
    searchText(a),
  ];
}

export function insertItem(
  a: ItemAttributes,
  files: { original: string; plate: string },
  aiTagged: boolean,
): ClosetItem {
  const res = db
    .prepare(
      `INSERT INTO items (name, category, subcategory, colors, pattern, material, style_tags, seasons,
         occasions, features, description, search_text, original_file, plate_file, ai_tagged)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(...attrParams(a), files.original, files.plate, aiTagged ? 1 : 0);
  return getItem(Number(res.lastInsertRowid))!;
}

export function updateItem(id: number, a: ItemAttributes): ClosetItem | undefined {
  db.prepare(
    `UPDATE items SET name = ?, category = ?, subcategory = ?, colors = ?, pattern = ?, material = ?,
       style_tags = ?, seasons = ?, occasions = ?, features = ?, description = ?, search_text = ?
     WHERE id = ?`,
  ).run(...attrParams(a), id);
  return getItem(id);
}

export function deleteItem(id: number): void {
  db.prepare("DELETE FROM items WHERE id = ?").run(id);
}

export function getAvatar(): Avatar {
  const r = db.prepare("SELECT data FROM avatar WHERE id = 1").get() as Row | undefined;
  return r ? { ...DEFAULT_AVATAR, ...JSON.parse(String(r.data)) } : DEFAULT_AVATAR;
}

export function saveAvatar(a: Avatar): Avatar {
  db.prepare("INSERT INTO avatar (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data").run(
    JSON.stringify(a),
  );
  return getAvatar();
}

function rowToOutfit(r: Row): Outfit {
  return {
    id: Number(r.id),
    name: String(r.name),
    layers: JSON.parse(String(r.layers)),
    createdAt: String(r.created_at),
  };
}

export function listOutfits(): Outfit[] {
  return (db.prepare("SELECT * FROM outfits ORDER BY id DESC").all() as Row[]).map(rowToOutfit);
}

export function saveOutfit(name: string, layers: OutfitLayer[], id?: number): Outfit {
  if (id) {
    db.prepare("UPDATE outfits SET name = ?, layers = ? WHERE id = ?").run(name, JSON.stringify(layers), id);
    return rowToOutfit(db.prepare("SELECT * FROM outfits WHERE id = ?").get(id) as Row);
  }
  const res = db.prepare("INSERT INTO outfits (name, layers) VALUES (?, ?)").run(name, JSON.stringify(layers));
  return rowToOutfit(db.prepare("SELECT * FROM outfits WHERE id = ?").get(Number(res.lastInsertRowid)) as Row);
}

export function deleteOutfit(id: number): void {
  db.prepare("DELETE FROM outfits WHERE id = ?").run(id);
}
