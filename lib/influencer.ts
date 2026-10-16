// Influencer verisi, uyarı kuralları ve mail şablonu. Saf fonksiyonlar: kolay test edilir.

export type Platform = "instagram" | "tiktok";

export type Influencer = {
  id: string;
  name: string;
  handle: string;
  platform: Platform;
  niche: string;
  followers: number;
  avgViews: number;
  email?: string;
  foundAt: string; // ISO
  example?: boolean;
};

export type Thresholds = {
  minFollowers: number; // bunun altı uyarılır
  minRatio: number; // ort. görüntülenme ÷ takipçi, 0..1
};

export type Warning = "low-followers" | "low-ratio";

export const WARNING_LABEL: Record<Warning, string> = {
  "low-followers": "Düşük takipçi",
  "low-ratio": "Düşük izlenme oranı",
};

export const DEFAULT_THRESHOLDS: Thresholds = { minFollowers: 10_000, minRatio: 0.1 };

export const viewRatio = (i: Pick<Influencer, "followers" | "avgViews">): number =>
  i.followers > 0 ? i.avgViews / i.followers : 0;

export function warningsOf(i: Influencer, t: Thresholds): Warning[] {
  const out: Warning[] = [];
  if (i.followers < t.minFollowers) out.push("low-followers");
  if (viewRatio(i) < t.minRatio) out.push("low-ratio");
  return out;
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

export const fmtDay = (iso: string): string =>
  new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

export const profileUrl = (i: Pick<Influencer, "platform" | "handle">): string =>
  i.platform === "instagram"
    ? `https://www.instagram.com/${encodeURIComponent(i.handle)}/`
    : `https://www.tiktok.com/@${encodeURIComponent(i.handle)}`;

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
