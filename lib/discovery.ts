// Aday bulma: web aramasıyla Instagram kullanıcı adlarını toplar. Doğrulamayı /lib/scan yapar.
// Sadece sunucuda çalışır; BRAVE_API_KEY tarayıcıya gitmemeli.
import { USERNAME_RE } from "./instagram";

/** Instagram yol parçaları: bunlar kullanıcı adı değil. */
const RESERVED = new Set([
  "p", "reel", "reels", "tv", "stories", "explore", "accounts", "tags", "directory", "about", "legal",
  "developer", "direct", "web", "challenge", "oauth", "privacy", "terms", "press", "api", "locations",
  "instagram", "meta", "modash", "umut.lume",
]);

/** Günlük döngüde dönen sorgular. Her çalıştırmada bir dilim kullanılır. */
export const QUERY_POOL = [
  "site:instagram.com güzellik içerik üreticisi cilt bakımı",
  "site:instagram.com makyaj influencer Türkiye",
  "site:instagram.com cilt bakım rutini içerik üreticisi",
  "site:instagram.com kozmetik inceleme blogger",
  "site:instagram.com kore cilt bakımı Türkiye",
  "site:instagram.com güzellik blogger iş birliği",
  "site:instagram.com makyaj sanatçısı içerik üreticisi",
  "site:instagram.com dermokozmetik inceleme",
  "en iyi güzellik influencerları Türkiye Instagram",
  "cilt bakımı fenomenleri Instagram Türkiye listesi",
  "makyaj fenomenleri Türkiye Instagram takipçi",
  "Türkiye en çok takip edilen güzellik içerik üreticileri",
  "micro influencer güzellik Türkiye Instagram",
  "kozmetik markaları iş birliği yapan influencerlar Türkiye",
  "kore güzellik içerik üreticisi Türkiye Instagram",
  "saç bakımı influencer Türkiye Instagram",
  "site:instagram.com saç bakımı içerik üreticisi",
  "site:instagram.com parfüm inceleme içerik üreticisi",
  "site:instagram.com güzellik tavsiyeleri ürün inceleme",
  "site:instagram.com kişisel bakım içerik üreticisi",
];

/** Gün sayısına göre n sorguluk dilim seçer (her gün farklı sorgular). */
export function pickQueries(dayIndex: number, n: number, pool: string[] = QUERY_POOL): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.min(n, pool.length); i++) out.push(pool[(((dayIndex * n + i) % pool.length) + pool.length) % pool.length]);
  return out;
}

function clean(raw: string): string | null {
  const h = raw.replace(/\.+$/, "").toLowerCase();
  if (h.length < 3 || !USERNAME_RE.test(h) || RESERVED.has(h) || /^[\d.]+$/.test(h)) return null;
  return h;
}

/** https://www.instagram.com/<kullanici>/ adresinden kullanıcı adı. Gönderi/reel adresleri null döner. */
export function handleFromUrl(url: string): string | null {
  const m = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?(?:[?#].*)?$/i.exec(url.trim());
  return m ? clean(m[1]) : null;
}

/** Metindeki @kullanici ve instagram.com/kullanici geçişleri. E-posta adreslerini saymaz. */
export function handlesFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?<![\w.@])@([A-Za-z0-9._]{3,30})(?![\p{L}\p{N}_])/gu)) {
    const h = clean(m[1]);
    if (h) found.add(h);
  }
  for (const m of text.matchAll(/instagram\.com\/([A-Za-z0-9._]+)/gi)) {
    const h = clean(m[1]);
    if (h) found.add(h);
  }
  return [...found];
}

export type SearchHit = { url: string; title?: string; description?: string };

/** Bir arama sonucu listesinden aday kullanıcı adları. */
export function candidatesFrom(hits: SearchHit[]): string[] {
  const found = new Set<string>();
  for (const hit of hits) {
    const fromUrl = handleFromUrl(hit.url);
    if (fromUrl) found.add(fromUrl);
    for (const h of handlesFromText(`${hit.title ?? ""} ${hit.description ?? ""}`)) found.add(h);
  }
  return [...found];
}

export type SearchFailure = "key" | "rate" | "error";
export type SearchResult = { ok: true; hits: SearchHit[] } | { ok: false; kind: SearchFailure; message: string };

const BRAVE = "https://api.search.brave.com/res/v1/web/search";

export async function braveSearch(query: string, key: string): Promise<SearchResult> {
  const url = `${BRAVE}?${new URLSearchParams({ q: query, count: "20", country: "TR", search_lang: "tr" })}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, kind: "key", message: "Brave anahtarı geçersiz" };
    if (res.status === 402 || res.status === 429) return { ok: false, kind: "rate", message: "Brave limiti/kredisi doldu" };
    if (!res.ok) return { ok: false, kind: "error", message: `Brave HTTP ${res.status}` };
    const json = (await res.json()) as { web?: { results?: { url?: string; title?: string; description?: string }[] } };
    const hits = (json.web?.results ?? [])
      .filter((r): r is { url: string; title?: string; description?: string } => typeof r.url === "string")
      .map((r) => ({ url: r.url, title: r.title, description: r.description }));
    return { ok: true, hits };
  } catch (e) {
    return { ok: false, kind: "error", message: e instanceof Error ? e.message : "Brave isteği başarısız" };
  }
}
