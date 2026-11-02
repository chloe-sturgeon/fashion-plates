import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { ClosetItem, OutfitLayer } from "../../shared/types.ts";
import Model, { NO_ADJUST, type Adjust, type WornLayer } from "../components/Model.tsx";
import { CATEGORY_Z, VIEW_H } from "../components/figure.ts";
import Modal from "../components/Modal.tsx";
import { api } from "../lib/api.ts";
import { itemMatches } from "../lib/search.ts";
import { SLOTS, slotFor, type Slot } from "../lib/slots.ts";
import { useAvatar } from "../lib/store.tsx";

interface ActiveSlot {
  query: string;
  index: number;
}

/** Words people might type for each slot, so "jeans" or "boots" finds the right place. */
const SLOT_SYNONYMS: Record<string, string[]> = {
  hat: ["hat", "cap", "beanie", "beret", "head"],
  scarf: ["scarf", "neck", "shawl", "bandana"],
  top: ["top", "shirt", "blouse", "tee", "t-shirt", "sweater", "tank", "torso", "knit"],
  jacket: ["jacket", "coat", "blazer", "cardigan", "outerwear", "vest", "layer"],
  belt: ["belt", "waist"],
  dress: ["dress", "gown", "jumpsuit", "romper"],
  bottom: ["bottom", "pants", "trousers", "jeans", "skirt", "shorts", "leggings", "legs"],
  shoes: ["shoes", "shoe", "boots", "sneakers", "heels", "sandals", "flats", "feet"],
};

export default function DressingRoom() {
  const { avatar } = useAvatar();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<ClosetItem[] | null>(null);
  const [active, setActive] = useState<Record<string, ActiveSlot>>({});
  const [adjust, setAdjust] = useState<Record<number, Adjust>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editingLook, setEditingLook] = useState<{ id: number; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.items().then(setItems).catch(() => setItems([]));
  }, []);

  const candidates = useMemo(() => {
    const out: Record<string, ClosetItem[]> = {};
    for (const slot of SLOTS) {
      const q = active[slot.id]?.query ?? "";
      out[slot.id] = (items ?? []).filter((it) => slot.categories.includes(it.category) && itemMatches(it, q));
    }
    return out;
  }, [items, active]);

  // Open a saved look (?look=ID) or try on one item (?try=ID).
  useEffect(() => {
    if (!items) return;
    const lookId = Number(params.get("look"));
    const tryId = Number(params.get("try"));
    if (lookId) {
      api.looks().then((looks) => {
        const look = looks.find((l) => l.id === lookId);
        if (!look) return;
        const nextActive: Record<string, ActiveSlot> = {};
        const nextAdjust: Record<number, Adjust> = {};
        for (const layer of look.layers) {
          const item = items.find((i) => i.id === layer.itemId);
          if (!item) continue;
          const slot = slotFor(item.category);
          const list = items.filter((i) => slot.categories.includes(i.category));
          nextActive[slot.id] = { query: "", index: list.indexOf(item) };
          nextAdjust[item.id] = { dx: layer.dx, dy: layer.dy, scale: layer.scale, rotate: layer.rotate };
        }
        setActive(nextActive);
        setAdjust(nextAdjust);
        setEditingLook({ id: look.id, name: look.name });
      });
      setParams({}, { replace: true });
    } else if (tryId) {
      const item = items.find((i) => i.id === tryId);
      if (item) {
        const slot = slotFor(item.category);
        const list = items.filter((i) => slot.categories.includes(i.category));
        setActive((a) => ({ ...a, [slot.id]: { query: "", index: list.indexOf(item) } }));
        setSelectedId(item.id);
      }
      setParams({}, { replace: true });
    }
  }, [items, params, setParams]);

  const current = (slot: Slot): ClosetItem | undefined => {
    const a = active[slot.id];
    const list = candidates[slot.id];
    if (!a || !list.length) return undefined;
    return list[((a.index % list.length) + list.length) % list.length];
  };

  const worn: WornLayer[] = SLOTS.flatMap((slot) => {
    const item = current(slot);
    return item ? [{ item, adjust: adjust[item.id] ?? NO_ADJUST, z: CATEGORY_Z[item.category] }] : [];
  });

  const step = (slot: Slot, delta: number) => {
    setActive((a) => ({ ...a, [slot.id]: { ...a[slot.id], index: (a[slot.id]?.index ?? 0) + delta } }));
    setSelectedId(null);
  };

  const addSlot = (slotId: string, query: string) => {
    setActive((a) => ({ ...a, [slotId]: { query, index: 0 } }));
    setPickerOpen(false);
  };

  const removeSlot = (slotId: string) => {
    setActive(({ [slotId]: _, ...rest }) => rest);
    setSelectedId(null);
  };

  const setAdj = (id: number, patch: Partial<Adjust>) =>
    setAdjust((all) => ({ ...all, [id]: { ...(all[id] ?? NO_ADJUST), ...patch } }));

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const saveLook = async (name: string, asNew: boolean) => {
    const layers: OutfitLayer[] = worn.map((w) => ({ itemId: w.item.id, ...w.adjust, z: w.z }));
    const saved = await api.saveLook(name, layers, asNew ? undefined : editingLook?.id);
    setEditingLook({ id: saved.id, name: saved.name });
    setSaveOpen(false);
    flash(`“${saved.name}” saved to your lookbook`);
  };

  const selected = worn.find((w) => w.item.id === selectedId);
  const activeSlots = SLOTS.filter((s) => active[s.id]);

  return (
    <div className="dressing">
      <section className="stage" aria-label="Your model">
        <div className="stage-inner">
          <Model
            className="stage-model"
            avatar={avatar}
            layers={worn}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(id, dx, dy) => setAdj(id, { dx, dy })}
          />
          {activeSlots.map((slot) => {
            const list = candidates[slot.id];
            const a = active[slot.id];
            const pos = list.length ? (((a.index % list.length) + list.length) % list.length) + 1 : 0;
            const top = `${(slot.y / VIEW_H) * 100}%`;
            const disabled = list.length < 2;
            return (
              <div key={slot.id} className="arrow-row" style={{ top }}>
                <button
                  className="arrow"
                  aria-label={`Previous ${slot.label.toLowerCase()}`}
                  disabled={disabled}
                  onClick={() => step(slot, -1)}
                >
                  ‹
                </button>
                <span className="arrow-label">
                  {slot.label}
                  <small>{list.length ? `${pos}/${list.length}` : "none"}</small>
                </span>
                <button
                  className="arrow"
                  aria-label={`Next ${slot.label.toLowerCase()}`}
                  disabled={disabled}
                  onClick={() => step(slot, 1)}
                >
                  ›
                </button>
              </div>
            );
          })}
        </div>
        <button className="fab" aria-label="Add an item to the look" onClick={() => setPickerOpen(true)}>
          +
        </button>
      </section>

      <aside className="panel">
        <header className="panel-head">
          <div>
            <p className="eyebrow">{editingLook ? "Editing look" : "New look"}</p>
            <h1>{editingLook?.name ?? "Dressing room"}</h1>
          </div>
          {editingLook && (
            <button
              className="btn ghost small"
              onClick={() => {
                setEditingLook(null);
                setActive({});
                setAdjust({});
              }}
            >
              Start over
            </button>
          )}
        </header>

        {items && items.length === 0 ? (
          <div className="empty">
            <p>Your closet is empty.</p>
            <Link to="/closet/new" className="btn">
              Add your first item
            </Link>
          </div>
        ) : activeSlots.length === 0 ? (
          <div className="empty">
            <p>
              Tap <strong>+</strong> to choose what to put on: a top, bottoms, shoes, a hat… Then use the arrows on the model
              to flip through your closet.
            </p>
            <button className="btn" onClick={() => setPickerOpen(true)}>
              + Add to look
            </button>
          </div>
        ) : (
          <ul className="wearing">
            {activeSlots.map((slot) => {
              const item = current(slot);
              const q = active[slot.id].query;
              return (
                <li key={slot.id} className={item && item.id === selectedId ? "on" : ""}>
                  <button className="wearing-main" onClick={() => item && setSelectedId(item.id)} disabled={!item}>
                    <span className="thumb checker">{item && <img src={item.plateUrl} alt="" />}</span>
                    <span>
                      <span className="eyebrow">
                        {slot.label}
                        {q && <em> · “{q}”</em>}
                      </span>
                      <span className="wearing-name">{item?.name ?? `No matching ${slot.label.toLowerCase()}s`}</span>
                    </span>
                  </button>
                  <button className="icon-btn" aria-label={`Remove ${slot.label.toLowerCase()}`} onClick={() => removeSlot(slot.id)}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected && (
          <div className="fit">
            <p className="eyebrow">Fit “{selected.item.name}”</p>
            <p className="hint">Drag it on the model to move it.</p>
            <label>
              Size
              <input
                type="range"
                min={0.4}
                max={2}
                step={0.01}
                value={selected.adjust.scale}
                onChange={(e) => setAdj(selected.item.id, { scale: Number(e.target.value) })}
              />
            </label>
            <label>
              Tilt
              <input
                type="range"
                min={-30}
                max={30}
                step={0.5}
                value={selected.adjust.rotate}
                onChange={(e) => setAdj(selected.item.id, { rotate: Number(e.target.value) })}
              />
            </label>
            <button className="btn ghost small" onClick={() => setAdj(selected.item.id, NO_ADJUST)}>
              Reset fit
            </button>
          </div>
        )}

        <div className="panel-actions">
          <button className="btn" disabled={worn.length === 0} onClick={() => setSaveOpen(true)}>
            Save to lookbook
          </button>
          <button className="btn ghost" onClick={() => navigate("/lookbook")}>
            View lookbook
          </button>
        </div>
      </aside>

      {pickerOpen && <Picker items={items ?? []} onPick={addSlot} onClose={() => setPickerOpen(false)} />}
      {saveOpen && (
        <SaveDialog
          initialName={editingLook?.name ?? ""}
          canUpdate={Boolean(editingLook)}
          onSave={saveLook}
          onClose={() => setSaveOpen(false)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast} · <Link to="/lookbook">Open lookbook</Link>
        </div>
      )}
    </div>
  );
}

function Picker({
  items,
  onPick,
  onClose,
}: {
  items: ClosetItem[];
  onPick: (slotId: string, query: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().trim();

  const options = SLOTS.map((slot) => {
    const inSlot = items.filter((i) => slot.categories.includes(i.category));
    const typeMatch = !words || SLOT_SYNONYMS[slot.id].some((s) => s.startsWith(words) || words.startsWith(s));
    // If the words aren't a garment type, treat them as a search within the slot ("red", "linen", "work").
    const matching = typeMatch ? inSlot : inSlot.filter((i) => itemMatches(i, words));
    return { slot, count: matching.length, query: typeMatch ? "" : words, show: typeMatch || matching.length > 0 };
  }).filter((o) => o.show);

  return (
    <Modal title="Add to look" onClose={onClose}>
      <input
        className="search"
        autoFocus
        placeholder="Search: top, jeans, boots, red, linen…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && options[0]) onPick(options[0].slot.id, options[0].query);
        }}
      />
      <div className="type-grid">
        {options.map(({ slot, count, query }) => (
          <button key={slot.id} className="type-tile" onClick={() => onPick(slot.id, query)} disabled={count === 0}>
            <span className="type-name">{slot.label}</span>
            <span className="type-meta">
              {count === 0 ? "None in closet" : `${count} ${query ? `match “${query}”` : count === 1 ? "item" : "items"}`}
            </span>
            <span className="type-zone">{slot.zone}</span>
          </button>
        ))}
        {options.length === 0 && <p className="hint">Nothing in your closet matches “{q}”.</p>}
      </div>
      <p className="hint">
        Missing something? <Link to="/closet/new">Add it to your closet</Link>.
      </p>
    </Modal>
  );
}

function SaveDialog({
  initialName,
  canUpdate,
  onSave,
  onClose,
}: {
  initialName: string;
  canUpdate: boolean;
  onSave: (name: string, asNew: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (asNew: boolean) => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim(), asNew);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal title="Save to lookbook" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(!canUpdate);
        }}
      >
        <label className="field">
          Name this look
          <input autoFocus value={name} maxLength={80} placeholder="Sunday brunch" onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn" type="submit" disabled={busy || !name.trim()}>
            {canUpdate ? "Update look" : "Save look"}
          </button>
          {canUpdate && (
            <button className="btn ghost" type="button" disabled={busy || !name.trim()} onClick={() => submit(true)}>
              Save as new look
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
