// Influencer verisi, uyarı kuralları ve mail şablonu. Saf fonksiyonlar: kolay test edilir.

export type Platform = "instagram" | "tiktok";

export type Influencer = {
  id: string;
  name: string;
  handle: string;
  platform: Platform;
  niche: string;
  followers: number;
  avgLikes: number; // son gönderilerin ortalaması
  avgComments: number;
  engagement: number | null; // (ort. beğeni + ort. yorum) ÷ takipçi, 0..1; yeterli veri yoksa null
  verified: boolean; // Instagram'dan doğrulandı mı (takipçi/etkileşim gerçek veri mi)
  email?: string;
  tiktok?: string; // bio linkinden bulunan TikTok kullanıcı adı (@ olmadan)
  foundAt: string; // ISO
  scannedAt?: string; // ISO, son Instagram taraması
};

export type Thresholds = {
  minFollowers: number; // bunun altı uyarılır
  minEngagement: number; // etkileşim oranı alt sınırı, 0..1
};

export type Warning = "low-followers" | "low-engagement" | "unverified";

export const WARNING_LABEL: Record<Warning, string> = {
  "low-followers": "Düşük takipçi",
  "low-engagement": "Düşük etkileşim",
  unverified: "Instagram'dan doğrulanamadı",
};

export const DEFAULT_THRESHOLDS: Thresholds = { minFollowers: 10_000, minEngagement: 0.01 };

/** Etkileşim oranı en az bu kadar gönderiden hesaplanmışsa güvenilir sayılır. */
export const MIN_POSTS_FOR_ENGAGEMENT = 3;

export function warningsOf(i: Influencer, t: Thresholds): Warning[] {
  const out: Warning[] = [];
  if (!i.verified) out.push("unverified");
  if (i.followers < t.minFollowers) out.push("low-followers");
  if (i.verified && i.engagement !== null && t.minEngagement > 0 && i.engagement < t.minEngagement) out.push("low-engagement");
  return out;
}

/** Supabase satırı (influencers tablosu) → panelin kullandığı biçim. Bozuk/eksik alanlara dayanıklıdır. */
export type InfluencerRow = {
  id: string;
  name: string | null;
  niche: string | null;
  instagram: string | null;
  email: string | null;
  tiktok?: string | null;
  followers: number | null;
  engagement_rate: number | string | null; // yüzde olarak saklanır (1,76 = %1,76)
  avg_likes: number | null;
  avg_comments: number | null;
  posts_analyzed: number | null;
  scan_status: string | null;
  last_scanned_at: string | null;
  found_at: string | null;
};

const TIKTOK_RE = /^[A-Za-z0-9._]{2,24}$/;

/** "@ad", tiktok.com/@ad adresi ya da düz ad gelebilir; geçerliyse düz kullanıcı adını döner. */
export function cleanTiktok(v: string | null | undefined): string | undefined {
  const s = (v ?? "")
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/@/i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  return TIKTOK_RE.test(s) ? s : undefined;
}

export function rowToInfluencer(r: InfluencerRow): Influencer {
  const verified = r.scan_status === "ok";
  const rate = r.engagement_rate === null ? NaN : Number(r.engagement_rate);
  const enough = verified && Number.isFinite(rate) && (r.posts_analyzed ?? 0) >= MIN_POSTS_FOR_ENGAGEMENT;
  return {
    id: r.id,
    name: (r.name ?? "").trim() || r.instagram || "İsimsiz",
    handle: r.instagram ?? "",
    platform: "instagram",
    niche: (r.niche ?? "").trim(),
    followers: Math.max(0, r.followers ?? 0),
    avgLikes: verified ? Math.max(0, r.avg_likes ?? 0) : 0,
    avgComments: verified ? Math.max(0, r.avg_comments ?? 0) : 0,
    engagement: enough ? rate / 100 : null,
    verified,
    email: r.email?.trim() || undefined,
    tiktok: cleanTiktok(r.tiktok),
    foundAt: r.found_at ?? new Date(0).toISOString(),
    scannedAt: r.last_scanned_at ?? undefined,
  };
}

const trDecimal = (n: number, digits: number) =>
  n.toFixed(digits).replace(".", ",").replace(/,0$/, "");

/** 8200 → "8,2 B", 126000 → "126 B", 1250000 → "1,3 Mn" */
export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${trDecimal(n / 1_000_000, 1)} Mn`;
  if (n >= 100_000) return `${Math.round(n / 1000)} B`;
  if (n >= 1_000) return `${trDecimal(n / 1000, 1)} B`;
  return String(Math.round(n));
}

export const fmtPct = (r: number): string => `%${Math.round(r * 100)}`;

/** Etkileşim oranı: 0.0176 → "%1,8", 0.13 → "%13" */
export const fmtRate = (r: number): string => `%${trDecimal(r * 100, 1)}`;

export const fmtDay = (iso: string): string =>
  new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

export const profileUrl = (i: Pick<Influencer, "platform" | "handle">): string =>
  i.platform === "instagram"
    ? `https://www.instagram.com/${encodeURIComponent(i.handle)}/`
    : `https://www.tiktok.com/@${encodeURIComponent(i.handle)}`;

export const tiktokUrl = (handle: string): string => `https://www.tiktok.com/@${encodeURIComponent(handle)}`;

// --- Mail şablonu -----------------------------------------------------------

export type MailSettings = {
  brand: string;
  commission: number; // yüzde
  contact: string; // detay için iletişim adresi
  subject: string;
  template: string;
};

export const CONTACT_PLACEHOLDER = "[iletişim adresi]";

export const DEFAULT_SUBJECT = "{marka} ile iş birliği teklifi";

export const DEFAULT_TEMPLATE = `Merhaba {isim},

{marka} olarak {alan} içeriklerini ilgiyle takip ediyoruz. Ürünlerimizi denemeni, beğenirsen kendi kitlenle paylaşmanı isteriz.

İş birliği şartlarımız:
• Ürünleri sana ücretsiz gönderiyoruz.
• Sana özel indirim koduyla gelen her satıştan %{komisyon} komisyon ödüyoruz.
• İçeriği nasıl hazırlayacağın tamamen sana kalmış.

Detaylı bilgi almak istersen bu adrese yazabilirsin: {iletisim}

İlgilenmiyorsan bu mesaja "ilgilenmiyorum" yazman yeterli, bir daha yazmayacağız.

Sevgiler,
{marka} ekibi`;

/** Daha önce yazılmış ama yanıt alınamayan hesaplar için kısa hatırlatma metni. */
export const FOLLOWUP_TEMPLATE = `Merhaba {isim},

Geçen sefer {marka} ile iş birliği teklifimizi iletmiştik, mesajımız gözünden kaçmış olabilir diye tekrar yazıyoruz.

Özetle: ürünlerimizi sana ücretsiz gönderiyoruz, sana özel indirim koduyla gelen her satıştan %{komisyon} komisyon ödüyoruz, içeriği nasıl hazırlayacağın sana kalmış.

Detaylı bilgi almak istersen bu adrese yazabilirsin: {iletisim}

İlgilenmiyorsan sorun değil, bir daha yazmayacağız.

Sevgiler,
{marka} ekibi`;

export const DEFAULT_MAIL: MailSettings = {
  brand: "Lume",
  commission: 30,
  contact: "",
  subject: DEFAULT_SUBJECT,
  template: DEFAULT_TEMPLATE,
};

export const TEMPLATE_FIELDS = ["{isim}", "{alan}", "{hesap}", "{marka}", "{komisyon}", "{iletisim}"] as const;

export function fillTemplate(tpl: string, i: Pick<Influencer, "name" | "niche" | "handle">, s: MailSettings): string {
  const vars: Record<string, string> = {
    isim: i.name,
    alan: i.niche.trim().toLocaleLowerCase("tr-TR") || "kozmetik",
    hesap: i.handle.trim() ? `@${i.handle.trim()}` : "",
    marka: s.brand.trim() || "Lume",
    komisyon: String(s.commission),
    iletisim: s.contact.trim() || CONTACT_PLACEHOLDER,
  };
  return tpl.replace(/\{(isim|alan|hesap|marka|komisyon|iletisim)\}/g, (_m, key: string) => vars[key]);
}

export const needsContact = (text: string): boolean => text.includes(CONTACT_PLACEHOLDER);

/** Basit ama sağlam e-posta denetimi: boşluk yok, tek @, alan adında nokta. */
export const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v.trim()) && v.trim().length <= 120;

// --- Sıralama ---------------------------------------------------------------
export type SortKey = "followers" | "avgLikes" | "engagement";
export type SortDir = "desc" | "asc";

function sortValue(i: Influencer, key: SortKey): number | null {
  if (key === "followers") return i.followers;
  if (key === "avgLikes") return i.verified ? i.avgLikes : null; // doğrulanmamışta 0 gerçek veri değil
  return i.engagement;
}

/** Listeyi sıralar (kopya döner). Verisi olmayan hesaplar yönden bağımsız hep sona gider. */
export function sortInfluencers(list: Influencer[], key: SortKey | null, dir: SortDir): Influencer[] {
  if (!key) return list;
  const sign = dir === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * sign;
  });
}
