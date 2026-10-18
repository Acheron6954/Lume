// Bio linkini (Linktree vb.) okuyup TikTok hesabı ve mail adresi çıkarır. Mail/DM göndermez.
// Sadece sunucuda çalışır. Instagram'dan gelen adresler güvenilmez: yalnızca açık internetteki http(s)
// adreslerine bağlanır; iç ağ, yerel ve özel IP adreslerini (yönlendirmeler dahil) reddeder.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmail } from "./influencer";

const MAX_BYTES = 600_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const CONCURRENCY = 3;
const STALE_DAYS = 30; // bir kez bakılan link bu kadar gün sonra yeniden taranır
const RETRY_DAYS = 3; // geçici hatada (zaman aşımı vb.) bu kadar gün sonra yeniden denenir

// --- Adres güvenliği --------------------------------------------------------

function isPrivateV4(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // paylaşımlı CGNAT
    (a === 169 && b === 254) || // link-local, bulut metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // çok noktaya yayın ve ayrılmış
  );
}

function isPrivateV6(ip: string): boolean {
  const s = ip.toLowerCase();
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (dotted) return isPrivateV4(dotted[1]);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(s);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const parts = s.split(":");
  const first = parseInt(parts[0] || "0", 16);
  const second = parseInt(parts[1] || "0", 16);
  if (first === 0) return true; // ::, ::1 ve IPv4-uyumlu adresler
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 özel
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // çok noktaya yayın
  if (first === 0x2001 && second === 0x0db8) return true; // dokümantasyon
  if (first === 0x0064 && second === 0xff9b) return true; // NAT64: içine IPv4 gömülü olabilir
  return false;
}

/** Özel/yerel/ayrılmış IP mi? Tanınmayan biçim güvensiz sayılır. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) return isPrivateV6(ip);
  return true;
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

const BLOCKED_SUFFIX = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet"];

/** Alan adı açık internete mi çıkıyor? Çözülen tüm adresler genel olmalı. */
export async function isPublicHost(host: string, resolve: Resolver = defaultResolver): Promise<boolean> {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!h || h === "localhost" || BLOCKED_SUFFIX.some((s) => h.endsWith(s))) return false;
  if (isIP(h)) return !isPrivateIp(h);
  if (!h.includes(".")) return false;
  try {
    const addrs = await resolve(h);
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a));
  } catch {
    return false;
  }
}

/** Bio linkini URL'ye çevirir. Yalnızca http(s), kullanıcı bilgisi ve alışılmadık port yok. */
export function parseLink(raw: string): URL | null {
  let s = raw.trim();
  if (!s || s.length > 300) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  return u;
}

// --- Ayrıştırma -------------------------------------------------------------

/** HTML/JSON içinde kaçışlı yazılmış "/" ve "@" karakterlerini düz metne çevirir. */
function unescapeText(s: string): string {
  return s
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\u0040/g, "@")
    .replace(/\\\//g, "/")
    .replace(/&#x2[fF];|&#47;/g, "/")
    .replace(/&#x40;|&#64;|&commat;/gi, "@")
    .replace(/&amp;/g, "&")
    .replace(/%40/g, "@")
    .replace(/%2[fF]/g, "/");
}

const TT_RE = /tiktok\.com\/@([A-Za-z0-9._]{2,24})(?![A-Za-z0-9._])/gi;
const TT_RESERVED = new Set(["tiktok", "tiktokshop", "tiktokcreators", "tiktokforbusiness"]);

/** Metindeki TikTok kullanıcı adları (küçük harf, tekrarsız, görülme sırasıyla). */
export function tiktokHandlesFrom(text: string): string[] {
  const out: string[] = [];
  for (const m of unescapeText(text).matchAll(TT_RE)) {
    const h = m[1].replace(/\.+$/, "").toLowerCase();
    if (h.length >= 2 && !TT_RESERVED.has(h) && !out.includes(h)) out.push(h);
  }
  return out;
}

/** Yanlış hesaba bağlanmamak için: tek aday varsa ya da Instagram adıyla eşleşen varsa onu seçer. */
export function pickTikTok(handles: string[], igHandle: string | null): string | null {
  if (handles.length === 0) return null;
  const ig = (igHandle ?? "").toLowerCase();
  if (ig && handles.includes(ig)) return ig;
  return handles.length === 1 ? handles[0] : null;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const BAD_TLD = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "css", "js", "json", "woff", "woff2", "ico", "map", "html", "avif"]);
const BAD_DOMAIN = [
  "sentry.io", "wixpress.com", "example.com", "example.org", "linktr.ee", "linktree.com", "beacons.ai",
  "w3.org", "schema.org", "googletagmanager.com", "google.com", "cloudflare.com", "tiktok.com", "instagram.com", "facebook.com",
];

/** Metindeki mail adresleri: önce mailto bağlantıları. Site/platform adresleri ve dosya adları elenir. */
export function emailsFrom(text: string): string[] {
  const t = unescapeText(text);
  const out: string[] = [];
  const add = (raw: string) => {
    const e = raw.replace(/\.+$/, "").toLowerCase();
    if (e.length > 120 || !isEmail(e) || out.includes(e)) return;
    const [local, domain] = e.split("@");
    const tld = domain.slice(domain.lastIndexOf(".") + 1);
    if (BAD_TLD.has(tld) || /^(no-?reply|donotreply)$/.test(local)) return;
    if (BAD_DOMAIN.some((d) => domain === d || domain.endsWith(`.${d}`))) return;
    out.push(e);
  };
  for (const m of t.matchAll(/mailto:([^"'<>\s?&#]+)/gi)) add(m[1]);
  for (const m of t.matchAll(EMAIL_RE)) add(m[0]);
  return out.slice(0, 5);
}

// --- Güvenli sayfa getirme ---------------------------------------------------

export type FetchLike = (url: URL, init: RequestInit) => Promise<Response>;
export type Deps = { fetchImpl?: FetchLike; resolver?: Resolver };
export type PageResult = { ok: true; html: string; url: string } | { ok: false; reason: string };

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const dec = new TextDecoder("utf-8", { fatal: false });
  let size = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    out += dec.decode(value, { stream: true });
    if (size >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return out + dec.decode();
}

export async function fetchPage(start: URL, deps: Deps = {}): Promise<PageResult> {
  const doFetch: FetchLike = deps.fetchImpl ?? ((u, init) => fetch(u, init));
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicHost(url.hostname, deps.resolver))) return { ok: false, reason: "adres açık internette değil" };
    let res: Response;
    try {
      res = await doFetch(url, {
        redirect: "manual", // her yönlendirmeyi kendimiz denetleriz
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LumeLinkBot/1.0)", Accept: "text/html,application/xhtml+xml" },
      });
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.name : "ağ hatası" };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      let next: URL | null = null;
      try {
        next = loc ? parseLink(new URL(loc, url).toString()) : null;
      } catch {
        next = null;
      }
      if (!next) return { ok: false, reason: "yönlendirme geçersiz" };
      url = next;
      continue;
    }
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    if (!/text\/html|application\/xhtml/i.test(res.headers.get("content-type") ?? "")) return { ok: false, reason: "sayfa HTML değil" };
    return { ok: true, html: await readCapped(res), url: url.toString() };
  }
  return { ok: false, reason: "çok fazla yönlendirme" };
}

// --- Tek link / toplu tarama -------------------------------------------------

export type LinkFinding = {
  tiktok: string | null;
  email: string | null;
  status: "ok" | "skipped" | "failed" | "ambiguous";
  reason?: string;
};

/** Giriş duvarlı sosyal siteler: sayfa okumanın anlamı yok. */
const SKIP_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "fb.me", "x.com", "twitter.com", "youtube.com", "youtu.be",
  "wa.me", "whatsapp.com", "t.me", "pinterest.com", "snapchat.com", "spotify.com",
];
const hostIn = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));

export async function scanLink(raw: string, igHandle: string | null, deps: Deps = {}): Promise<LinkFinding> {
  const u = parseLink(raw);
  if (!u) return { tiktok: null, email: null, status: "skipped", reason: "geçersiz adres" };
  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  if (hostIn(host, ["tiktok.com"])) {
    const tiktok = pickTikTok(tiktokHandlesFrom(u.toString()), igHandle);
    return { tiktok, email: null, status: tiktok ? "ok" : "skipped", reason: tiktok ? undefined : "TikTok profil adresi değil" };
  }
  if (hostIn(host, SKIP_HOSTS)) return { tiktok: null, email: null, status: "skipped", reason: "sosyal ağ adresi" };

  const page = await fetchPage(u, deps);
  if (!page.ok) return { tiktok: null, email: null, status: "failed", reason: page.reason };

  const handles = tiktokHandlesFrom(page.html);
  const tiktok = pickTikTok(handles, igHandle);
  const email = emailsFrom(page.html)[0] ?? null;
  const ambiguous = handles.length > 1 && !tiktok;
  return { tiktok, email, status: ambiguous ? "ambiguous" : "ok", reason: ambiguous ? "birden fazla TikTok adresi" : undefined };
}

type Row = { id: string; instagram: string | null; tiktok: string | null; email: string | null; other_url: string | null };

export type LinkScanOutcome = {
  picked: number;
  tiktok: number; // yeni bulunan TikTok hesabı
  email: number; // yeni bulunan mail adresi
  ambiguous: number;
  skipped: number;
  failed: number;
  errors: { handle: string; message: string }[];
};

/** TikTok ya da maili eksik olan hesapların bio linkine bakar. Dolu alanların üzerine asla yazmaz. */
export async function runLinkScan(db: SupabaseClient, opts: { batch: number; now?: number; deps?: Deps }): Promise<LinkScanOutcome> {
  const nowMs = opts.now ?? Date.now();
  const cutoff = new Date(nowMs - STALE_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("influencers")
    .select("id, instagram, tiktok, email, other_url")
    .not("other_url", "is", null)
    .eq("excluded", false)
    .or("tiktok.is.null,email.is.null")
    .or(`link_scanned_at.is.null,link_scanned_at.lt.${cutoff}`)
    .order("link_scanned_at", { ascending: true, nullsFirst: true })
    .limit(opts.batch);
  if (error) throw new Error(`Veritabanı: ${error.message}`);
  const rows = (data ?? []) as Row[];

  const out: LinkScanOutcome = { picked: rows.length, tiktok: 0, email: 0, ambiguous: 0, skipped: 0, failed: 0, errors: [] };

  const work = async (row: Row) => {
    const label = row.instagram ?? row.id;
    const found = await scanLink(row.other_url ?? "", row.instagram, opts.deps);
    const now = new Date(nowMs).toISOString();
    // Geçici hatada kısa süre sonra yeniden denensin diye damgayı geriye çekeriz.
    const stamp = found.status === "failed" ? new Date(nowMs - (STALE_DAYS - RETRY_DAYS) * 86_400_000).toISOString() : now;
    const patch: Record<string, string> = { link_scanned_at: stamp, updated_at: now };
    if (found.tiktok && !row.tiktok) patch.tiktok = found.tiktok;
    if (found.email && !row.email) patch.email = found.email;
    const { error: upErr } = await db.from("influencers").update(patch).eq("id", row.id);
    if (upErr) {
      out.failed++;
      out.errors.push({ handle: label, message: `Yazılamadı: ${upErr.message}`.slice(0, 160) });
      return;
    }
    if (patch.tiktok) out.tiktok++;
    if (patch.email) out.email++;
    if (found.status === "ambiguous") out.ambiguous++;
    else if (found.status === "skipped") out.skipped++;
    else if (found.status === "failed") {
      out.failed++;
      out.errors.push({ handle: label, message: (found.reason ?? "okunamadı").slice(0, 160) });
    }
  };

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map(work));
  }
  out.errors = out.errors.slice(0, 10);
  return out;
}
