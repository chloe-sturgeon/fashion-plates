import { useId, useMemo, useRef } from "react";
import { SKIN_TONES, type Avatar, type ClosetItem, type HairColor } from "../../shared/types.ts";
import {
  ACCENT_LINES,
  ARM_LINES,
  ARM_PATHS,
  BODY_LINE,
  BODY_PATH,
  CONTOUR_HINTS,
  HEAD,
  LEOTARD,
  SLOT_BOXES,
  VIEW_H,
  VIEW_W,
  hairShapes,
  shade,
} from "./figure.ts";

export interface Adjust {
  dx: number;
  dy: number;
  scale: number;
  rotate: number;
}
export const NO_ADJUST: Adjust = { dx: 0, dy: 0, scale: 1, rotate: 0 };

export interface WornLayer {
  item: ClosetItem;
  adjust: Adjust;
  z: number;
}

interface Props {
  avatar: Avatar;
  layers?: WornLayer[];
  selectedId?: number | null;
  onSelect?: (id: number | null) => void;
  onMove?: (id: number, dx: number, dy: number) => void;
  className?: string;
  title?: string;
  /** Show only the head and shoulders (for avatar badges). */
  headshot?: boolean;
}

const INK = "#1f1a18";
const PAPER = "#fffefb";
/**
 * Hair is switched off for now: every model is drawn bald, like a blank croquis. The hair generator, the avatar's
 * hair settings and this rendering are all kept, so turning this back on restores them.
 */
const SHOW_HAIR = false;
const HEAD_OUTLINE = "M 150 32 C 168 32, 180 46, 180 67 C 180 93, 166 114, 150 114 C 134 114, 120 93, 120 67 C 120 46, 132 32, 150 32 Z";
/**
 * Hair is drawn in ink only. Its colour reads the way it does in a pen sketch: through how many strands are drawn
 * and how much hatching darkens it (0 = palest blonde, 1 = black).
 */
const HAIR_INK: Record<HairColor, number> = {
  blonde: 0.12,
  "strawberry-blonde": 0.28,
  "dirty-blonde": 0.34,
  red: 0.42,
  "light-brown": 0.52,
  "dark-brown": 0.78,
  black: 1,
};
/** The skin wash is painted a touch off the ink line, the way illustrators work. */
const WASH_OFFSET = "translate(2.2 1.6)";
/** Broken pen strokes: long marks with small lifts of the pen. */
const PEN_BREAKS = "260 2.5 120 1.5 340 3";

/**
 * The customizable model, drawn like a fashion illustration: ink line art over a loose watercolour wash,
 * with only suggested facial features. Optionally dressed in closet items.
 */
export default function Model({ avatar, layers = [], selectedId, onSelect, onMove, className, title, headshot }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const f = (name: string) => `url(#${name}${uid})`;

  const skin = SKIN_TONES.find((s) => s.id === avatar.skinTone)?.hex ?? SKIN_TONES[2].hex;
  const ink = HAIR_INK[avatar.hairColor] ?? 0.5;
  const hairGeo = useMemo(() => hairShapes(avatar.hairLength, avatar.hairTexture), [avatar.hairLength, avatar.hairTexture]);
  const skinEdge = shade(skin, -0.28);
  const feature = shade(skin, -0.62); // facial strokes are a deeper tone of the skin, not black ink
  const curly = hairGeo.markKind === "curl";
  const markCount = Math.round(hairGeo.marks.length * (curly ? 0.35 + 0.65 * ink : 0.3 + 0.7 * ink));
  const hairMarks = hairGeo.marks.slice(0, markCount);
  const frontMarks = hairGeo.frontMarks.slice(0, Math.round(hairGeo.frontMarks.length * (0.4 + 0.6 * ink)));
  const hatch = ink < 0.3 ? 0 : (ink - 0.2) * 0.75; // hatching opacity
  const interactive = Boolean(onSelect);

  const startDrag = (e: React.PointerEvent, layer: WornLayer) => {
    if (!onSelect) return;
    e.stopPropagation();
    onSelect(layer.item.id);
    if (!onMove || !svgRef.current) return;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const target = e.currentTarget as Element;
    target.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, dx: layer.adjust.dx, dy: layer.adjust.dy };
    const move = (ev: PointerEvent) => {
      onMove(layer.item.id, start.dx + (ev.clientX - start.x) / ctm.a, start.dy + (ev.clientY - start.y) / ctm.d);
    };
    const up = () => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  const sorted = [...layers].sort((a, b) => a.z - b.z);

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={headshot ? "84 16 132 132" : `0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={title ?? "Fashion model"}
      onPointerDown={interactive ? () => onSelect?.(null) : undefined}
    >
      <defs>
        {/* Watercolour: wobbly edges, and patchy coverage like a quick wash of colour. */}
        <filter id={`wash${uid}`} x="-10%" y="-5%" width="120%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.006" numOctaves="2" seed="11" result="blot" />
          <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.8 0.1" result="mask" />
          <feComposite in="d" in2="mask" operator="in" result="patchy" />
          <feGaussianBlur in="patchy" stdDeviation="0.7" />
        </filter>
        {/* Pigment pooling at the edge of a wash. */}
        <filter id={`pool${uid}`} x="-10%" y="-5%" width="120%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.6" />
        </filter>
        {/* Hand-drawn ink: a little tremor in the line. */}
        <filter id={`ink${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* A second, looser pass of the pen. */}
        <filter id={`ink2${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <pattern id={`hatch${uid}`} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <line x1="0" y1="0" x2="0" y2="3.2" stroke={INK} strokeWidth="0.7" />
        </pattern>
        <clipPath id={`hairclip${uid}`}>
          <path d={hairGeo.back} />
        </clipPath>
        <clipPath id={`frontclip${uid}`}>
          <path d={hairGeo.front} />
        </clipPath>
        <filter id={`soft${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        {/* Clothing plates get a sketchy ink outline so photos sit inside the illustration. */}
        <filter id={`plate${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.9" result="grown" />
          <feComposite in="grown" in2="SourceAlpha" operator="out" result="edge" />
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" seed="2" result="n" />
          <feDisplacementMap in="edge" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="wob" />
          <feFlood floodColor={INK} floodOpacity="0.75" />
          <feComposite in2="wob" operator="in" result="line" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="line" />
          </feMerge>
        </filter>
        <radialGradient id={`blush${uid}`}>
          <stop offset="0" stopColor="#d9707c" stopOpacity="0.22" />
          <stop offset="1" stopColor="#d9707c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft ground shadow */}
      {!headshot && <ellipse cx={152} cy={866} rx={52} ry={6} fill={INK} opacity={0.06} filter={f("pool")} />}

      {SHOW_HAIR && (
        <>
      {/* ---- back hair: ink only ---- */}
      <path d={hairGeo.back} fill={PAPER} />
      {hatch > 0 && <path d={hairGeo.back} fill={`url(#hatch${uid})`} opacity={hatch} filter={f("ink")} />}
      <g fill="none" stroke={INK} strokeLinecap="round" clipPath={`url(#hairclip${uid})`}>
        <g filter={f("ink2")}>
          {hairMarks.map((d, i) => (
            <path key={i} d={d} strokeWidth={curly ? 0.8 : i % 4 ? 0.55 : 0.9} opacity={(curly ? 0.55 : 0.45) + 0.4 * ink} />
          ))}
        </g>
      </g>
      <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <path d={hairGeo.back} strokeWidth={1} strokeDasharray={curly ? undefined : PEN_BREAKS} filter={f("ink")} />
        <path d={hairGeo.back} strokeWidth={0.5} opacity={0.4} filter={f("ink2")} transform="translate(0.8 -0.6)" />
      </g>
        </>
      )}

      {/* ---- paper underlay: the figure is opaque even though its wash is not ---- */}
      <g fill={PAPER}>
        {ARM_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
        <path d={BODY_PATH} />
        <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} />
      </g>

      {/* ---- skin wash (one layer, so overlaps don't darken) ---- */}
      <g transform={WASH_OFFSET}>
        <g opacity={0.8} filter={f("wash")} fill={skin}>
          {ARM_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
          <path d={BODY_PATH} />
          <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} />
        </g>
        <g fill="none" stroke={skinEdge} strokeWidth={2} opacity={0.14} filter={f("pool")}>
          <path d={BODY_PATH} />
          {ARM_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>

      {/* ---- croquis bodysuit ---- */}
      <path d={LEOTARD} fill={PAPER} />

      {/* ---- ink line art ---- */}
      <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round" filter={f("ink")}>
        <path d={BODY_LINE} strokeWidth={1.1} strokeDasharray={PEN_BREAKS} />
        {ARM_LINES.map((d) => (
          <path key={d} d={d} strokeWidth={0.95} strokeDasharray={PEN_BREAKS} />
        ))}
        <path d={LEOTARD} strokeWidth={0.7} opacity={0.7} strokeDasharray="90 3 40 2" />
        <g strokeWidth={0.7} opacity={0.55}>
          {CONTOUR_HINTS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        {SHOW_HAIR ? (
          /* jaw and cheek: open at the top where the hair covers the head */
          <path d="M 121 64 C 119 92, 133 114, 150 114 C 167 114, 181 92, 179 64" strokeWidth={0.85} opacity={0.85} />
        ) : (
          /* the whole head, egg-shaped like a croquis */
          <path d={HEAD_OUTLINE} strokeWidth={0.95} strokeDasharray="150 3 90 2" />
        )}
      </g>
      {/* a looser second pass of the pen, slightly off the first */}
      <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round" filter={f("ink2")} opacity={0.38} transform="translate(0.9 -0.7)">
        {!SHOW_HAIR && <path d={HEAD_OUTLINE} strokeWidth={0.5} strokeDasharray="60 10 120 8" />}
        <path d={BODY_LINE} strokeWidth={0.55} strokeDasharray="70 9 160 6 40 12" />
        {ARM_LINES.map((d) => (
          <path key={d} d={d} strokeWidth={0.5} strokeDasharray="90 8 50 14" />
        ))}
      </g>
      {/* weighted accents on the shadow side */}
      <g fill="none" stroke={INK} strokeLinecap="round" filter={f("ink2")} opacity={0.85}>
        {ACCENT_LINES.map((d) => (
          <path key={d} d={d} strokeWidth={2.1} />
        ))}
      </g>

      {/* ---- face: barely-there, suggested features ---- */}
      <ellipse cx={136} cy={89} rx={9} ry={5} fill={`url(#blush${uid})`} />
      <ellipse cx={164} cy={89} rx={9} ry={5} fill={`url(#blush${uid})`} />
      <g fill="none" stroke={feature} strokeLinecap="round" filter={f("soft")}>
        {/* brows */}
        <path d="M 135 66.5 Q 140 64 145.5 66" strokeWidth={0.7} opacity={0.35} />
        <path d="M 154.5 66 Q 160 64 165 66.5" strokeWidth={0.7} opacity={0.35} />
        {/* lowered lids / lash lines */}
        <path d="M 136 75.5 Q 140.5 73.5 145 75.5" strokeWidth={1.1} opacity={0.6} />
        <path d="M 155 75.5 Q 159.5 73.5 164 75.5" strokeWidth={1.1} opacity={0.6} />
        {/* the side of the nose, a single short stroke */}
        <path d="M 151.5 82 Q 152.5 87 150 89" strokeWidth={0.6} opacity={0.3} />
      </g>
      <path d="M 145 98.5 Q 150 96.5 155 98.5 Q 150 101.5 145 98.5 Z" fill="#b0525d" opacity={0.42} filter={f("soft")} />

      {SHOW_HAIR && (
        <>
      {/* ---- hair framing the face ---- */}
      <path d={hairGeo.front} fill={PAPER} />
      {hatch > 0 && <path d={hairGeo.front} fill={`url(#hatch${uid})`} opacity={hatch} filter={f("ink")} />}
      <g fill="none" stroke={INK} strokeLinecap="round" filter={f("ink2")}>
        {frontMarks.map((d, i) => (
          <path key={i} d={d} strokeWidth={i % 3 ? 0.55 : 0.85} opacity={0.5 + 0.35 * ink} />
        ))}
        {curly && (
          <g clipPath={`url(#frontclip${uid})`}>
            {hairMarks.map((d, i) => (
              <path key={i} d={d} strokeWidth={0.8} opacity={0.55 + 0.4 * ink} />
            ))}
          </g>
        )}
      </g>
      <path
        d={hairGeo.hairline}
        fill="none"
        stroke={INK}
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={curly ? 0.55 : 0.85}
        filter={f("ink")}
      />
        </>
      )}

      {/* ---- clothing ---- */}
      {sorted.map((layer) => {
        const box = SLOT_BOXES[layer.item.category];
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const { dx, dy, scale, rotate } = layer.adjust;
        const selected = layer.item.id === selectedId;
        return (
          <g
            key={layer.item.id}
            transform={`translate(${dx} ${dy}) translate(${cx} ${cy}) rotate(${rotate}) scale(${scale}) translate(${-cx} ${-cy})`}
            onPointerDown={interactive ? (e) => startDrag(e, layer) : undefined}
            style={{ cursor: interactive ? "grab" : undefined, touchAction: "none" }}
          >
            <image
              href={layer.item.plateUrl}
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              preserveAspectRatio={box.align}
              filter={f("plate")}
            />
            {selected && (
              <rect
                x={box.x - 3}
                y={box.y - 3}
                width={box.w + 6}
                height={box.h + 6}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5 / scale}
                strokeDasharray="5 4"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
