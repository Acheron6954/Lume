// DM Kontrol durumu: saf fonksiyonlar. Hiçbir şey otomatik gönderilmez;
// panel yalnızca taslağı hazırlar, DM'i kullanıcı kendi hesabından elle yollar.
import { fillTemplate, tiktokUrl, type Influencer, type MailSettings } from "./influencer";

export type DmChannel = "instagram" | "tiktok";

export type DmItem = {
  id: string; // `${influencerId}:${channel}`
  influencerId: string;
  channel: DmChannel;
  text: string;
  approved: boolean;
  sentAt?: string; // kullanıcı "gönderdim" dedi, ISO
  repliedAt?: string; // kullanıcı "yanıt geldi" dedi, ISO
  note: string;
};

export type DmState = { template: string; items: DmItem[]; ready: boolean }; // ready: tarayıcı kaydı okundu mu

export const DM_LIMIT = 1000; // Instagram DM sınırına yakın, kısa tutmak için
export const DM_NOTE_LIMIT = 200;

export const DM_TEMPLATE = `Merhaba {isim}! {marka} olarak {alan} içeriklerini ilgiyle takip ediyoruz. Ürünlerimizi sana ücretsiz gönderip, sana özel indirim koduyla gelen her satıştan %{komisyon} komisyon ödemek isteriz. İçeriği nasıl hazırlayacağın tamamen sana kalmış. İlgilenirsen detayları buradan ya da {iletisim} adresinden paylaşabiliriz. İlgilenmiyorsan yazman yeterli, tekrar yazmayacağız.`;

export const initialDm: DmState = { template: DM_TEMPLATE, items: [], ready: false };

export type DmAction =
  | { type: "hydrate"; state: DmState }
  | { type: "add"; items: { influencerId: string; channel: DmChannel; text: string }[] }
  | { type: "edit"; id: string; text: string }
  | { type: "toggleApprove"; id: string }
  | { type: "markSent"; id: string; at: string }
  | { type: "unmarkSent"; id: string }
  | { type: "markReplied"; id: string; at: string }
  | { type: "unmarkReplied"; id: string }
  | { type: "note"; id: string; note: string }
  | { type: "remove"; id: string }
  | { type: "template"; text: string }
  | { type: "resetTemplate" };

export const dmId = (influencerId: string, channel: DmChannel) => `${influencerId}:${channel}`;

/** Bu kanal için DM atılabilir mi, hangi kullanıcı adıyla? */
export function dmHandle(i: Pick<Influencer, "handle" | "tiktok">, channel: DmChannel): string | undefined {
  const h = channel === "instagram" ? i.handle.trim() : (i.tiktok ?? "").trim();
  return h || undefined;
}

/** DM'i açacak adres. Instagram'da ig.me doğrudan sohbet açar; TikTok'ta profil açılır, DM'i orada yazarsın. */
export function dmUrl(handle: string, channel: DmChannel): string {
  return channel === "instagram" ? `https://ig.me/m/${encodeURIComponent(handle)}` : tiktokUrl(handle);
}

export function dmDraft(tpl: string, i: Pick<Influencer, "name" | "niche" | "handle">, mail: MailSettings): string {
  return fillTemplate(tpl, i, mail).slice(0, DM_LIMIT);
}

export type DmStatus = "taslak" | "onayli" | "gonderildi" | "yanit";
export const dmStatus = (d: DmItem): DmStatus => (d.repliedAt ? "yanit" : d.sentAt ? "gonderildi" : d.approved ? "onayli" : "taslak");

const valid = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(new Date(v).getTime());

export function dmReduce(s: DmState, a: DmAction): DmState {
  const upd = (id: string, fn: (d: DmItem) => DmItem): DmState => ({ ...s, items: s.items.map((d) => (d.id === id ? fn(d) : d)) });
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "add": {
      const have = new Set(s.items.map((d) => d.id));
      const fresh: DmItem[] = [];
      for (const x of a.items) {
        const id = dmId(x.influencerId, x.channel);
        if (have.has(id)) continue;
        have.add(id);
        fresh.push({ id, influencerId: x.influencerId, channel: x.channel, text: x.text.slice(0, DM_LIMIT), approved: false, note: "" });
      }
      return fresh.length ? { ...s, items: [...s.items, ...fresh] } : s;
    }
    case "edit":
      // Metin değişince onay düşer: onaylanan şey artık o metin değil. Gönderilmiş DM'in metni sabit kalır.
      return upd(a.id, (d) => (d.sentAt ? d : { ...d, text: a.text.slice(0, DM_LIMIT), approved: false }));
    case "toggleApprove":
      return upd(a.id, (d) => (d.sentAt || !d.text.trim() ? d : { ...d, approved: !d.approved }));
    case "markSent":
      // Yalnızca onaylı DM "gönderildi" olabilir.
      return upd(a.id, (d) => (d.approved && !d.sentAt && valid(a.at) ? { ...d, sentAt: a.at } : d));
    case "unmarkSent":
      return upd(a.id, (d) => ({ ...d, sentAt: undefined, repliedAt: undefined }));
    case "markReplied":
      return upd(a.id, (d) => (d.sentAt && valid(a.at) ? { ...d, repliedAt: a.at } : d));
    case "unmarkReplied":
      return upd(a.id, (d) => ({ ...d, repliedAt: undefined }));
    case "note":
      return upd(a.id, (d) => ({ ...d, note: a.note.slice(0, DM_NOTE_LIMIT) }));
    case "remove":
      return { ...s, items: s.items.filter((d) => d.id !== a.id) };
    case "template":
      return { ...s, template: a.text.slice(0, DM_LIMIT * 2) };
    case "resetTemplate":
      return { ...s, template: DM_TEMPLATE };
  }
}

/** Tarayıcıdan okunan kayıt bozuk olabilir: yalnızca bilinen hesaplara ait, geçerli alanlı DM'ler kalır. */
export function sanitizeDm(raw: unknown, known: ReadonlySet<string>): DmState {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const template = typeof o.template === "string" && o.template.trim() ? o.template.slice(0, DM_LIMIT * 2) : DM_TEMPLATE;
  const seen = new Set<string>();
  const items: DmItem[] = [];
  for (const r of Array.isArray(o.items) ? o.items : []) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const influencerId = typeof x.influencerId === "string" ? x.influencerId : "";
    const channel = x.channel === "instagram" || x.channel === "tiktok" ? x.channel : null;
    if (!channel || !known.has(influencerId)) continue;
    const id = dmId(influencerId, channel);
    if (seen.has(id)) continue;
    seen.add(id);
    const sentAt = valid(x.sentAt) ? x.sentAt : undefined;
    items.push({
      id,
      influencerId,
      channel,
      text: typeof x.text === "string" ? x.text.slice(0, DM_LIMIT) : "",
      approved: x.approved === true || !!sentAt,
      sentAt,
      repliedAt: sentAt && valid(x.repliedAt) ? x.repliedAt : undefined,
      note: typeof x.note === "string" ? x.note.slice(0, DM_NOTE_LIMIT) : "",
    });
  }
  return { template, items, ready: true };
}
