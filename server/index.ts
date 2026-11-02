// Load .env if present (Node >= 21.7).
import fs0 from "node:fs";
if (fs0.existsSync(".env")) process.loadEnvFile(".env");

import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  CATEGORIES,
  COLOR_FAMILIES,
  HAIR_COLORS,
  HAIR_LENGTHS,
  HAIR_TEXTURES,
  PATTERNS,
  SEASONS,
  SKIN_TONES,
} from "../shared/types.ts";
import { ClassifyError, classifyClothing } from "./classify.ts";
import * as db from "./db.ts";

const PORT = Number(process.env.PORT ?? 3001);
const app = express();
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ---- validation -----------------------------------------------------------

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((x) => x.id) as unknown as [T[number]["id"], ...T[number]["id"][]];

const strList = z.array(z.string().trim().max(60)).max(20).default([]);
const AttributesSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORIES),
  subcategory: z.string().trim().max(80).default(""),
  colors: z
    .array(
      z.object({
        name: z.string().trim().max(40),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        family: z.enum(COLOR_FAMILIES),
      }),
    )
    .max(6)
    .default([]),
  pattern: z.enum(PATTERNS).default("solid"),
  material: z.string().trim().max(80).default(""),
  styleTags: strList,
  seasons: z.array(z.enum(SEASONS)).default([]),
  occasions: strList,
  features: strList,
  description: z.string().trim().max(1000).default(""),
});

const AvatarSchema = z.object({
  displayName: z.string().trim().max(60).default(""),
  skinTone: z.enum(ids(SKIN_TONES)),
  hairLength: z.enum(ids(HAIR_LENGTHS)),
  hairTexture: z.enum(ids(HAIR_TEXTURES)),
  hairColor: z.enum(ids(HAIR_COLORS)),
});

const OutfitSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(80),
  layers: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        dx: z.number(),
        dy: z.number(),
        scale: z.number().min(0.1).max(5),
        rotate: z.number().min(-180).max(180),
        z: z.number(),
      }),
    )
    .max(30),
});

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
type ImageType = keyof typeof IMAGE_TYPES;
const isImageType = (t: string): t is ImageType => t in IMAGE_TYPES;

function saveUpload(file: Express.Multer.File): string {
  if (!isImageType(file.mimetype)) throw new HttpError(400, `Unsupported image type: ${file.mimetype}`);
  const name = `${crypto.randomUUID()}.${IMAGE_TYPES[file.mimetype]}`;
  fs.writeFileSync(path.join(db.UPLOAD_DIR, name), file.buffer);
  return name;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const idParam = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Bad id");
  return id;
};

// ---- routes ---------------------------------------------------------------

app.get("/api/status", (_req, res) => {
  res.json({ aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) });
});

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, "No image uploaded");
  if (!isImageType(file.mimetype)) throw new HttpError(400, `Unsupported image type: ${file.mimetype}`);
  res.json(await classifyClothing(file.buffer, file.mimetype));
});

app.get("/api/items", (req, res) => {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  res.json(db.listItems({ q: str(req.query.q), category: str(req.query.category), color: str(req.query.color) }));
});

app.post(
  "/api/items",
  upload.fields([
    { name: "original", maxCount: 1 },
    { name: "plate", maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const original = files?.original?.[0];
    const plate = files?.plate?.[0];
    if (!original || !plate) throw new HttpError(400, "Both the original photo and the fashion plate are required");
    const attrs = AttributesSchema.parse(JSON.parse(String(req.body.attributes ?? "{}")));
    const aiTagged = req.body.aiTagged === "true";
    const item = db.insertItem(attrs, { original: saveUpload(original), plate: saveUpload(plate) }, aiTagged);
    res.status(201).json(item);
  },
);

app.patch("/api/items/:id", (req, res) => {
  const item = db.updateItem(idParam(req), AttributesSchema.parse(req.body));
  if (!item) throw new HttpError(404, "Item not found");
  res.json(item);
});

app.delete("/api/items/:id", (req, res) => {
  const id = idParam(req);
  const files = db.getItemFiles(id);
  db.deleteItem(id);
  for (const f of files) fs.rm(path.join(db.UPLOAD_DIR, f), { force: true }, () => {});
  res.status(204).end();
});

app.get("/api/avatar", (_req, res) => {
  res.json(db.getAvatar());
});

app.put("/api/avatar", (req, res) => {
  res.json(db.saveAvatar(AvatarSchema.parse(req.body)));
});

app.get("/api/outfits", (_req, res) => {
  res.json(db.listOutfits());
});

app.post("/api/outfits", (req, res) => {
  const o = OutfitSchema.parse(req.body);
  res.status(o.id ? 200 : 201).json(db.saveOutfit(o.name, o.layers, o.id));
});

app.delete("/api/outfits/:id", (req, res) => {
  db.deleteOutfit(idParam(req));
  res.status(204).end();
});

app.use("/uploads", express.static(db.UPLOAD_DIR, { maxAge: "30d", immutable: true }));

// In production, serve the built front end from the same server.
if (process.env.NODE_ENV === "production") {
  const dist = path.resolve("dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError || err instanceof ClassifyError) {
    res.status(err.status).json({ error: err.message });
  } else if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid data", issues: err.issues });
  } else if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof SyntaxError) {
    res.status(400).json({ error: "Malformed JSON" });
  } else {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(`Fashion Plates API listening on http://localhost:${PORT}`);
});
