import type { ColorFamily, ItemColor } from "../../shared/types.ts";

/** Decode any image blob to a canvas, optionally capped to `maxSide` on its longest edge. */
export async function blobToCanvas(blob: Blob, maxSide = Infinity): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality),
  );
}

/** A JPEG small enough to send to the tagging model (it downsizes anything bigger anyway). */
export async function photoForAnalysis(file: Blob): Promise<Blob> {
  return canvasToBlob(flattenOnWhite(await blobToCanvas(file, 1568)), "image/jpeg", 0.88);
}

/** Composite onto white so transparent areas don't turn black when encoded as JPEG. */
export function flattenOnWhite(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat;
}

/**
 * Run the in-browser segmentation model (ISNet via ONNX/WebAssembly) to cut the garment out of its background.
 * The model (~40 MB) downloads on first use and is cached by the browser afterwards.
 */
export async function cutOutBackground(file: Blob, onProgress?: (fraction: number, label: string) => void): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  // The model is fine with ~1500px; bigger inputs only slow it down.
  const input = await canvasToBlob(await blobToCanvas(file, 1500), "image/png");
  return removeBackground(input, {
    model: "isnet_fp16",
    // Model files load from img.ly's CDN by default; set VITE_BG_MODEL_URL to self-host them.
    ...(import.meta.env.VITE_BG_MODEL_URL ? { publicPath: import.meta.env.VITE_BG_MODEL_URL } : {}),
    output: { format: "image/png" },
    progress: (key, current, total) => {
      if (!onProgress) return;
      const label = key.startsWith("fetch") ? "Downloading the cut-out model (first time only)…" : "Cutting out the background…";
      onProgress(total ? current / total : 0, label);
    },
  });
}

/**
 * Turn a cut-out into a fashion plate: drop faint halo pixels, crop to the garment, add a little breathing room,
 * and cap the size so the closet stays light.
 */
export async function makePlate(cutout: Blob, maxSide = 1000): Promise<Blob> {
  const src = await blobToCanvas(cutout);
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  let minX = src.width,
    minY = src.height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4 + 3;
      if (d[i] < 24) {
        d[i] = 0;
        continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error("Nothing was left after removing the background.");
  ctx.putImageData(img, 0, 0);

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const pad = Math.round(Math.max(w, h) * 0.02);
  const scale = Math.min(1, maxSide / (Math.max(w, h) + pad * 2));
  const out = document.createElement("canvas");
  out.width = Math.round((w + pad * 2) * scale);
  out.height = Math.round((h + pad * 2) * scale);
  const octx = out.getContext("2d")!;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(src, minX, minY, w, h, pad * scale, pad * scale, w * scale, h * scale);
  return canvasToBlob(out, "image/png");
}

// ---- color helpers ---------------------------------------------------------

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function colorFamily(hex: string): ColorFamily {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  if (l < 0.13) return "black";
  if (l > 0.92 && s < 0.5) return "white";
  if (s < 0.12) return l > 0.8 ? "white" : l < 0.25 ? "black" : "gray";
  if (h < 15 || h >= 345) return l > 0.7 ? "pink" : l < 0.3 && s < 0.5 ? "brown" : "red";
  if (h < 45) {
    if (l > 0.72 && s < 0.6) return "beige";
    return l < 0.45 || s < 0.45 ? "brown" : "orange";
  }
  if (h < 68) return l > 0.75 && s < 0.6 ? "beige" : l < 0.4 ? "brown" : "yellow";
  if (h < 170) return "green";
  if (h < 250) return l < 0.3 ? "navy" : "blue";
  if (h < 290) return "purple";
  return l < 0.3 ? "purple" : "pink";
}

/** Find the garment's main colors locally (used when AI tagging is unavailable). */
export async function dominantColors(plate: Blob, count = 3): Promise<ItemColor[]> {
  const canvas = await blobToCanvas(plate, 160);
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bk.n++;
    bk.r += data[i];
    bk.g += data[i + 1];
    bk.b += data[i + 2];
    buckets.set(key, bk);
  }
  const total = [...buckets.values()].reduce((a, b) => a + b.n, 0);
  const picked: { rgb: [number, number, number]; n: number }[] = [];
  for (const bk of [...buckets.values()].sort((a, b) => b.n - a.n)) {
    const rgb: [number, number, number] = [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n];
    const near = picked.find((p) => Math.hypot(p.rgb[0] - rgb[0], p.rgb[1] - rgb[1], p.rgb[2] - rgb[2]) < 60);
    if (near) near.n += bk.n;
    else picked.push({ rgb, n: bk.n });
  }
  return picked
    .filter((p) => p.n / total > 0.06)
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((p) => {
      const hex = rgbToHex(...p.rgb);
      const family = colorFamily(hex);
      return { name: family, hex, family };
    });
}
