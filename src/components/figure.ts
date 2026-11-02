// Geometry for the fashion-croquis model: a front-facing, elongated (~9 heads) figure in a 300 x 880 SVG space.
import type { Category, HairLength, HairTexture } from "../../shared/types.ts";

export const VIEW_W = 300;
export const VIEW_H = 880;
export const CX = VIEW_W / 2;

export const HEAD = { cx: 150, cy: 72, rx: 30, ry: 40 };

type Pt = [number, number];
/** A path written as a start point followed by cubic segments [c1, c2, end]. */
type Half = { start: Pt; segs: [Pt, Pt, Pt][] };

const mx = ([x, y]: Pt): Pt => [VIEW_W - x, y];
const p = ([x, y]: Pt) => `${x} ${y}`;

/** Build a closed, left/right-symmetric outline from its right half (which runs from top-centre to bottom-centre). */
function mirrored(half: Half): string {
  let d = `M ${p(half.start)}`;
  for (const [c1, c2, e] of half.segs) d += ` C ${p(c1)}, ${p(c2)}, ${p(e)}`;
  // Walk the mirror image back up the left side.
  const pts: Pt[] = [half.start, ...half.segs.map((s) => s[2])];
  for (let i = half.segs.length - 1; i >= 0; i--) {
    const [c1, c2] = half.segs[i];
    d += ` C ${p(mx(c2))}, ${p(mx(c1))}, ${p(mx(pts[i]))}`;
  }
  return d + " Z";
}

function single(half: Half): string {
  return `M ${p(half.start)} ` + half.segs.map(([a, b, c]) => `C ${p(a)}, ${p(b)}, ${p(c)}`).join(" ") + " Z";
}

export const BODY_PATH = mirrored({
  start: [163, 104],
  segs: [
    [[163, 118], [163, 128], [164, 136]], // neck
    [[172, 146], [196, 147], [211, 155]], // shoulder
    [[218, 160], [217, 178], [211, 198]], // shoulder cap to underarm
    [[207, 222], [203, 236], [200, 252]], // ribcage
    [[195, 272], [184, 286], [183, 304]], // waist
    [[183, 326], [203, 344], [205, 372]], // hip
    [[207, 398], [203, 425], [199, 455]], // outer thigh
    [[193, 505], [187, 560], [186, 600]], // knee
    [[186, 620], [192, 660], [188, 705]], // calf
    [[185, 745], [176, 780], [174, 805]], // ankle
    [[175, 820], [180, 838], [184, 850]], // top of foot
    [[186, 862], [172, 866], [166, 858]], // toe
    [[162, 848], [160, 830], [160, 805]], // inner ankle
    [[160, 780], [163, 740], [164, 705]], // inner calf
    [[164, 665], [160, 640], [160, 610]], // inner knee
    [[158, 560], [158, 500], [155, 445]], // inner thigh
    [[154, 436], [152, 432], [150, 432]], // crotch
  ],
});

const RIGHT_ARM: Half = {
  start: [204, 156],
  segs: [
    [[222, 160], [228, 182], [228, 210]],
    [[229, 250], [232, 282], [235, 305]],
    [[239, 345], [244, 385], [247, 418]],
    [[255, 432], [257, 462], [248, 478]],
    [[243, 486], [236, 482], [235, 470]],
    [[233, 456], [234, 440], [233, 425]],
    [[229, 392], [222, 352], [219, 316]],
    [[216, 292], [212, 262], [207, 226]],
  ],
};
const LEFT_ARM: Half = { start: mx(RIGHT_ARM.start), segs: RIGHT_ARM.segs.map((s) => s.map(mx) as [Pt, Pt, Pt]) };

/** Filled arm shapes (for the skin wash). */
export const ARM_PATHS = [single(RIGHT_ARM), single(LEFT_ARM)];

/** Arm contour lines, left open where the arm meets the torso so the drawing reads like a sketch. */
export const ARM_LINES = [RIGHT_ARM, LEFT_ARM].map(
  (h) => `M ${p(h.start)} ` + h.segs.map(([a, b, c]) => `C ${p(a)}, ${p(b)}, ${p(c)}`).join(" "),
);

/** Light anatomical hints, drawn like a fashion croquis (collarbones, joints, navel). */
export const CONTOUR_HINTS = [
  "M 127 151 C 135 157, 143 156, 148 153", // collarbones
  "M 173 151 C 165 157, 157 156, 152 153",
  "M 141 120 C 143 130, 143 138, 141 146", // neck tendons
  "M 159 120 C 157 130, 157 138, 159 146",
  "M 177 596 C 181 601, 183 605, 183 611", // knees
  "M 123 596 C 119 601, 117 605, 117 611",
  "M 168 584 C 170 590, 171 596, 170 602",
  "M 132 584 C 130 590, 129 596, 130 602",
  "M 176 800 C 179 804, 179 808, 177 811", // ankle bones
  "M 124 800 C 121 804, 121 808, 123 811",
  "M 222 300 C 226 305, 228 309, 228 313", // elbows
  "M 78 300 C 74 305, 72 309, 72 313",
  "M 150 322 C 149 324, 151 326, 150 327", // navel
];

/** A simple croquis bodysuit: scoop neck, high-cut legs. */
export const LEOTARD = mirrored({
  start: [150, 194],
  segs: [
    [[160, 194], [171, 176], [174, 147]],
    [[177, 147], [180, 147], [182, 148]],
    [[190, 166], [199, 181], [207, 194]],
    [[204, 222], [203, 236], [200, 252]],
    [[195, 272], [184, 286], [183, 304]],
    [[183, 326], [203, 344], [205, 372]],
    [[190, 386], [164, 406], [150, 432]],
  ],
});

// ---- where clothes sit ------------------------------------------------------

export interface SlotBox {
  x: number;
  y: number;
  w: number;
  h: number;
  align: string; // SVG preserveAspectRatio
}

export const SLOT_BOXES: Record<Category, SlotBox> = {
  hat: { x: 96, y: 0, w: 108, h: 72, align: "xMidYMax meet" },
  scarf: { x: 108, y: 104, w: 84, h: 120, align: "xMidYMin meet" },
  top: { x: 78, y: 138, w: 144, h: 228, align: "xMidYMin meet" },
  jacket: { x: 58, y: 134, w: 184, h: 310, align: "xMidYMin meet" },
  dress: { x: 76, y: 138, w: 148, h: 480, align: "xMidYMin meet" },
  belt: { x: 110, y: 290, w: 80, h: 32, align: "xMidYMid meet" },
  skirt: { x: 86, y: 292, w: 128, h: 250, align: "xMidYMin meet" },
  pants: { x: 98, y: 296, w: 104, h: 534, align: "xMidYMin meet" },
  shoes: { x: 108, y: 790, w: 84, h: 82, align: "xMidYMax meet" },
};

/** Default stacking order: later = on top. */
export const CATEGORY_Z: Record<Category, number> = {
  shoes: 10,
  pants: 20,
  skirt: 30,
  top: 40,
  dress: 45,
  belt: 50,
  jacket: 60,
  scarf: 70,
  hat: 80,
};

// ---- hair -------------------------------------------------------------------

const VOLUME: Record<HairTexture, number> = { straight: 1, wavy: 1.12, curly: 1.3, coily: 1.55 };
/** Curly hair "shrinks" — it hangs shorter than the same hair straightened. */
const SHRINK: Record<HairTexture, number> = { straight: 1, wavy: 0.95, curly: 0.85, coily: 0.7 };
const LENGTH_Y: Record<HairLength, number> = { short: 96, chin: 128, shoulder: 182, long: 310 };

/** Smooth closed curve through points (Catmull-Rom → cubic Bézier). */
function smoothClosed(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${p(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${p(c1.map(r1) as Pt)}, ${p(c2.map(r1) as Pt)}, ${p(p2.map(r1) as Pt)}`;
  }
  return d + " Z";
}
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Smooth open curve through points (Catmull-Rom → cubic Bézier). */
function smoothOpen(pts: Pt[]): string {
  let d = `M ${p(pts[0].map(r1) as Pt)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${p(c1.map(r1) as Pt)}, ${p(c2.map(r1) as Pt)}, ${p(p2.map(r1) as Pt)}`;
  }
  return d;
}

/** Dense points along the smooth closed curve, spaced roughly `step` apart. */
function densify(pts: Pt[], step: number): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k = Math.max(1, Math.round(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, e: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t2 + (-a + 3 * b - 3 * c + e) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** Bumpy, cloud-like edge for curly hair: an outward arc between each pair of neighbouring points. */
function scalloped(pts: Pt[], radius: number): string {
  let d = `M ${p(pts[0].map(r1) as Pt)}`;
  for (let i = 1; i <= pts.length; i++) {
    const q = pts[i % pts.length];
    d += ` A ${radius} ${radius} 0 0 1 ${p(q.map(r1) as Pt)}`;
  }
  return d + " Z";
}

/** Wavy edge: push points in and out along the outline's normal, more strongly further down the hair. */
function waved(pts: Pt[], amp: number, wavelength: number): Pt[] {
  let s = 0;
  return pts.map((pt, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    s += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const tl = Math.hypot(tx, ty) || 1;
    // Outward normal for a clockwise (screen-space) outline.
    const nx = ty / tl;
    const ny = -tx / tl;
    const ramp = Math.min(1, Math.max(0, (pt[1] - 70) / 60));
    const off = amp * ramp * Math.sin((2 * Math.PI * s) / wavelength);
    return [pt[0] + nx * off, pt[1] + ny * off];
  });
}

export interface HairShapes {
  back: string;
  front: string;
  /** Just the hairline edge of `front`, for the pen line. */
  hairline: string;
  /** Texture marks (strands or curl swirls), drawn inside the back hair. */
  marks: string[];
  /** Strands over the crown (straight and wavy hair only). */
  frontMarks: string[];
  markKind: "strand" | "curl";
}

export function hairShapes(length: HairLength, texture: HairTexture): HairShapes {
  const vol = VOLUME[texture];
  const { cx, cy, ry } = HEAD;
  const top = cy - ry - 5 - (vol - 1) * 34;
  const w0 = 35 * vol; // half-width beside the temples
  const bottom = cy + (LENGTH_Y[length] - cy) * SHRINK[texture];
  const longish = bottom > 140;
  const wB = longish ? Math.min(w0 + 16 * vol, 62 * vol) : w0 * 0.96;

  // Right half, top to bottom (clockwise on screen); mirrored afterwards.
  const right: Pt[] = [
    [cx + w0 * 0.62, top + (cy - top) * 0.12],
    [cx + w0 * 0.95, top + (cy - top) * 0.55],
    [cx + w0, cy + 6],
  ];
  if (longish) {
    right.push([cx + (w0 + wB) / 2 + 2, Math.min(130, (cy + bottom) / 2)]);
    right.push([cx + wB, (130 + bottom) / 2 + 10]);
    right.push([cx + wB * 0.9, bottom - 4]);
    right.push([cx + wB * 0.45, bottom + 4]);
  } else {
    right.push([cx + w0 * 0.93, bottom - 6]);
    right.push([cx + w0 * 0.55, bottom + 2]);
  }
  const left = [...right].reverse().map(([x, y]): Pt => [VIEW_W - x, y]);
  const outline: Pt[] = [[cx, top], ...right, [cx, bottom + (longish ? 6 : 3)], ...left];

  let back: string;
  if (texture === "straight") back = smoothClosed(outline);
  else if (texture === "wavy") back = smoothClosed(waved(densify(outline, 6), 5, 46));
  else {
    const step = texture === "curly" ? 15 : 10;
    back = scalloped(densify(outline, step), step * 0.66);
  }

  // The piece covering the top of the head, with a soft side part.
  const fw = Math.min(w0, 36);
  const crownTop = Math.max(top + 4, cy - ry - 6);
  const frontPts = {
    l: [cx - fw + 3, cy + 12] as Pt,
    r: [cx + fw - 3, cy + 12] as Pt,
  };
  const hairlineDip = texture === "coily" ? 0 : 6;
  const hairline =
    `M ${p(frontPts.r)} C ${cx + 27} ${cy - 10}, ${cx + 22} ${cy - 30 + hairlineDip}, ${cx - 8} ${cy - 30} ` +
    `C ${cx - 20} ${cy - 26 + hairlineDip}, ${cx - 28} ${cy - 10}, ${p(frontPts.l)}`;
  const front =
    `M ${p(frontPts.l)} C ${cx - fw - 6} ${cy - 28}, ${cx - 20} ${crownTop}, ${cx + 2} ${crownTop} ` +
    `C ${cx + 24} ${crownTop}, ${cx + fw + 6} ${cy - 28}, ` +
    hairline.slice(2) +
    " Z";

  // Texture marks: pen strands or curl loops. They are ordered so that any prefix is spread evenly across the hair,
  // which lets darker hair simply draw more of them.
  const marks: string[] = [];
  const frontMarks: string[] = [];
  let markKind: HairShapes["markKind"] = "strand";
  const golden = (i: number) => (0.5 + i * 0.618034) % 1;
  if (texture === "straight" || texture === "wavy") {
    const reach = longish ? wB * 0.95 : w0 * 0.92;
    for (let i = 0; i < 30; i++) {
      const t = golden(i) * 2 - 1; // -1 (left) … 1 (right)
      // Start along the crown so the outer strands hug the sides of the head, where they're visible.
      const x0 = cx - 6 + t * w0 * 0.8;
      const y0 = top + 7 + t * t * (cy - top) * 0.55;
      const x1 = cx + t * reach;
      const y1 = bottom - 4 - golden(i * 7 + 3) * (longish ? 26 : 10);
      const c1: Pt = [x0 + t * w0 * 0.55, y0 + (y1 - y0) * 0.12];
      const c2: Pt = [x1 + t * 3, y1 - (y1 - y0) * 0.5];
      if (texture === "straight") {
        marks.push(`M ${r1(x0)} ${r1(y0)} C ${r1(c1[0])} ${r1(c1[1])}, ${r1(c2[0])} ${r1(c2[1])}, ${r1(x1)} ${r1(y1)}`);
      } else {
        // Sample the curve and let it ripple sideways, more strongly lower down.
        const pts: Pt[] = [];
        const phase = golden(i * 3) * 0.6;
        for (let k = 0; k <= 16; k++) {
          const u = k / 16;
          const v = 1 - u;
          const x = v * v * v * x0 + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * x1;
          const y = v * v * v * y0 + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * y1;
          const ramp = Math.min(1, Math.max(0, (y - cy + 10) / 50));
          pts.push([x + 5 * ramp * Math.sin((y / 46 + phase) * 2 * Math.PI), y]);
        }
        marks.push(smoothOpen(pts));
      }
    }
    // Strands sweeping away from the side part, over the crown.
    for (let i = 0; i < 16; i++) {
      const t = golden(i + 11);
      const side = i % 3 === 0 ? -1 : 1;
      const ex = cx + side * (14 + t * 20);
      const ey = cy - 22 + t * 34;
      frontMarks.push(
        `M ${r1(cx - 8)} ${r1(cy - 30)} Q ${r1(cx - 8 + side * (10 + t * 14))} ${r1(cy - 36 + t * 4)}, ${r1(ex)} ${r1(ey)}`,
      );
    }
  } else {
    markKind = "curl";
    const size = texture === "curly" ? 5.5 : 3.6;
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const tries = texture === "curly" ? 260 : 420;
    for (let i = 0; i < tries; i++) {
      const x = cx - wB - w0 + rand() * (wB + w0) * 2;
      const y = top + rand() * (bottom - top);
      const s = size * (0.7 + rand() * 0.6);
      const turn = rand() > 0.5 ? 1 : 0;
      if (!insidePolygon([x, y], outline)) continue;
      // Leave the face clear.
      if (((x - cx) / (HEAD.rx + 2)) ** 2 + ((y - cy - 6) / ry) ** 2 < 1 && y > cy - 26) continue;
      // A loose pen loop: most of a circle with a little tail.
      marks.push(
        `M ${r1(x - s)} ${r1(y + s * 0.3)} a ${r1(s)} ${r1(s * 0.9)} 0 1 ${turn} ${r1(s * 1.6)} ${r1(s * 0.5)}`,
      );
    }
  }

  return { back, front, hairline, marks, frontMarks, markKind };
}

function insidePolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- colour helpers -------------------------------------------------------

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** The body contour as an open line (no stroke across the top of the neck, which the head covers). */
export const BODY_LINE = BODY_PATH.replace(/\s*Z$/, "")
  // Start and end the neck just under the jaw so the line doesn't run up into the face.
  .replace(/^M 163 104 C 163 118, /, "M 163 111 C 163 120, ")
  .replace(/C 137 128, 137 118, 137 104$/, "C 137 128, 137 120, 137 111");

/**
 * Bold pen accents on the shadow side of the figure, the way illustrators weight a line where the form turns away
 * from the light.
 */
export const ACCENT_LINES = [
  "M 209 206 C 206 226, 203 238, 200 252 C 195 272, 186 286, 184 300", // right ribcage to waist
  "M 206 380 C 207 400, 203 425, 199 455 C 195 490, 191 525, 189 560", // right outer thigh
  "M 140 800 C 139.5 780, 137 745, 136 712", // left inner calf
  "M 189 690 C 186 735, 178 772, 175 800", // right outer calf
  "M 236 312 C 240 348, 244 386, 246 414", // right forearm
  "M 176 98 C 172 106, 164 112, 154 114", // jaw, shadow side
];
