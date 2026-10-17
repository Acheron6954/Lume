// Sunucu tarafı giriş: şifre hash'li saklanır, oturum imzalı çerezdir.
// Bu dosya yalnızca sunucuda çalışır (node:crypto). Tarayıcıya hiçbir şey sızmaz.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "lume_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // saniye: 12 saat

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

/** admin: her şeyi yapar. viewer: her şeyi görür, hiçbir şeyi değiştiremez ve kimseyle iletişime geçemez. */
export type Role = "admin" | "viewer";

export type AuthConfig = {
  user: string;
  passHash: string;
  secret: string;
  /** İsteğe bağlı salt okunur ikinci kullanıcı (LUME_VIEWER_USER + LUME_VIEWER_PASS_HASH). */
  viewer?: { user: string; passHash: string };
};

/** Ortam değişkenleri eksikse null döner; bu durumda giriş tamamen kapalı kalır. */
export function readConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  const user = env.LUME_USER?.trim();
  const passHash = env.LUME_PASS_HASH?.trim();
  const secret = env.SESSION_SECRET?.trim();
  if (!user || !passHash || !secret || secret.length < 32) return null;
  const vUser = env.LUME_VIEWER_USER?.trim();
  const vHash = env.LUME_VIEWER_PASS_HASH?.trim();
  // Aynı ad iki role birden verilemez: admin adı her zaman admin'e gider.
  const viewer = vUser && vHash && vUser.toLowerCase() !== user.toLowerCase() ? { user: vUser, passHash: vHash } : undefined;
  return { user, passHash, secret, viewer };
}

/** Biçim: scrypt:<tuz hex>:<anahtar hex>. ($ kullanılmaz: .env dosyalarında değişken sanılır.) */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32, SCRYPT);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length === 0) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, SCRYPT);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Kullanıcı adı yanlış olsa bile şifre kontrolü çalışır, süre farkından ipucu çıkmaz. */
export function checkCredentials(username: string, password: string, cfg: AuthConfig): boolean {
  const userOk = timingSafeEqual(digest(username.toLowerCase()), digest(cfg.user.toLowerCase()));
  const passOk = verifyPassword(password, cfg.passHash);
  return userOk && passOk;
}

/** Hangi rolle girildiğini döner (hiçbiri uymazsa null). İki kullanıcı için de şifre kontrolü her zaman çalışır. */
export function authenticate(username: string, password: string, cfg: AuthConfig): Role | null {
  const adminOk = checkCredentials(username, password, cfg);
  let viewerOk = false;
  if (cfg.viewer) {
    const nameOk = timingSafeEqual(digest(username.toLowerCase()), digest(cfg.viewer.user.toLowerCase()));
    const passOk = verifyPassword(password, cfg.viewer.passHash);
    viewerOk = nameOk && passOk;
  }
  return adminOk ? "admin" : viewerOk ? "viewer" : null;
}

/** Vercel Cron, CRON_SECRET tanımlıysa "Authorization: Bearer <gizli>" başlığıyla çağırır. */
export function cronAuthorized(header: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16 || !header) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export function signSession(user: string, secret: string, now = Date.now(), role: Role = "admin"): string {
  const payload = Buffer.from(JSON.stringify({ u: user, r: role, exp: now + SESSION_MAX_AGE * 1000 })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(token: string | undefined, secret: string, now = Date.now()): { user: string; role: Role } | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = createHmac("sha256", secret).update(payload).digest();
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.u !== "string" || typeof data.exp !== "number" || data.exp < now) return null;
    // "r" yoksa token rol eklenmeden önce üretilmiştir; o dönemde tek kullanıcı vardı (admin).
    return { user: data.u, role: data.r === "viewer" ? "viewer" : "admin" };
  } catch {
    return null;
  }
}

// --- Hatalı deneme sınırı ---------------------------------------------------
// Bellekte tutulur: sunucusuz ortamda her örnek kendi sayacını taşır. Bu yüzden
// tek başına yeterli değildir; güçlü şifre ve Vercel Firewall hız sınırı ile birlikte düşün.
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_IP = 5;
export const MAX_FAILS_GLOBAL = 40;

type Bucket = { fails: number; first: number; lockedUntil: number };
const buckets = new Map<string, Bucket>();

/** Kilidin bitmesine kalan milisaniye (0 ise kilit yok). */
export function lockedFor(key: string, now = Date.now()): number {
  const b = buckets.get(key);
  return b && b.lockedUntil > now ? b.lockedUntil - now : 0;
}

export function recordFail(key: string, limit: number, now = Date.now()): void {
  if (buckets.size > 2000) buckets.clear();
  let b = buckets.get(key);
  if (!b || now - b.first > WINDOW_MS) b = { fails: 0, first: now, lockedUntil: 0 };
  b.fails += 1;
  if (b.fails >= limit) b.lockedUntil = now + LOCK_MS;
  buckets.set(key, b);
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}

export function resetLimits(): void {
  buckets.clear();
}
