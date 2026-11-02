import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClosetItem, ItemAttributes } from "../../shared/types.ts";
import ItemForm from "../components/ItemForm.tsx";
import Model from "../components/Model.tsx";
import { CATEGORY_Z } from "../components/figure.ts";
import { api } from "../lib/api.ts";
import {
  blobToCanvas,
  canvasToBlob,
  cutOutBackground,
  flattenOnWhite,
  dominantColors,
  makePlate,
  photoForAnalysis,
} from "../lib/imaging.ts";
import { useAvatar } from "../lib/store.tsx";

type Phase = "pick" | "working" | "review";

const BLANK: ItemAttributes = {
  name: "",
  category: "top",
  subcategory: "",
  colors: [],
  pattern: "solid",
  material: "",
  styleTags: [],
  seasons: [],
  occasions: [],
  features: [],
  description: "",
};

function useObjectUrl(blob: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

export default function AddItem() {
  const navigate = useNavigate();
  const { avatar } = useAvatar();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [dragging, setDragging] = useState(false);
  const [original, setOriginal] = useState<Blob | null>(null);
  const [cutoutPlate, setCutoutPlate] = useState<Blob | null>(null);
  const [originalPlate, setOriginalPlate] = useState<Blob | null>(null);
  const [useCutout, setUseCutout] = useState(true);
  const [attrs, setAttrs] = useState<ItemAttributes>(BLANK);
  const [aiTagged, setAiTagged] = useState(false);
  const [progress, setProgress] = useState({ cut: 0, cutLabel: "Preparing…", ai: "" });
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const plate = useCutout && cutoutPlate ? cutoutPlate : originalPlate;
  const originalUrl = useObjectUrl(original);
  const plateUrl = useObjectUrl(plate);

  const start = async (file: File) => {
    setError(null);
    setNotices([]);
    setPhase("working");
    setProgress({ cut: 0, cutLabel: "Preparing…", ai: "Reading the photo…" });

    let photo: Blob;
    try {
      // Normalise the original (orientation, size, format) so the closet stays small and always displayable.
      // Keep transparency for PNG/WebP uploads; everything else becomes a JPEG on white.
      const canvas = await blobToCanvas(file, 2000);
      if (/^image\/(png|webp)$/.test(file.type)) {
        photo = await canvasToBlob(canvas, "image/png");
      } else {
        photo = await canvasToBlob(flattenOnWhite(canvas), "image/jpeg", 0.9);
      }
    } catch {
      setError("That file couldn't be opened as an image. Try a JPEG or PNG (iPhone HEIC photos may need converting).");
      setPhase("pick");
      return;
    }
    setOriginal(photo);
    // Without a cut-out the plate is the photo itself, trimmed of any transparent margin.
    const fallbackPlate = await makePlate(photo);
    setOriginalPlate(fallbackPlate);

    const notes: string[] = [];

    const cutJob = (async () => {
      try {
        const cut = await cutOutBackground(photo, (f, label) => setProgress((p) => ({ ...p, cut: f, cutLabel: label })));
        const plate = await makePlate(cut);
        setCutoutPlate(plate);
        setUseCutout(true);
        return plate;
      } catch (e) {
        console.error(e);
        notes.push("The background couldn't be removed automatically, so the original photo is used as the plate.");
        setCutoutPlate(null);
        setUseCutout(false);
        return fallbackPlate;
      } finally {
        setProgress((p) => ({ ...p, cut: 1, cutLabel: "Done" }));
      }
    })();

    const aiJob = (async () => {
      try {
        setProgress((p) => ({ ...p, ai: "Identifying the item…" }));
        const res = await api.analyze(await photoForAnalysis(photo));
        if (!res.isClothing) notes.push("This doesn't look like a clothing item to the AI. Double-check the details below.");
        return res.attributes;
      } catch (e) {
        notes.push(`${(e as Error).message} Fill in the details yourself; colors were detected from the photo.`);
        return null;
      } finally {
        setProgress((p) => ({ ...p, ai: "Done" }));
      }
    })();

    const [finalPlate, ai] = await Promise.all([cutJob, aiJob]);
    if (ai) {
      setAttrs(ai);
      setAiTagged(true);
    } else {
      setAttrs({ ...BLANK, colors: await dominantColors(finalPlate).catch(() => []) });
      setAiTagged(false);
    }
    setNotices(notes);
    setPhase("review");
  };

  const save = async () => {
    if (!original || !plate) return;
    if (!attrs.name.trim()) {
      setError("Give the item a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createItem(original, plate, attrs, aiTagged);
      navigate("/closet");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) start(f);
  };

  if (phase === "pick") {
    return (
      <div className="page narrow">
        <p className="eyebrow">Closet</p>
        <h1>New <em>Arrival</em></h1>
        <p className="lede">
          Snap or upload a photo of one piece of clothing. It works best laid flat or on a hanger against a plain background.
        </p>
        <div
          className={`dropzone${dragging ? " over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
        >
          <span className="dz-icon" aria-hidden>
            ⇪
          </span>
          <strong>Choose a photo</strong>
          <span>or drop it here</span>
        </div>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => onFiles(e.target.files)} />
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (phase === "working") {
    return (
      <div className="page narrow">
        <p className="eyebrow">Closet</p>
        <h1>Making your fashion plate…</h1>
        <div className="working">
          {originalUrl && <img className="working-photo" src={originalUrl} alt="Your photo" />}
          <div className="steps">
            <div>
              <span>{progress.cutLabel}</span>
              <progress value={progress.cut} max={1} />
            </div>
            <div>
              <span>{progress.ai}</span>
              <progress value={progress.ai === "Done" ? 1 : undefined} max={1} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const previewItem: ClosetItem | null = plateUrl
    ? { ...attrs, id: -1, plateUrl, originalUrl: originalUrl ?? "", aiTagged, createdAt: "" }
    : null;

  return (
    <div className="page">
      <p className="eyebrow">Closet</p>
      <h1>Check the details</h1>
      {notices.map((n) => (
        <p key={n} className="notice">
          {n}
        </p>
      ))}
      <div className="review">
        <div className="review-visuals">
          <div className="plate-preview checker">{plateUrl && <img src={plateUrl} alt="Fashion plate" />}</div>
          {cutoutPlate && (
            <div className="seg" role="group" aria-label="Plate image">
              <button className={useCutout ? "on" : ""} onClick={() => setUseCutout(true)}>
                Cut-out
              </button>
              <button className={!useCutout ? "on" : ""} onClick={() => setUseCutout(false)}>
                Original photo
              </button>
            </div>
          )}
          {previewItem && (
            <div className="mini-model">
              <Model avatar={avatar} layers={[{ item: previewItem, adjust: { dx: 0, dy: 0, scale: 1, rotate: 0 }, z: CATEGORY_Z[attrs.category] }]} />
              <span className="hint">Preview on your model</span>
            </div>
          )}
        </div>
        <div className="review-form">
          {aiTagged && <p className="badge">✦ Tagged by AI. Edit anything that's off</p>}
          <ItemForm value={attrs} onChange={setAttrs} />
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Add to closet"}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setPhase("pick");
                setOriginal(null);
                setCutoutPlate(null);
                setOriginalPlate(null);
                setAttrs(BLANK);
              }}
              disabled={saving}
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
