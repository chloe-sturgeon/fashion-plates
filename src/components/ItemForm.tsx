import { useState } from "react";
import {
  CATEGORIES,
  COLOR_FAMILIES,
  PATTERNS,
  SEASONS,
  type ItemAttributes,
  type ItemColor,
} from "../../shared/types.ts";
import { colorFamily } from "../lib/imaging.ts";
import { CATEGORY_LABELS } from "../lib/slots.ts";

interface Props {
  value: ItemAttributes;
  onChange: (v: ItemAttributes) => void;
}

/** Editable fields for a garment's identifying features. */
export default function ItemForm({ value, onChange }: Props) {
  const set = <K extends keyof ItemAttributes>(k: K, v: ItemAttributes[K]) => onChange({ ...value, [k]: v });

  const setColor = (i: number, patch: Partial<ItemColor>) =>
    set(
      "colors",
      value.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    );

  return (
    <div className="item-form">
      <label className="field">
        Name
        <input value={value.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="Navy striped linen shirt" />
      </label>

      <fieldset className="field">
        <legend>Type</legend>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip${value.category === c ? " on" : ""}`}
              aria-pressed={value.category === c}
              onClick={() => set("category", c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="two">
        <label className="field">
          Kind
          <input value={value.subcategory} maxLength={80} onChange={(e) => set("subcategory", e.target.value)} placeholder="e.g. button-down" />
        </label>
        <label className="field">
          Material
          <input value={value.material} maxLength={80} onChange={(e) => set("material", e.target.value)} placeholder="e.g. linen" />
        </label>
      </div>

      <fieldset className="field">
        <legend>Colors</legend>
        <div className="color-rows">
          {value.colors.map((c, i) => (
            <div className="color-row" key={i}>
              <input
                type="color"
                value={c.hex}
                aria-label="Color"
                onChange={(e) => setColor(i, { hex: e.target.value, family: colorFamily(e.target.value) })}
              />
              <input value={c.name} maxLength={40} aria-label="Color name" onChange={(e) => setColor(i, { name: e.target.value })} />
              <select value={c.family} aria-label="Color family" onChange={(e) => setColor(i, { family: e.target.value as ItemColor["family"] })}>
                {COLOR_FAMILIES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove color"
                onClick={() => set("colors", value.colors.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          {value.colors.length < 6 && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => set("colors", [...value.colors, { name: "black", hex: "#222222", family: "black" }])}
            >
              + Add color
            </button>
          )}
        </div>
      </fieldset>

      <div className="two">
        <label className="field">
          Pattern
          <select value={value.pattern} onChange={(e) => set("pattern", e.target.value as ItemAttributes["pattern"])}>
            {PATTERNS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <legend>Seasons</legend>
          <div className="chips">
            {SEASONS.map((s) => {
              const on = value.seasons.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  className={`chip${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => set("seasons", on ? value.seasons.filter((x) => x !== s) : [...value.seasons, s])}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <TagField label="Style" value={value.styleTags} onChange={(v) => set("styleTags", v)} placeholder="casual, minimalist…" />
      <TagField label="Occasions" value={value.occasions} onChange={(v) => set("occasions", v)} placeholder="work, weekend…" />
      <TagField label="Details" value={value.features} onChange={(v) => set("features", v)} placeholder="v-neck, long sleeves, cropped…" />

      <label className="field">
        Notes
        <textarea rows={2} maxLength={1000} value={value.description} onChange={(e) => set("description", e.target.value)} />
      </label>
    </div>
  );
}

function TagField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && !value.includes(s));
    if (parts.length) onChange([...value, ...parts].slice(0, 20));
    setDraft("");
  };
  return (
    <label className="field">
      {label}
      <div className="tags">
        {value.map((t) => (
          <span key={t} className="tag">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
        />
      </div>
    </label>
  );
}
