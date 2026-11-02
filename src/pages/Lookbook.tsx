import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ClosetItem, Outfit } from "../../shared/types.ts";
import Model, { type WornLayer } from "../components/Model.tsx";
import Modal from "../components/Modal.tsx";
import { api } from "../lib/api.ts";
import { CATEGORY_LABELS } from "../lib/slots.ts";
import { useAvatar } from "../lib/store.tsx";

function wornFor(look: Outfit, byId: Map<number, ClosetItem>): WornLayer[] {
  return look.layers.flatMap((l) => {
    const item = byId.get(l.itemId);
    return item ? [{ item, adjust: { dx: l.dx, dy: l.dy, scale: l.scale, rotate: l.rotate }, z: l.z }] : [];
  });
}

const formatDate = (s: string) =>
  new Date(s.replace(" ", "T") + "Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function Lookbook() {
  const { avatar } = useAvatar();
  const navigate = useNavigate();
  const [looks, setLooks] = useState<Outfit[] | null>(null);
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [open, setOpen] = useState<Outfit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.looks(), api.items()])
      .then(([l, i]) => {
        setLooks(l);
        setItems(i);
      })
      .catch((e) => setError(e.message));
  }, []);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const remove = async (look: Outfit) => {
    if (!confirm(`Delete the look “${look.name}”? The clothes stay in your closet.`)) return;
    try {
      await api.deleteLook(look.id);
      setLooks((ls) => ls?.filter((l) => l.id !== look.id) ?? null);
      setOpen(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Lookbook</p>
          <h1>The <em>Lookbook</em></h1>
        </div>
        <Link to="/" className="btn">
          + New look
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      {looks && looks.length === 0 && (
        <div className="empty">
          <p>No looks yet. Put an outfit together in the dressing room and save it here.</p>
          <Link to="/" className="btn">
            Go to the dressing room
          </Link>
        </div>
      )}
      <ul className="look-grid">
        {looks?.map((look) => (
          <li key={look.id}>
            <button className="look-card" onClick={() => setOpen(look)}>
              <span className="look-figure">
                <Model avatar={avatar} layers={wornFor(look, byId)} title={look.name} />
              </span>
              <span className="look-name">{look.name}</span>
              <span className="card-meta">
                {formatDate(look.createdAt)} · {look.layers.length} {look.layers.length === 1 ? "piece" : "pieces"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)} wide>
          <div className="look-detail">
            <div className="look-detail-figure">
              <Model avatar={avatar} layers={wornFor(open, byId)} title={open.name} />
            </div>
            <div>
              <p className="eyebrow">Saved {formatDate(open.createdAt)}</p>
              <ul className="wearing">
                {wornFor(open, byId)
                  .sort((a, b) => b.z - a.z)
                  .map(({ item }) => (
                    <li key={item.id}>
                      <span className="wearing-main">
                        <span className="thumb checker">
                          <img src={item.plateUrl} alt="" />
                        </span>
                        <span>
                          <span className="eyebrow">{CATEGORY_LABELS[item.category]}</span>
                          <span className="wearing-name">{item.name}</span>
                        </span>
                      </span>
                    </li>
                  ))}
                {open.layers.length > wornFor(open, byId).length && (
                  <li className="hint">Some pieces in this look have been removed from your closet.</li>
                )}
              </ul>
              <div className="row">
                <button className="btn" onClick={() => navigate(`/?look=${open.id}`)}>
                  Edit in dressing room
                </button>
                <button className="btn danger ghost" onClick={() => remove(open)}>
                  Delete look
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
