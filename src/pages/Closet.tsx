import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CATEGORIES, COLOR_FAMILIES, type ClosetItem, type ItemAttributes } from "../../shared/types.ts";
import ItemForm from "../components/ItemForm.tsx";
import Modal from "../components/Modal.tsx";
import { api } from "../lib/api.ts";
import { CATEGORY_LABELS } from "../lib/slots.ts";

const FAMILY_SWATCH: Record<string, string> = {
  black: "#1b1b1b",
  white: "#ffffff",
  gray: "#9a9a9a",
  beige: "#e3d3b5",
  brown: "#7a5232",
  red: "#c0392b",
  orange: "#e67e22",
  yellow: "#f1c40f",
  green: "#3e8e5a",
  blue: "#3b7dd8",
  navy: "#1f2e5a",
  purple: "#7d4fa8",
  pink: "#ec8fb0",
  gold: "linear-gradient(135deg,#b8860b,#f5d76e,#b8860b)",
  silver: "linear-gradient(135deg,#8e8e8e,#e6e6e6,#8e8e8e)",
};

export default function Closet() {
  const [items, setItems] = useState<ClosetItem[] | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [open, setOpen] = useState<ClosetItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .items({ q, category, color })
        .then((r) => {
          setItems(r);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, 180);
    return () => clearTimeout(t);
  }, [q, category, color]);

  const filtered = Boolean(q || category || color);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Virtual closet</p>
          <h1>The <em>Closet</em></h1>
        </div>
        <Link to="/closet/new" className="btn">
          + Add item
        </Link>
      </div>

      <div className="filters">
        <input className="search" type="search" placeholder="Search: striped, linen, work, red…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips" role="group" aria-label="Type">
          <button className={`chip${!category ? " on" : ""}`} onClick={() => setCategory("")}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip${category === c ? " on" : ""}`} onClick={() => setCategory(category === c ? "" : c)}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="swatches" role="group" aria-label="Color">
          {COLOR_FAMILIES.map((f) => (
            <button
              key={f}
              className={`swatch${color === f ? " on" : ""}`}
              style={{ background: FAMILY_SWATCH[f] }}
              title={f}
              aria-label={f}
              aria-pressed={color === f}
              onClick={() => setColor(color === f ? "" : f)}
            />
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && (
        <div className="empty">
          {filtered ? (
            <p>Nothing matches those filters.</p>
          ) : (
            <>
              <p>No clothes yet. Add a photo of something you own to make its fashion plate.</p>
              <Link to="/closet/new" className="btn">
                Add your first item
              </Link>
            </>
          )}
        </div>
      )}

      <ul className="grid">
        {items?.map((it) => (
          <li key={it.id}>
            <button className="card" onClick={() => setOpen(it)}>
              <span className="card-img checker">
                <img src={it.plateUrl} alt="" loading="lazy" />
              </span>
              <span className="card-body">
                <span className="card-name">{it.name}</span>
                <span className="card-meta">
                  {CATEGORY_LABELS[it.category]}
                  {it.subcategory && ` · ${it.subcategory}`}
                </span>
                <span className="dots">
                  {it.colors.map((c, i) => (
                    <span key={i} className="dot" style={{ background: c.hex }} title={c.name} />
                  ))}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <ItemDetail
          item={open}
          onClose={() => setOpen(null)}
          onSaved={(it) => {
            setItems((list) => list?.map((x) => (x.id === it.id ? it : x)) ?? null);
            setOpen(null);
          }}
          onDeleted={(id) => {
            setItems((list) => list?.filter((x) => x.id !== id) ?? null);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function ItemDetail({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: ClosetItem;
  onClose: () => void;
  onSaved: (it: ClosetItem) => void;
  onDeleted: (id: number) => void;
}) {
  const navigate = useNavigate();
  const { id, originalUrl, plateUrl, aiTagged, createdAt, ...initial } = item;
  const [attrs, setAttrs] = useState<ItemAttributes>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={item.name} onClose={onClose} wide>
      <div className="review">
        <div className="review-visuals">
          <div className="plate-preview checker">
            <img src={showOriginal ? originalUrl : plateUrl} alt={item.name} />
          </div>
          <div className="seg">
            <button className={!showOriginal ? "on" : ""} onClick={() => setShowOriginal(false)}>
              Plate
            </button>
            <button className={showOriginal ? "on" : ""} onClick={() => setShowOriginal(true)}>
              Original photo
            </button>
          </div>
          <button className="btn" onClick={() => navigate(`/?try=${id}`)}>
            Try it on
          </button>
        </div>
        <div className="review-form">
          <ItemForm value={attrs} onChange={setAttrs} />
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => run(async () => onSaved(await api.updateItem(id, attrs)))}>
              Save changes
            </button>
            <button
              className="btn danger ghost"
              disabled={busy}
              onClick={() => {
                if (confirm(`Remove “${item.name}” from your closet? Looks that use it will no longer show it.`)) {
                  run(async () => {
                    await api.deleteItem(id);
                    onDeleted(id);
                  });
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
