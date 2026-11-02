import { useEffect, useState } from "react";
import { HAIR_COLORS, HAIR_LENGTHS, HAIR_TEXTURES, SKIN_TONES, type Avatar } from "../../shared/types.ts";
import Model from "../components/Model.tsx";
import { useAvatar } from "../lib/store.tsx";

/** Models are drawn bald for now (see SHOW_HAIR in Model.tsx), so the hair choices are hidden too. */
const SHOW_HAIR_OPTIONS = false;

export default function AvatarPage() {
  const { avatar, loaded, save } = useAvatar();
  const [draft, setDraft] = useState<Avatar>(avatar);
  const [status, setStatus] = useState<"" | "saving" | "saved" | string>("");

  useEffect(() => setDraft(avatar), [avatar]);

  const set = <K extends keyof Avatar>(k: K, v: Avatar[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setStatus("");
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(avatar);

  return (
    <div className="page avatar-page">
      <div className="avatar-preview">
        <Model avatar={draft} className="avatar-model" />
      </div>
      <div className="avatar-controls">
        <p className="eyebrow">Your model</p>
        <h1>{draft.displayName ? `${draft.displayName}'s model` : "Make your model"}</h1>
        <p className="lede">This is your avatar and the figure you'll dress in the dressing room.</p>

        <label className="field">
          Name
          <input value={draft.displayName} maxLength={60} placeholder="Your name" onChange={(e) => set("displayName", e.target.value)} />
        </label>

        <fieldset className="field">
          <legend>Skin tone</legend>
          <div className="swatches big">
            {SKIN_TONES.map((s) => (
              <button
                key={s.id}
                className={`swatch${draft.skinTone === s.id ? " on" : ""}`}
                style={{ background: s.hex }}
                aria-label={s.label}
                title={s.label}
                aria-pressed={draft.skinTone === s.id}
                onClick={() => set("skinTone", s.id)}
              />
            ))}
          </div>
        </fieldset>

        {SHOW_HAIR_OPTIONS && (
          <>
        <fieldset className="field">
          <legend>Hair length</legend>
          <div className="seg">
            {HAIR_LENGTHS.map((h) => (
              <button key={h.id} className={draft.hairLength === h.id ? "on" : ""} onClick={() => set("hairLength", h.id)}>
                {h.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Hair texture</legend>
          <div className="seg">
            {HAIR_TEXTURES.map((h) => (
              <button key={h.id} className={draft.hairTexture === h.id ? "on" : ""} onClick={() => set("hairTexture", h.id)}>
                {h.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Hair color</legend>
          <div className="hair-colors">
            {HAIR_COLORS.map((h) => (
              <button
                key={h.id}
                className={`hair-color${draft.hairColor === h.id ? " on" : ""}`}
                aria-pressed={draft.hairColor === h.id}
                onClick={() => set("hairColor", h.id)}
              >
                <span className="swatch" style={{ background: h.hex }} />
                {h.label}
              </button>
            ))}
          </div>
        </fieldset>
          </>
        )}

        <div className="row">
          <button
            className="btn"
            disabled={!loaded || !dirty || status === "saving"}
            onClick={async () => {
              setStatus("saving");
              try {
                await save(draft);
                setStatus("saved");
              } catch (e) {
                setStatus((e as Error).message);
              }
            }}
          >
            {status === "saving" ? "Saving…" : "Save model"}
          </button>
          {status === "saved" && !dirty && <span className="hint">Saved ✓</span>}
          {status && !["saving", "saved"].includes(status) && <span className="error">{status}</span>}
        </div>
      </div>
    </div>
  );
}
