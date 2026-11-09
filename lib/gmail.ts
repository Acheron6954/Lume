// Gmail ile gönderim (gmail.send) ve yanıt takibi için üstbilgi okuma (gmail.metadata). Saf fonksiyonlar + enjekte edilebilir fetch (test edilebilir).
// Bu dosya hiçbir şeyi kendiliğinden göndermez; gönderimi yalnızca /api/gmail/send çağırır.
import { isEmail } from "./influencer";
import type { GmailThread } from "./replies";

export const DAILY_LIMIT = 30; // günlük gönderim sınırı (İstanbul gününe göre)
export const MAX_PER_REQUEST = 10; // tek istekte en çok bu kadar mail (60 sn sınırı için)
// gmail.send: mail göndermek. gmail.metadata: yalnızca üstbilgi ve etiketleri okur (gövde okunamaz), yanıt takibi için.
export const SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const METADATA_SCOPE = "https://www.googleapis.com/auth/gmail.metadata";
export const SCOPE = `${SEND_SCOPE} ${METADATA_SCOPE} openid email`;

// Google'ın geri döndüğü adres (Google Console'daki redirect URI ile birebir aynı olmalı).
export const CALLBACK_PATH = "/api/gmail/callback";
// Asıl işi yapan adım; ara sayfa buraya site içinden yönlendirir.
export const COMPLETE_PATH = "/api/gmail/complete";

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Google'dan dönüşü karşılayan ara sayfa. Safari, Google'ın başlattığı yönlendirmede oturum çerezini göndermeyebiliyor;
 * bu sayfa kullanıcıyı site içinden COMPLETE_PATH'e taşır, o istekte çerezler gelir.
 * Yalnızca code, state ve error parametreleri taşınır; değerler kaçışlanır.
 */
export function bouncePage(search: URLSearchParams): string {
  const q = new URLSearchParams();
  for (const k of ["code", "state", "error"]) {
    const v = search.get(k);
    if (v !== null) q.set(k, v.slice(0, 2048));
  }
  const target = escapeHtml(`${COMPLETE_PATH}?${q.toString()}`);
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${target}"><title>Gmail bağlanıyor…</title></head><body style="background:#0b0a1a;color:#ddd;font-family:system-ui,sans-serif;padding:40px">Gmail bağlanıyor… Yönlenmezse <a style="color:#c9a7ff" href="${target}">buraya tıkla</a>.</body></html>`;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
export type OAuthCfg = { clientId: string; clientSecret: string; redirectUri: string };

export function authUrl(cfg: Pick<OAuthCfg, "clientId" | "redirectUri">, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // refresh token'ı her bağlamada verir
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(params: Record<string, string>, f: FetchFn): Promise<Record<string, unknown>> {
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : `token_http_${res.status}`);
  return j;
}

/** id_token yükünden e-posta. İmza doğrulanmaz: token doğrudan Google'dan TLS ile geldi. */
export function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: unknown };
    return typeof payload.email === "string" && isEmail(payload.email) ? payload.email : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string, cfg: OAuthCfg, f: FetchFn = fetch): Promise<{ refreshToken: string; email: string }> {
  const j = await tokenRequest(
    { code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: "authorization_code" },
    f,
  );
  const refreshToken = typeof j.refresh_token === "string" ? j.refresh_token : "";
  const email = emailFromIdToken(j.id_token);
  if (!refreshToken) throw new Error("no_refresh_token");
  if (!email) throw new Error("no_email");
  if (typeof j.scope === "string" && !(j.scope.includes(SEND_SCOPE) && j.scope.includes(METADATA_SCOPE))) throw new Error("scope_missing");
  return { refreshToken, email };
}

export async function accessToken(refreshToken: string, cfg: Pick<OAuthCfg, "clientId" | "clientSecret">, f: FetchFn = fetch): Promise<string> {
  const j = await tokenRequest({ refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token" }, f);
  if (typeof j.access_token !== "string") throw new Error("no_access_token");
  return j.access_token;
}

export type Outgoing = { to: string; subject: string; body: string };

/** Başlık enjeksiyonunu (satır sonu) ve geçersiz adresi engeller. null: sorun yok. */
export function validateOutgoing(m: Outgoing): string | null {
  if (!isEmail(m.to) || /[\r\n,;<>]/.test(m.to)) return "Geçersiz alıcı adresi";
  if (!m.subject.trim() || /[\r\n]/.test(m.subject)) return "Konu boş ya da geçersiz";
  if (!m.body.trim()) return "Mail metni boş";
  if (m.subject.length > 200 || m.body.length > 5000) return "Konu ya da metin çok uzun";
  return null;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const wrap76 = (s: string) => s.replace(/(.{76})/g, "$1\r\n");

/** RFC 2822 mesajı, base64url (Gmail API "raw" alanı). Konu ve gövde UTF-8. */
export function buildRaw(from: string, m: Outgoing): string {
  const lines = [
    `From: ${from}`,
    `To: ${m.to}`,
    `Subject: =?UTF-8?B?${b64(m.subject)}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(m.body.replace(/\r?\n/g, "\r\n"))),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export async function sendRawFull(token: string, raw: string, f: FetchFn = fetch): Promise<{ id: string; threadId: string | null }> {
  const res = await f("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const j = (await res.json().catch(() => ({}))) as { id?: unknown; threadId?: unknown; error?: { message?: unknown } };
  if (!res.ok || typeof j.id !== "string") {
    throw new Error(typeof j.error?.message === "string" ? j.error.message : `gmail_http_${res.status}`);
  }
  return { id: j.id, threadId: typeof j.threadId === "string" ? j.threadId : null };
}

export async function sendRaw(token: string, raw: string, f: FetchFn = fetch): Promise<string> {
  return (await sendRawFull(token, raw, f)).id;
}

/** Bir konuşmayı yalnızca üstbilgi düzeyinde çeker (gmail.metadata yeter). Silinmişse null. */
export async function fetchThread(token: string, threadId: string, f: FetchFn = fetch): Promise<GmailThread | null> {
  if (!/^[0-9a-f]{6,32}$/i.test(threadId)) throw new Error("bad_thread_id");
  const q = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "Subject", "Auto-Submitted", "Precedence", "X-Autoreply", "X-Autorespond"]) q.append("metadataHeaders", h);
  const res = await f(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  const j = (await res.json().catch(() => ({}))) as GmailThread & { error?: { message?: unknown } };
  if (!res.ok) throw new Error(typeof j.error?.message === "string" ? j.error.message : `gmail_http_${res.status}`);
  return j;
}

/** İstanbul (UTC+3, yaz saati yok) gününün başlangıcı, ISO. */
export function istanbulDayStart(now: Date): string {
  const H3 = 3 * 3600_000;
  const local = now.getTime() + H3;
  return new Date(local - (local % 86_400_000) - H3).toISOString();
}

export const remainingToday = (sentToday: number): number => Math.max(0, DAILY_LIMIT - sentToday);
