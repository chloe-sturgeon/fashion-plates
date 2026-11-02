# Fashion Plates

A personal virtual closet with paper-doll style "fashion plates". Photograph your clothes, let AI catalog them,
then dress an illustrated model of yourself and save outfits to a lookbook.

## Features

**Closet: add an item**
- Upload or snap a photo of one garment.
- The background is removed **in the browser** (ISNet segmentation model via ONNX/WebAssembly,
  `@imgly/background-removal`), then the cut-out is trimmed into a clean transparent PNG: the *fashion plate*.
- At the same time the photo is sent to **Claude** (vision + structured output), which identifies the type
  (top, pants, skirt, dress, jacket, shoes, hat, belt, scarf), colors (name, hex, color family), pattern,
  material, style tags, seasons, occasions and searchable details (neckline, sleeve length, fit…).
- You review and edit everything before saving. Original photo, plate and attributes are stored in SQLite.
- Without an API key the app still works: you tag items yourself and colors are detected from the image.

**Closet: browse.** Search across every attribute ("striped linen", "red work") and filter by type and color.

**My Model.** A pen-and-ink croquis in the style of a fashion sketch: wobbly doubled ink lines, weighted accent
strokes on the shadow side, and a loose wash for one of 8 skin tones. The model doubles as your account avatar.
Models are currently drawn bald. Hair (4 lengths × 4 textures, with color shown through ink density) is built but
switched off; set `SHOW_HAIR` in `src/components/Model.tsx` and `SHOW_HAIR_OPTIONS` in `src/pages/AvatarPage.tsx`
to bring it back.

**Dressing room.** Tap **+**, search or pick what to add (top, bottom, dress, jacket, shoes, hat, scarf, belt).
Each choice puts ◀ ▶ arrows on that part of the body (hats on the head, scarves at the neck, tops and jackets
on the torso, pants and skirts on the legs, shoes on the feet) to flip through matching closet items. A search
word ("red", "linen") narrows that slot's carousel. Click a garment on the model to drag it or adjust its size
and tilt.

**Lookbook.** Name and save a look, then browse your looks as a gallery of illustrated plates, reopen one to
edit it, or delete it.

## Running it

Requires Node 22.5+ (uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env   # then add your ANTHROPIC_API_KEY for AI tagging
npm run dev            # API on :3001, app on http://localhost:5173
```

Production: `npm run build && npm start` serves the app and API together on `PORT` (default 3001).

Data (SQLite database and uploaded images) lives in `./data`, or wherever `DATA_DIR` points.

### Configuration

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables AI tagging of uploads. |
| `CLAUDE_MODEL` | Model used for tagging (default `claude-opus-5-5`). |
| `PORT` | API/server port (default `3001`). |
| `DATA_DIR` | Where the database and uploads are stored (default `./data`). |
| `VITE_BG_MODEL_URL` | Self-host the background-removal model files instead of loading them from img.ly's CDN. |

AI tagging calls Claude with `fallbacks: "default"`, so a request declined by safety classifiers is retried
on Anthropic's recommended fallback model; if it is still declined, you're asked to tag the item by hand.

## Project layout

```
shared/types.ts         Vocabularies (categories, colors, skin/hair options) and data types
server/index.ts         Express API: items, analyze, avatar, looks; serves dist/ in production
server/db.ts            SQLite schema and queries
server/classify.ts      Claude vision call with a Zod-validated structured output
src/components/figure.ts  Croquis geometry, procedural hair, where each garment type sits
src/components/Model.tsx  The illustrated, dressable model (SVG)
src/lib/imaging.ts      Background removal, plate trimming, local color detection
src/pages/              Dressing room, Closet, Add item, My Model, Lookbook
```
