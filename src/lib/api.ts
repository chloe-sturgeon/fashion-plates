import type { AnalyzeResult, Avatar, ClosetItem, ItemAttributes, Outfit, OutfitLayer } from "../../shared/types.ts";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  status: () => request<{ aiConfigured: boolean }>("/api/status"),

  analyze(photo: Blob) {
    const fd = new FormData();
    fd.append("image", photo, "photo.jpg");
    return request<AnalyzeResult>("/api/analyze", { method: "POST", body: fd });
  },

  items(params: { q?: string; category?: string; color?: string } = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return request<ClosetItem[]>(`/api/items?${qs}`);
  },

  createItem(original: Blob, plate: Blob, attributes: ItemAttributes, aiTagged: boolean) {
    const fd = new FormData();
    fd.append("original", original, "original.jpg");
    fd.append("plate", plate, "plate.png");
    fd.append("attributes", JSON.stringify(attributes));
    fd.append("aiTagged", String(aiTagged));
    return request<ClosetItem>("/api/items", { method: "POST", body: fd });
  },

  updateItem: (id: number, a: ItemAttributes) => request<ClosetItem>(`/api/items/${id}`, json("PATCH", a)),
  deleteItem: (id: number) => request<void>(`/api/items/${id}`, { method: "DELETE" }),

  avatar: () => request<Avatar>("/api/avatar"),
  saveAvatar: (a: Avatar) => request<Avatar>("/api/avatar", json("PUT", a)),

  looks: () => request<Outfit[]>("/api/outfits"),
  saveLook: (name: string, layers: OutfitLayer[], id?: number) =>
    request<Outfit>("/api/outfits", json("POST", { id, name, layers })),
  deleteLook: (id: number) => request<void>(`/api/outfits/${id}`, { method: "DELETE" }),
};
